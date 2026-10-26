import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import http from 'node:http';

const files = {
  details: readFileSync(new URL('../src/components/AdminEditDetails.jsx', import.meta.url), 'utf8'),
  editor: readFileSync(new URL('../src/components/AdminImportedDetailEditor.jsx', import.meta.url), 'utf8'),
  listing: readFileSync(new URL('../src/components/AdminImportedCatalog.jsx', import.meta.url), 'utf8'),
  page: readFileSync(new URL('../src/components/AdminPage.jsx', import.meta.url), 'utf8'),
};

test('product-details admin has a separate imported editor instead of reading missing original fields', () => {
  assert.match(files.details, /slug\.startsWith\("import-"\)/);
  assert.match(files.details, /if \(isImported\) return/);
  assert.match(files.details, /AdminImportedDetailEditor/);
  assert.ok(files.details.indexOf('if (isImported) return') < files.details.lastIndexOf('original.name'), 'guard imported records before legacy name');
  assert.match(files.details, /if \(!original\) return/);
});

test('unified All Products can open an imported plan in its full editor', () => {
  const workspace = readFileSync(new URL('../src/components/AdminCatalogWorkspace.jsx',import.meta.url),'utf8');
  assert.match(workspace, /onEdit\(row\.slug\)/);
  assert.match(workspace, /allCategories\.filter/);
  assert.match(files.page, /setDetailSlug\(slug\); openView\("details"\)/);
  assert.match(files.page, /AdminErrorBoundary/);
  assert.doesNotMatch(files.page, /id: "imports"/);
});

test('imported detail editor validates and saves correct fields and prices via protected API', () => {
  assert.match(files.editor, /\/api\/admin\/catalog\/\$\{encodeURIComponent\(slug\)\}/);
  for (const field of ['name','description','category','variant','product_type','status','featured','unavailable','manual_price_pkr','discount_percent'])
    assert.ok(files.editor.includes(field), `missing field ${field}`);
  assert.match(files.editor, /window\.dispatchEvent\(new Event\("catalog-updated"\)\)/);
});

const originalFetch = globalThis.fetch;
const row = {
  slug: 'import-claude-test123', brand: 'Claude', name: 'Claude Pro Month',
  description: 'One month subscription', category: 'ai-tools', variant: '1 Month', product_type: 'subscription',
  price_pkr: 3750, manual_price_pkr: null, discount_percent: 0,
  featured: false, unavailable: false, status: 'pending', review_flags: [],
  cost_cents: 1000, source_ids: ['secret-supplier-123']
};
const recorded = structuredClone(row);
const adminPassword = 'a_valid_long_test_password_25';
process.env.NODE_ENV = 'test';
process.env.VERCEL = '1';
process.env.ADMIN_PASSWORD = adminPassword;
process.env.SUPABASE_URL = 'https://admin-test.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'sb_secret_test_only';
const fakeDB = { revision: 0, payload: { clicks: [], tokens: [], reviews: [], orders: [], questions: [] } };

globalThis.fetch = async (url, options = {}) => {
  if (!String(url).startsWith('https://admin-test.supabase.co/')) return originalFetch(url, options);
  const parsed = new URL(url);
  const respond = (x, status = 200) => new Response(JSON.stringify(x), {status, headers:{'Content-Type':'application/json'}});
  if (parsed.pathname.endsWith('/rpc/ai_tools_admin_attempt')) return respond(0);
  if (parsed.pathname.endsWith('/ai_tools_state')) return respond([{revision:fakeDB.revision,payload:structuredClone(fakeDB.payload)}]);
  if (parsed.pathname.endsWith('/ai_tools_catalog') && (options.method || 'GET') === 'GET') {
    const requested = parsed.searchParams.get('slug')?.replace(/^eq\./,'');
    return respond(requested === recorded.slug ? [{...recorded}] : []);
  }
  if (parsed.pathname.endsWith('/ai_tools_catalog') && options.method === 'PATCH') {
    Object.assign(recorded, JSON.parse(options.body));
    return respond([{slug:recorded.slug,status:recorded.status}]);
  }
  return respond({error:'mock route not found'}, 404);
};
const { default: app } = await import('../server/index.js');
const server = http.createServer(app);
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const endpoint = `http://127.0.0.1:${server.address().port}`;
const request = async (path, method = 'GET', payload = null, password = adminPassword) => {
  const resp = await originalFetch(endpoint + path, {
    method, headers: { 'Content-Type':'application/json', 'x-admin-password':password },
    ...(payload===null ? {} : { body:JSON.stringify(payload) })
  });
  return {status:resp.status,body:await resp.json()};
};

test('imported detail lookup is protected and excludes supplier/cost data', async () => {
  assert.equal((await request(`/api/admin/catalog/${row.slug}`, 'GET', null, 'wrong-password')).status, 401);
  const answer = await request(`/api/admin/catalog/${row.slug}`);
  assert.equal(answer.status,200,JSON.stringify(answer));
  assert.equal(answer.body.item.slug,row.slug);
  assert.ok(!('cost_cents' in answer.body.item));
  assert.ok(!('source_ids' in answer.body.item));
});

test('editing imported name, duration, type, price, discount, and visibility saves through Supabase', async () => {
  const changes = {name:'Claude Pro 2 Months',variant:'2 Months',product_type:'subscription',manual_price_pkr:4800,discount_percent:10,featured:true,unavailable:false};
  const saved = await request(`/api/admin/catalog/${row.slug}`,'PATCH',changes);
  assert.equal(saved.status,200,JSON.stringify(saved));
  const refreshed = await request(`/api/admin/catalog/${row.slug}`);
  for (const [key,value] of Object.entries(changes)) assert.equal(refreshed.body.item[key],value,key);
  assert.equal(refreshed.body.item.cost_cents,undefined);
});

test('server rejects invalid imported prices, discounts, duration, and category', async () => {
  for (const bad of [
    {manual_price_pkr:-5},{discount_percent:120},{variant:'x'.repeat(231)},
    {product_type:'y'.repeat(51)},{category:'fake-category'},
    {cost_cents:1},{source_ids:['forged']}
  ]) {
    const result = await request(`/api/admin/catalog/${row.slug}`,'PATCH',bad);
    if ('cost_cents' in bad || 'source_ids' in bad) assert.equal(result.status,400); // cannot mutate private columns
    else assert.equal(result.status,400,JSON.stringify(result));
  }
});

after(async()=>{
  globalThis.fetch=originalFetch;
  await new Promise(resolve=>server.close(resolve));
});
