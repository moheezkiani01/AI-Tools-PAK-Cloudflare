import crypto from 'node:crypto';

// Stateless admin sessions: no new database tables or per-login storage.
// Changing ADMIN_PASSWORD invalidates every issued cookie.
const COOKIE_NAME = 'ai_pak_admin';
const MAX_AGE_SECONDS = 8 * 60 * 60;
const same = (left, right) => {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
const hmac = (text, secret) => crypto.createHmac('sha256', secret).update(text).digest('hex');
const adminKey = (password) => crypto.createHash('sha256').update(`ai-tools-pak-admin-session-v1:${password}`).digest();
const cookieValue = (req) => String(req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1) || '';
const cookieOptions = (req, maxAge) => [
  `${COOKIE_NAME}=${maxAge ? maxAge.value : ''}`,
  'Path=/api/admin', 'HttpOnly', 'SameSite=Strict',
  // HTTPS behind Vercel proxy is recognized via Express trust proxy.
  ...(req.secure || req.get('x-forwarded-proto') === 'https' ? ['Secure'] : []),
  `Max-Age=${maxAge ? MAX_AGE_SECONDS : 0}`
].join('; ');
export const verifyAdminPassword = (given, expected) => same(given, expected);
export function startAdminSession(req, res, password) {
  const payload = Buffer.from(JSON.stringify({v:1, exp:Math.floor(Date.now()/1000)+MAX_AGE_SECONDS, nonce:crypto.randomBytes(20).toString('hex')})).toString('base64url');
  const signature = hmac(payload, adminKey(password));
  const token = `${payload}.${signature}`;
  res.set('Set-Cookie', cookieOptions(req, {value:token}));
  return {csrfToken:hmac(`csrf:${payload}`, adminKey(password)), expiresIn:MAX_AGE_SECONDS};
}
export function readAdminSession(req, password) {
  const cookie = cookieValue(req);
  const [payload, signature, extra] = cookie.split('.');
  if (!payload || !signature || extra || payload.length > 2048) return null;
  if (!same(hmac(payload, adminKey(password)), signature)) return null;
  let data;
  try {data=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'))} catch {return null}
  if (data?.v !== 1 || !Number.isInteger(data.exp) || data.exp <= Math.floor(Date.now()/1000) || data.exp > Math.floor(Date.now()/1000)+MAX_AGE_SECONDS) return null;
  return {csrfToken:hmac(`csrf:${payload}`, adminKey(password))};
}
export function clearAdminSession(req, res) {res.set('Set-Cookie',cookieOptions(req,null));}
export function hasValidAdminCsrf(req, session) {
  // SameSite=Strict plus a per-session CSRF header protects mutating requests.
  const method = String(req.method || 'GET').toUpperCase();
  if (['GET','HEAD','OPTIONS'].includes(method)) return true;
  return same(req.get('x-admin-csrf'),session?.csrfToken);
}
