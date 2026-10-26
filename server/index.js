import express from "express";
import compression from "compression";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { products } from "../src/data/products.js";
import { allCategories } from "../src/data/categories.js";
import { applyProductDetails } from "../src/utils/productDetails.js";
import { brand } from "../src/config.js";
import { salePrice, regularPrice } from "../src/utils/discounts.js";
import { load, loadPublicState, save, update, databaseMode, adminFailureCount, supabaseRequest, StoreError } from "./dataStore.js";
import { allPublicVariants, findPublicVariant, listPublicGroups, groupPublicVariants, adminCatalog, invalidatePublicCatalogCache } from "./catalog.js";
import { LIVE_STATES, deletedStatus, restoredStatus, isDeletedStatus, isDeletedOriginal, deletedOriginalSlugs } from './productDeletion.js';
import { verifyAdminPassword, startAdminSession, readAdminSession, clearAdminSession, hasValidAdminCsrf } from './adminAuth.js';
import { buildCachedBrowsePage } from './browse.js';
import { cachePublicResponse } from './publicCache.js';
import { usingOrderTable, placeDedicatedOrder, dedicatedOrderSummary, listDedicatedOrders, updateDedicatedOrder } from './scaleOrders.js';

// Settings come from server/.env (copy .env.example to .env and fill it in)
if (!process.env.CLOUDFLARE_WORKER) {
  try {
    const envFile = new URL("./.env", import.meta.url);
    if (fs.existsSync(envFile)) {
      for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
        if (match && !(match[1] in process.env)) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {}
}


const pakistanDate = (value = new Date()) => new Date(new Date(value).getTime() + 5 * 3600000).toISOString().slice(0, 10);

const summary = (list) => ({
  count: list.length,
  average: list.length ? Math.round((list.reduce((sum, r) => sum + r.rating, 0) / list.length) * 10) / 10 : 0,
});

const app = express();
app.use(compression());
app.use(express.json({ limit: "128kb" }));
app.disable("x-powered-by");
// Basic security headers, also applied to static Vercel routes in vercel.json.
app.use((req,res,next)=>{
  res.set('X-Content-Type-Options','nosniff');
  res.set('X-Frame-Options','DENY');
  res.set('Referrer-Policy','strict-origin-when-cross-origin');
  res.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  next();
});
app.set("trust proxy", 1);
app.use("/api", (req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
// All handlers are promise-safe with Express 4, including serverless execution.
const api = {};
for (const verb of ["get", "post", "patch", "delete"]) {
  api[verb] = (path, ...handlers) => app[verb](path, ...handlers.map((fn) =>
    (req, res, next) => Promise.resolve().then(() => fn(req, res, next)).catch(next)));
}
api.get("/api/health", async (req, res) => {
  const db = await load();
  const other = usingOrderTable() ? await dedicatedOrderSummary() : {total:0};
  res.json({ ok: true, storage: databaseMode(), orders: (db.orders || []).length + other.total });
});

// Each time a customer is sent to WhatsApp to order, we count one order
// One count per visitor every 10 minutes, so the chart cannot be inflated by repeated requests
// Bound process-local anti-spam data; Vercel instances are short lived and
// this is NOT a distributed rate limit.
const boundedSet = (map, key, value) => {
  map.delete(key);
  map.set(key, value);
  if (map.size > 5000) map.delete(map.keys().next().value);
};
const lastClick = new Map();
api.post("/api/orders/whatsapp", async (req, res) => {
  if (Date.now() - (lastClick.get(req.ip) || 0) < 10 * 60 * 1000) return res.json({ ok: true, counted: false });
  boundedSet(lastClick, req.ip, Date.now());
  const db = await load();
  db.clicks.push({ date: new Date().toISOString(), items: String(req.body.items || "").slice(0, 200) });
  await save(db);
  res.json({ ok: true });
});

// Count actual website checkout submissions plus the orders entered by admin.
// WhatsApp-button clicks are enquiries, not confirmed orders; show them separately.
const orderStats = (db) => {
  const orders = db.orders || [];
  const manual = db.manualOrders || [];
  const manualWebsite = manual.filter((o) => ["Website", "Website (manual)"].includes(o.source));
  const other = manual.filter((o) => !["Website", "Website (manual)"].includes(o.source));
  const websiteRecorded = manualWebsite.reduce((total, o) => total + o.count, 0);
  const otherRecorded = other.reduce((total, o) => total + o.count, 0);
  const websiteCheckout = orders.length;
  const today = pakistanDate();
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - i);
    const date = d.toISOString().slice(0, 10);
    const automatic = orders.filter((o) => o.date && pakistanDate(o.date) === date).length;
    const recordedWebsite = manualWebsite.filter((o) => o.date === date).reduce((n, o) => n + o.count, 0);
    const recordedOther = other.filter((o) => o.date === date).reduce((n, o) => n + o.count, 0);
    days.push({ date, website: automatic + recordedWebsite, other: recordedOther,
      count: automatic + recordedWebsite + recordedOther });
  }
  return {
    total: websiteCheckout + websiteRecorded + otherRecorded,
    website: websiteCheckout + websiteRecorded,
    websiteCheckout, websiteRecorded,
    manual: websiteRecorded + otherRecorded, other: otherRecorded,
    whatsappEnquiries: (db.clicks || []).length, days,
  };
};

// Merge historical JSONB orders with optional dedicated checkout rows.
// The summary RPC aggregates orders inside Postgres, so no customer details
// are fetched for the public chart, even when the table grows.
const orderStatsScaled = async (db) => {
  const result = orderStats(db);
  if (!usingOrderTable()) return result;
  const extra = await dedicatedOrderSummary();
  result.total += extra.total;
  result.website += extra.total;
  result.websiteCheckout += extra.total;
  const byDate = new Map(extra.days.map(({ date, count }) => [date, count]));
  for (const day of result.days) {
    const count = Number(byDate.get(day.date) || 0);
    day.website += count;
    day.count += count;
  }
  return result;
};
api.get("/api/stats", async (req, res) => cachePublicResponse(res, 30, 15).json(await orderStatsScaled(await loadPublicState())));

api.get("/api/ratings", async (req, res) => {
  const bySlug = {};
  for (const r of (await loadPublicState()).reviews) (bySlug[r.slug] ||= []).push(r);
  cachePublicResponse(res, 30, 15).json(Object.fromEntries(Object.entries(bySlug).map(([slug, list]) => [slug, summary(list)])));
});

api.get("/api/reviews/:slug", async (req, res) => {
  const list = (await loadPublicState()).reviews.filter((r) => r.slug === req.params.slug);
  const reviews = list.map(({ id, name, rating, comment, date, source }) => ({ id, name, rating, comment, date, source: source || "customer" })).reverse();
  cachePublicResponse(res, 30, 15).json({ ...summary(list), reviews });
});

// Website reviews require a valid, unused purchase number for the matching product.
// Only a successfully published review consumes the purchase number.
const reviewLimits = new Map();
const cleanReview = (body) => {
  const slug = String(body.slug || "").trim();
  const rating = Number(body.rating);
  const name = String(body.name || "").trim();
  const comment = String(body.comment || "").trim();
  if (!products.some((p) => p.slug === slug) && !slug.startsWith("import-")) return { error: "Choose a valid product." };
  if (!name || name.length > 60 || !Number.isInteger(rating) || rating < 1 || rating > 5)
    return { error: "Enter your name and choose 1 to 5 stars." };
  if (comment.length < 5 || comment.length > 500) return { error: "Please write a comment (5 to 500 characters)." };
  return { slug, name, rating, comment };
};

const purchaseTokenError = (db, input, slug) => {
  const token = String(input || "").trim().toUpperCase();
  if (!token) return { error: "A purchase number is required to submit a review." };
  if (token.length > 80) return { error: "That purchase number is invalid." };
  const entry = (db.tokens || []).find((t) => t.token === token);
  if (!entry || entry.used || (entry.slug && entry.slug !== slug))
    return { error: "That purchase number is invalid, already used, or belongs to another product." };
  return { entry };
};

api.post("/api/reviews", async (req, res) => {
  const review = cleanReview(req.body || {});
  if (review.error || (review.slug.startsWith("import-") && !await findPublicVariant(review.slug))) return res.status(400).json({ error: review.error || "Product not available." });
  // Honeypot catches basic automated submissions; invisible to regular customers.
  if (req.body.website) return res.status(400).json({ error: "Could not submit this review." });
  const key = `${req.ip}:${review.slug}`;
  const now = Date.now();
  const recent = (reviewLimits.get(key) || []).filter((t) => now - t < 86400000);
  if (recent.length >= 2) return res.status(429).json({ error: "You have already posted reviews for this product today. Please try again tomorrow." });

  const result = await update((db) => {
    const purchase = purchaseTokenError(db, req.body.token, review.slug);
    if (purchase.error) return { error: purchase.error };
    purchase.entry.used = true;
    (db.reviews ||= []).push({ ...review, id: crypto.randomBytes(8).toString("hex"), date: new Date().toISOString(), source: "customer", verified: true });
    return { ok: true };
  });
  if (result.error) return res.status(400).json(result);
  boundedSet(reviewLimits, key, [...recent, now]);
  res.json({ ok: true });
});

// ---------- Customer questions ----------
// The public question ID is NOT an editing credential. A separate random secret is
// stored only in the customer's browser; the server stores only its SHA-256 hash.
const asks = new Map(); // at most 5 questions per visitor per hour
const secretHash = (key) => crypto.createHash("sha256").update(key).digest("hex");
const ownsQuestion = (q, key) => {
  if (!q?.manageKeyHash || typeof key !== "string" || key.length !== 64 || !/^[a-f0-9]{64}$/i.test(key)) return false;
  const incoming = Buffer.from(secretHash(key), "hex");
  const stored = Buffer.from(q.manageKeyHash, "hex");
  return stored.length === incoming.length && crypto.timingSafeEqual(stored, incoming);
};
api.post("/api/questions", async (req, res) => {
  const now = Date.now();
  const recent = (asks.get(req.ip) || []).filter((t) => now - t < 3600000);
  if (recent.length >= 5) return res.status(429).json({ error: "You have asked several questions already. Please try again later." });
  const text = (value, max) => String(value || "").trim().slice(0, max);
  const key = crypto.randomBytes(32).toString("hex");
  const q = { id: crypto.randomBytes(16).toString("hex"), manageKeyHash: secretHash(key),
    name: text(req.body.name, 60), email: text(req.body.email, 120), whatsapp: text(req.body.whatsapp, 30),
    question: text(req.body.question, 500), date: new Date().toISOString(), answer: "", answeredAt: null,
    published: false, displayName: "Anonymous" };
  if (!q.name || q.question.length < 5) return res.status(400).json({ error: "Please enter your name and your question." });
  if (q.email && !/^\S+@\S+\.\S+$/.test(q.email)) return res.status(400).json({ error: "That email address does not look right." });
  boundedSet(asks, req.ip, [...recent, now]);
  const db = await load();
  (db.questions ||= []).push(q);
  await save(db);
  res.json({ id: q.id, manageKey: key, emailEnabled: !!process.env.SMTP_HOST });
});

// For new questions, the browser must demonstrate knowledge of the private key.
// Old questions were created with unpredictable 64-bit IDs and no separate key.
// A visitor who retained that ID in this browser can make a one-time claim.
// Once claimed, even status reads require the new private management key.
const legacyClaimLimits = new Map();
api.post("/api/questions/:id/claim", async (req, res) => {
  if (!/^[a-f0-9]{16}$/i.test(req.params.id)) return res.status(400).json({ error: "This is not an older question." });
  const now = Date.now();
  const recent = (legacyClaimLimits.get(req.ip) || []).filter((t) => now - t < 3600000);
  if (recent.length >= 8) return res.status(429).json({ error: "Too many attempts. Please try later." });
  legacyClaimLimits.set(req.ip, [...recent, now]);
  const db = await load();
  const q = (db.questions || []).find((item) => item.id === req.params.id && !item.manageKeyHash && !item.customerRemoved);
  if (!q) return res.status(404).json({ error: "This older question cannot be claimed. It may have been claimed already." });
  const key = crypto.randomBytes(32).toString("hex");
  q.manageKeyHash = secretHash(key);
  await save(db);
  res.json({ manageKey: key });
});
api.post("/api/questions/status", async (req, res) => {
  const requests = Array.isArray(req.body.questions) ? req.body.questions.slice(0, 20) : [];
  const db = await load();
  res.json(requests.flatMap((item) => {
    const q = (db.questions || []).find((entry) => entry.id === item.id);
    if (!q || (q.manageKeyHash ? !ownsQuestion(q, item.manageKey) : false)) return [];
    return [{ id: q.id, answered: !!q.answer, answer: q.answer, published: !!q.published,
      displayName: q.displayName || "Anonymous", publishedBy: q.publishedBy || "customer", legacy: !q.manageKeyHash }];
  }));
});

api.post("/api/questions/:id/publish", async (req, res) => {
  const db = await load();
  const q = (db.questions || []).find((entry) => entry.id === req.params.id);
  if (!q || !ownsQuestion(q, req.body.manageKey)) return res.status(403).json({ error: "This question cannot be managed from this browser." });
  if (!q.answer) return res.status(400).json({ error: "Your question must be answered before you can publish it." });
  const mode = req.body.mode;
  if (!["named", "anonymous"].includes(mode)) return res.status(400).json({ error: "Choose your name or anonymous." });
  q.published = true;
  q.displayName = mode === "named" ? q.name : "Anonymous";
  q.publishedAt = new Date().toISOString();
  q.publishedBy = "customer";
  await save(db);
  res.json({ ok: true, published: true, displayName: q.displayName, publishedBy: q.publishedBy });
});

api.delete("/api/questions/:id", async (req, res) => {
  const db = await load();
  const q = (db.questions || []).find((entry) => entry.id === req.params.id);
  if (!q || q.customerRemoved || !ownsQuestion(q, req.body.manageKey)) return res.status(403).json({ error: "This question cannot be managed from this browser." });
  if (q.published && q.answer) {
    // Removing a question from the customer's account must NOT remove a FAQ
    // the customer already chose to publish. Keep only its public fields.
    // The store can still unpublish or delete that FAQ through Admin.
    q.customerRemoved = true;
    q.name = q.displayName || "Anonymous";
    q.email = "";
    q.whatsapp = "";
    q.manageKeyHash = secretHash(crypto.randomBytes(32).toString("hex"));
    await save(db);
    return res.json({ ok: true, keptInCustomerFaq: true });
  }
  // Unpublished/private questions can still be permanently deleted.
  db.questions = db.questions.filter((entry) => entry.id !== q.id);
  await save(db);
  res.json({ ok: true, keptInCustomerFaq: false });
});

// Only customer-approved questions are shown publicly. No emails, phone
// numbers, private management keys, or unpublished answers are included.
api.get("/api/questions/public", async (req, res) => {
  cachePublicResponse(res, 30, 15).json(((await loadPublicState()).questions || []).filter((q) => q.published && q.answer).reverse().slice(0, 100)
    .map(({ id, question, answer, displayName, publishedAt, publishedBy }) => ({ id, question, answer,
      name: displayName === "Anonymous" ? "Anonymous" : (displayName || "Anonymous"), date: publishedAt,
      publishedBy: publishedBy === "store" ? "store" : "customer" })));
});

// ---------- Admin (protected by ADMIN_PASSWORD in server/.env) ----------
const adminFails = new Map();
const adminPassword = () => process.env.ADMIN_PASSWORD;
const adminConfigured = (res) => {
  if (adminPassword()?.length >= 12) return true;
  res.status(503).json({error:'Set a strong ADMIN_PASSWORD (12+ characters) in the server environment.'});
  return false;
};
const isRateLimited = async (req, res) => {
  const ip = req.ip || 'unknown';
  const key = crypto.createHash('sha256').update(ip).digest('hex');
  const shared = await adminFailureCount(key);
  const fails = shared === null ? (adminFails.get(ip)||[]).filter(t=>Date.now()-t<900000).length : shared;
  if(fails >= 10) {res.status(429).json({error:'Too many wrong attempts. Try again in 15 minutes.'});return true;}
  return false;
};
const recordBadPassword = async req => {
  const ip = req.ip || 'unknown';
  const key = crypto.createHash('sha256').update(ip).digest('hex');
  const shared = await adminFailureCount(key);
  if(shared !== null) await adminFailureCount(key,true);
  else boundedSet(adminFails, ip, [...(adminFails.get(ip)||[]).filter(t=>Date.now()-t<900000),Date.now()]);
};
api.post('/api/admin/login',async(req,res)=>{
  if(!adminConfigured(res)) return;
  if(await isRateLimited(req,res)) return;
  if(!verifyAdminPassword(req.body?.password,adminPassword())){
    await recordBadPassword(req);
    return res.status(401).json({error:'Incorrect password.'});
  }
  // Never return or persist the password in browser storage.
  return res.json(startAdminSession(req,res,adminPassword()));
});
api.get('/api/admin/session',async(req,res)=>{
  if(!adminConfigured(res)) return;
  const session=readAdminSession(req,adminPassword());
  if(!session) return res.status(401).json({error:'Admin session expired. Sign in again.'});
  return res.json(session);
});
api.post('/api/admin/logout',async(req,res)=>{clearAdminSession(req,res);res.json({ok:true})});
const requireAdmin = async (req,res,next) => {
  if(!adminConfigured(res)) return;
  const session=readAdminSession(req,adminPassword());
  if(session){
    if(!hasValidAdminCsrf(req,session))return res.status(403).json({error:'Security token expired. Refresh admin and sign in again.'});
    return next();
  }
  // Only for legacy integrations explicitly opted in on the server. OFF by default.
  if(process.env.ALLOW_LEGACY_ADMIN_HEADER === 'true'){
    if(await isRateLimited(req,res)) return;
    if(verifyAdminPassword(req.get('x-admin-password'),adminPassword()))return next();
    await recordBadPassword(req);
  }
  return res.status(401).json({error:'Admin session expired. Sign in again.'});
};


// Catalog rows are separate from the legacy JSONB shop state. Supplier costs never leave admin APIs.
const catalogQuery = (req) => ({
 search:String(req.query.search||'').slice(0,80), category:String(req.query.category||'all'),
 page:Math.max(1,Math.min(1000,parseInt(req.query.page,10)||1)),
 limit:Math.max(1,Math.min(200,parseInt(req.query.limit,10)||12)),
 featured:req.query.featured==='true',
});
api.get('/api/catalog/browse',async(req,res)=>{
  // Opt-in local diagnostics, never exposed on Vercel/production.
  // A large client latency with small server timings points to connection,
  // request queueing, response transfer, or the load generator itself.
  const tracing = req.get('x-local-catalog-profile') === '1'
    && process.env.NODE_ENV !== 'production' && !process.env.VERCEL;
  const started = tracing ? performance.now() : 0;
  let catalogueMs = 0;
  let stateMs = 0;
  const [imports,db]=tracing ? await Promise.all([
    (async()=>{const t=performance.now();try{return await allPublicVariants();}finally{catalogueMs=performance.now()-t;}})(),
    (async()=>{const t=performance.now();try{return await loadPublicState();}finally{stateMs=performance.now()-t;}})(),
  ]) : await Promise.all([allPublicVariants(),loadPublicState()]);
  const buildStarted = tracing ? performance.now() : 0;
  const page=buildCachedBrowsePage(products,imports,db,req.query);
  if(tracing){
    const buildMs=performance.now()-buildStarted;
    const elapsed=performance.now()-started;
    res.set('Server-Timing',[
      `catalog;dur=${catalogueMs.toFixed(2)}`,
      `state;dur=${stateMs.toFixed(2)}`,
      `build;dur=${buildMs.toFixed(2)}`,
      `handler;dur=${elapsed.toFixed(2)}`,
    ].join(', '));
  }
  cachePublicResponse(res, 12, 15).json(page);
});
api.get('/api/catalog/groups', async(req,res)=>cachePublicResponse(res, 15, 15).json(await listPublicGroups(catalogQuery(req))));
api.get('/api/catalog/groups/:slug', async(req,res)=>cachePublicResponse(res, 15, 15).json({variants:await groupPublicVariants(req.params.slug)}));
api.get('/api/catalog/variants', async(req,res)=>cachePublicResponse(res, 15, 15).json({variants:await allPublicVariants()}));
api.get('/api/catalog/variants/:slug',async(req,res)=>{const product=await findPublicVariant(req.params.slug); if(!product)return res.status(404).json({error:'Product not available.'});cachePublicResponse(res, 10, 10).json({variant:product});});
api.get('/api/admin/catalog',requireAdmin,async(req,res)=>res.json(await adminCatalog({
 search:String(req.query.search||'').slice(0,80),searchField:String(req.query.searchField||'all'),status:String(req.query.status||''),
 category:String(req.query.category||'all'),
 page:Math.max(1,Math.min(1000,parseInt(req.query.page,10)||1)),
 limit:Math.max(1,Math.min(100,parseInt(req.query.limit,10)||30)),
 offset:req.query.offset===undefined?null:Math.max(0,Math.min(100000,Number.parseInt(req.query.offset,10)||0))
})));
api.get('/api/admin/catalog/summary',requireAdmin,async(req,res)=>{
 const summary={total:0,featured:0,unavailable:0,flagged:0,visible:0};
 for(let page=0;page<25;page++){
  const rows=await supabaseRequest(`ai_tools_catalog?select=slug,status,featured,unavailable,review_flags&order=slug&offset=${page*500}&limit=500`);
  if(!Array.isArray(rows))throw new StoreError('Could not load imported catalog summary.');
  for(const item of rows){
   summary.total++;
   if(item.featured)summary.featured++;
   if(item.unavailable)summary.unavailable++;
   if(Array.isArray(item.review_flags)&&item.review_flags.length)summary.flagged++;
   if(item.status==='published'||item.status==='pending'&&Array.isArray(item.review_flags)&&!item.review_flags.length)summary.visible++;
  }
  if(rows.length<500)break;
 }
 res.set('Cache-Control','no-store').json(summary);
});
api.post('/api/admin/catalog/import',requireAdmin,async(req,res)=>{
 const variants=req.body?.variants;
 if(!Array.isArray(variants)||!variants.length||variants.length>30)return res.status(400).json({error:'Provide 1–30 reviewed import records.'});
 for(const row of variants){
  if(!/^import-[a-z0-9-]{5,140}$/.test(String(row.slug||'')) || !Number.isSafeInteger(row.cost_cents)||row.cost_cents<1 ||
   !Array.isArray(row.source_ids)||!row.source_ids.length || !['ai-tools','creative-tools','developer-tools','productivity','marketing-tools','vpn-security','entertainment','professional'].includes(row.category))
   return res.status(400).json({error:'Invalid import record.'});
 }
 const count=await supabaseRequest('rpc/ai_tools_import_catalog',{method:'POST',body:{rows:variants}});
 invalidatePublicCatalogCache();
 res.json({ok:true,processed:count});
});
// Soft delete/restore leaves the product row, prices, orders and reviews intact.
// Original catalogue: tiny list of deleted slugs in the existing ai_tools_state payload.
// Imported catalogue: reuse the existing status column (e.g. deleted-published).
api.post('/api/admin/products/:slug/delete', requireAdmin, async (req, res) => {
 const slug = String(req.params.slug || '');
 if (products.some(p => p.slug === slug)) {
   const result = await update(db => {
     const prior = new Set(deletedOriginalSlugs(db));
     prior.add(slug);
     db.deletedProducts = [...prior].sort();
     return {ok:true,slug,deleted:true};
   });
   return res.json(result);
 }
 if (!/^import-[a-z0-9-]{5,140}$/.test(slug)) return res.status(404).json({error:'Unknown product.'});
 const rows = await supabaseRequest(`ai_tools_catalog?select=status&slug=eq.${encodeURIComponent(slug)}&limit=1`);
 if (!rows.length) return res.status(404).json({error:'Unknown imported product.'});
 if (isDeletedStatus(rows[0].status)) return res.json({ok:true,slug,deleted:true});
 const next = deletedStatus(rows[0].status);
 if (!next) return res.status(409).json({error:'Invalid product status. Refresh and retry.'});
 const changed = await supabaseRequest(`ai_tools_catalog?slug=eq.${encodeURIComponent(slug)}&status=eq.${encodeURIComponent(rows[0].status)}&select=slug,status`,{
   method:'PATCH',body:{status:next,updated_at:new Date().toISOString()}
 });
 if (!changed.length) return res.status(409).json({error:'Product changed. Refresh and retry.'});
 invalidatePublicCatalogCache();
 res.json({ok:true,slug,deleted:true});
});
api.post('/api/admin/products/:slug/restore', requireAdmin, async (req, res) => {
 const slug = String(req.params.slug || '');
 if (products.some(p => p.slug === slug)) {
   const result = await update(db => {
     db.deletedProducts = deletedOriginalSlugs(db).filter(value => value !== slug);
     return {ok:true,slug,deleted:false};
   });
   return res.json(result);
 }
 if (!/^import-[a-z0-9-]{5,140}$/.test(slug)) return res.status(404).json({error:'Unknown product.'});
 const rows = await supabaseRequest(`ai_tools_catalog?select=status&slug=eq.${encodeURIComponent(slug)}&limit=1`);
 if (!rows.length) return res.status(404).json({error:'Unknown imported product.'});
 const previous = restoredStatus(rows[0].status);
 if (!previous) return res.status(409).json({error:'Product is not in Deleted items.'});
 const changed = await supabaseRequest(`ai_tools_catalog?slug=eq.${encodeURIComponent(slug)}&status=eq.${encodeURIComponent(rows[0].status)}&select=slug,status`,{
   method:'PATCH',body:{status:previous,updated_at:new Date().toISOString()}
 });
 if (!changed.length) return res.status(409).json({error:'Product changed. Refresh and retry.'});
 invalidatePublicCatalogCache();
 res.json({ok:true,slug,deleted:false});
});

// Fetch one imported plan for the private admin editor, including hidden/review records.
// Only required editing fields are returned; supplier cost and source IDs stay private.
api.get('/api/admin/catalog/:slug',requireAdmin,async(req,res)=>{
 const slug=String(req.params.slug||'');
 if(!/^import-[a-z0-9-]{5,140}$/.test(slug))return res.status(400).json({error:'Invalid catalog ID.'});
 const fields='slug,brand,name,description,category,variant,product_type,price_pkr,manual_price_pkr,discount_percent,featured,unavailable,status,review_flags';
 const rows=await supabaseRequest(`ai_tools_catalog?select=${fields}&slug=eq.${encodeURIComponent(slug)}&limit=1`);
 if(!Array.isArray(rows)||!rows.length)return res.status(404).json({error:'Imported product not found.'});
 res.json({item:Object.fromEntries(fields.split(',').map(field=>[field,rows[0][field]]))});
});
api.patch('/api/admin/catalog/:slug',requireAdmin,async(req,res)=>{
 const slug=String(req.params.slug||'');
 if(!/^import-[a-z0-9-]{5,140}$/.test(slug))return res.status(400).json({error:'Invalid catalog ID.'});
 const allowed=['name','description','category','variant','product_type','status','featured','unavailable','manual_price_pkr','discount_percent'];
 const changes=Object.fromEntries(Object.entries(req.body||{}).filter(([k])=>allowed.includes(k)));
 if(!Object.keys(changes).length)return res.status(400).json({error:'No changes requested.'});
 if(changes.name!==undefined && (!String(changes.name).trim()||String(changes.name).length>230))return res.status(400).json({error:'Invalid product title.'});
 if(changes.description!==undefined && String(changes.description).length>540)return res.status(400).json({error:'Description too long.'});
 if(changes.category!==undefined && !allCategories.some(c=>c.slug===changes.category&&c.slug!=='discounts'))return res.status(400).json({error:'Choose a valid category.'});
 if(changes.variant!==undefined && (typeof changes.variant!=='string'||changes.variant.length>230))return res.status(400).json({error:'Invalid plan or duration.'});
 if(changes.product_type!==undefined && (typeof changes.product_type!=='string'||changes.product_type.length>50))return res.status(400).json({error:'Invalid account or plan type.'});
 if(changes.status!==undefined && !['pending','published','hidden','rejected'].includes(changes.status))return res.status(400).json({error:'Invalid publishing status.'});
 for(const key of ['featured','unavailable'])if(key in changes&&typeof changes[key]!=='boolean')return res.status(400).json({error:'Invalid boolean field.'});
 if(changes.manual_price_pkr!==undefined && changes.manual_price_pkr!==null && (!Number.isSafeInteger(changes.manual_price_pkr)||changes.manual_price_pkr<1))return res.status(400).json({error:'Invalid price.'});
 if(changes.discount_percent!==undefined && (!Number.isInteger(changes.discount_percent)||changes.discount_percent<0||changes.discount_percent>90))return res.status(400).json({error:'Invalid discount percent.'});
 const current=await supabaseRequest(`ai_tools_catalog?slug=eq.${encodeURIComponent(slug)}&select=status,review_flags&limit=1`);
 if(!current.length)return res.status(404).json({error:'Catalog item not found.'});
 if(changes.status==='published' && (!Array.isArray(current[0].review_flags) || current[0].review_flags.length>0))
   return res.status(409).json({error:'This offer still requires eligibility/resale review. Resolve the review flags before publishing.'});
 if(isDeletedStatus(current[0].status))return res.status(409).json({error:'Restore this product before editing it.'});
 const result=await supabaseRequest(`ai_tools_catalog?slug=eq.${encodeURIComponent(slug)}&select=slug,status`,{method:'PATCH',body:{...changes,updated_at:new Date().toISOString()}});
 if(!result.length)return res.status(404).json({error:'Catalog item not found.'});
 invalidatePublicCatalogCache();
 res.json({ok:true,item:result[0]});
});
api.post('/api/admin/catalog/exchange-rate',requireAdmin,async(req,res)=>{
 const rate=req.body?.usd_to_pkr;
 if(!Number.isSafeInteger(rate)||rate<1||rate>100000)return res.status(400).json({error:'Invalid exchange rate.'});
 await supabaseRequest('ai_tools_catalog_settings?id=eq.1',{method:'PATCH',body:{usd_to_pkr:rate,updated_at:new Date().toISOString()}});
 await supabaseRequest('rpc/ai_tools_reprice_catalog',{method:'POST',body:{}});
 invalidatePublicCatalogCache();
 res.json({ok:true,rate});
});

// ---------- Historical/offline order entries ----------
api.get("/api/admin/manual-orders", requireAdmin, async (req, res) => {
  const db = await load();
  res.json({ entries: (db.manualOrders || []).slice().reverse(), stats: await orderStatsScaled(db) });
});

api.post("/api/admin/manual-orders", requireAdmin, async (req, res) => {
  const date = String(req.body.date || "");
  const count = Number(req.body.count);
  const note = String(req.body.note || "").trim().slice(0, 160);
  const source = String(req.body.source || "Offline");
  const dateObj = new Date(`${date}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(dateObj.getTime()) || dateObj.toISOString().slice(0, 10) !== date || date > pakistanDate() || date < "2000-01-01")
    return res.status(400).json({ error: "Choose a valid past or current date." });
  if (!Number.isInteger(count) || count < 1 || count > 10000)
    return res.status(400).json({ error: "Order count must be between 1 and 10,000." });
  if (!["WhatsApp", "Offline", "Other", "Website", "Website (manual)"].includes(source))
    return res.status(400).json({ error: "Unknown order source." });
  const db = await load();
  (db.manualOrders ||= []).push({ id: crypto.randomBytes(8).toString("hex"), date, count, source, note, createdAt: new Date().toISOString() });
  await save(db);
  res.status(201).json({ ok: true, stats: await orderStatsScaled(db) });
});

api.delete("/api/admin/manual-orders/:id", requireAdmin, async (req, res) => {
  const db = await load();
  const before = (db.manualOrders || []).length;
  db.manualOrders = (db.manualOrders || []).filter((o) => o.id !== req.params.id);
  if (db.manualOrders.length === before) return res.status(404).json({ error: "Entry not found." });
  await save(db);
  res.json({ ok: true, stats: await orderStatsScaled(db) });
});

// ---------- Actual website checkout orders (private admin data) ----------
api.get("/api/admin/website-orders", requireAdmin, async (req, res) => {
  const db = await load();
  // Most recent first. Keep personal customer details restricted to admin access.
  const dedicated = await listDedicatedOrders();
  const legacy = (db.orders || []).slice().reverse().slice(0, 200);
  const orders = [...dedicated, ...legacy]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 200);
  res.json({ orders });
});
api.patch("/api/admin/website-orders/:number", requireAdmin, async (req, res) => {
  const status = String(req.body?.status || "");
  if (!["Pending", "Completed", "Cancelled"].includes(status)) return res.status(400).json({ error: "Invalid order status." });
  if (await updateDedicatedOrder(req.params.number, status)) {
    return res.json({ok:true,number:req.params.number,status});
  }
  const result = await update((db) => {
    const order = (db.orders || []).find((item) => item.number === req.params.number);
    if (!order) return { error: "Order not found." };
    order.status = status;
    return { ok: true, number: order.number, status };
  });
  if (result.error) return res.status(404).json(result);
  res.json(result);
});

// ---------- Purchase numbers for verified product reviews ----------
// Issued only after the admin confirms a sale. Each number is product-bound,
// cannot be guessed from checkout order numbers, and is consumed once.
api.get("/api/admin/purchase-numbers", requireAdmin, async (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json(((await load()).tokens || []).slice().reverse().map(({ token, slug, used, createdAt, orderReference }) =>
    ({ token, slug, used: !!used, createdAt, orderReference: orderReference || "" })));
});
api.post("/api/admin/purchase-numbers", requireAdmin, async (req, res) => {
  const slug = String(req.body.slug || "").trim();
  const orderReference = String(req.body.orderReference || "").trim();
  if (!products.some((p) => p.slug === slug) && !await findPublicVariant(slug)) return res.status(400).json({ error: "Choose the product that was sold." });
  if (orderReference.length > 80) return res.status(400).json({ error: "Order reference is too long." });
  const db = await load();
  let token;
  do {
    const code = crypto.randomBytes(9).toString("hex").toUpperCase();
    token = `PAK-${code.slice(0, 9)}-${code.slice(9)}`;
  } while ((db.tokens || []).some((entry) => entry.token === token));
  const entry = { token, slug, used: false, createdAt: new Date().toISOString(), orderReference };
  (db.tokens ||= []).push(entry);
  await save(db);
  res.status(201).set("Cache-Control", "no-store").json({ ok: true, entry });
});
api.delete("/api/admin/purchase-numbers/:token", requireAdmin, async (req, res) => {
  const db = await load();
  const token = String(req.params.token).toUpperCase();
  const item = (db.tokens || []).find((entry) => entry.token === token);
  if (!item) return res.status(404).json({ error: "Purchase number not found." });
  if (item.used) return res.status(409).json({ error: "Used purchase numbers cannot be revoked." });
  db.tokens = db.tokens.filter((entry) => entry.token !== token);
  await save(db);
  res.json({ ok: true });
});

// Admin-entered reviews must reflect authentic customer feedback.
// Even when recorded from a website interaction, public cards disclose manual entry.
api.get("/api/admin/reviews", requireAdmin, async (req, res) => {
  res.json(((await load()).reviews || []).slice().reverse());
});
api.post("/api/admin/reviews", requireAdmin, async (req, res) => {
  const review = cleanReview(req.body || {});
  if (review.error || (review.slug.startsWith("import-") && !await findPublicVariant(review.slug))) return res.status(400).json({ error: review.error || "Product not available." });
  const date = String(req.body.date || pakistanDate());
  const dateObj = new Date(`${date}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(dateObj.getTime()) || dateObj.toISOString().slice(0, 10) !== date || date > pakistanDate())
    return res.status(400).json({ error: "Choose a valid review date." });
  const source = String(req.body.source || "imported");
  if (!["imported", "whatsapp", "offline", "website_admin"].includes(source))
    return res.status(400).json({ error: "Choose a valid feedback source." });
  const db = await load();
  // All admin-entered feedback is recorded as store-entered, not a verified
  // website purchase. Purchase numbers are only required/used by visitors.
  (db.reviews ||= []).push({ ...review, id: crypto.randomBytes(8).toString("hex"), date: dateObj.toISOString(), source, verified: false });
  await save(db);
  res.status(201).json({ ok: true });
});
// Admin may correct the *recorded source* of store-entered feedback.
// A review posted by a verified visitor must always retain its real source.
api.patch("/api/admin/reviews/:id/source", requireAdmin, async (req, res) => {
  const source = String(req.body?.source || "");
  if (!["imported", "website_admin", "whatsapp", "offline"].includes(source))
    return res.status(400).json({ error: "Choose a valid review source." });
  const db = await load();
  const review = (db.reviews || []).find((r) => r.id === req.params.id);
  if (!review) return res.status(404).json({ error: "Review not found." });
  if (review.source === "customer" || review.verified === true)
    return res.status(403).json({ error: "Customer-submitted reviews cannot be relabeled by the store." });
  review.source = source;
  review.verified = false;
  await save(db);
  res.json({ ok: true, source: review.source });
});

api.delete("/api/admin/reviews/:id", requireAdmin, async (req, res) => {
  const db = await load();
  const before = (db.reviews || []).length;
  db.reviews = (db.reviews || []).filter((r) => r.id !== req.params.id);
  if (db.reviews.length === before) return res.status(404).json({ error: "Review not found. Older reviews without an ID cannot be deleted here." });
  await save(db);
  res.json({ ok: true });
});

// Emails the customer if they gave an email and SMTP settings exist in .env. Returns true if sent.
async function sendAnswerEmail(q) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM } = process.env;
  if (!q.email || !SMTP_HOST) return false;
  try {
    const { default: nodemailer } = await import("nodemailer");
    const transport = nodemailer.createTransport({ host: SMTP_HOST, port: Number(SMTP_PORT) || 587, secure: Number(SMTP_PORT) === 465, auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined });
    await transport.sendMail({ from: MAIL_FROM || SMTP_USER, to: q.email, subject: `${brand.name}: your question has been answered`, text: `Hello ${q.name},\n\nYou asked: ${q.question}\n\nOur answer: ${q.answer}\n\nThank you,\n${brand.name}` });
    return true;
  } catch (error) {
    console.log("Could not send email:", error.message);
    return false;
  }
}

api.get("/api/admin/questions", requireAdmin, async (req, res) => res.json(((await load()).questions || []).slice().reverse()));

api.post("/api/admin/questions/:id/answer", requireAdmin, async (req, res) => {
  const db = await load();
  const q = (db.questions || []).find((item) => item.id === req.params.id);
  const answer = String(req.body.answer || "").trim().slice(0, 2000);
  if (!q || !answer) return res.status(400).json({ error: "Question not found, or the answer is empty." });
  q.answer = answer;
  q.answeredAt = new Date().toISOString();
  await save(db);
  res.json({ ok: true, emailed: await sendAnswerEmail(q) });
});

// Admin may curate answered questions for the public FAQ. Such entries are
// clearly labeled as store-published; "named" requires customer consent.
api.post("/api/admin/questions/:id/publish", requireAdmin, async (req, res) => {
  const db = await load();
  const q = (db.questions || []).find((item) => item.id === req.params.id);
  if (!q) return res.status(404).json({ error: "Question not found." });
  const mode = req.body.mode;
  if (mode === "unpublish") {
    q.published = false;
    q.publishedAt = null;
    q.publishedBy = null;
    await save(db);
    return res.json({ ok: true, published: false });
  }
  if (!q.answer) return res.status(400).json({ error: "Answer this question before publishing." });
  if (!["named", "anonymous"].includes(mode)) return res.status(400).json({ error: "Choose a publication option." });
  if (mode === "named" && req.body.customerConsented !== true)
    return res.status(400).json({ error: "Confirm that the customer consented to publishing their name." });
  q.published = true;
  q.displayName = mode === "named" ? q.name : "Anonymous";
  q.publishedAt = new Date().toISOString();
  q.publishedBy = "store";
  await save(db);
  res.json({ ok: true, published: true, displayName: q.displayName, publishedBy: "store" });
});

api.delete("/api/admin/questions/:id", requireAdmin, async (req, res) => {
  const db = await load();
  db.questions = (db.questions || []).filter((item) => item.id !== req.params.id);
  await save(db);
  res.json({ ok: true });
});

// ---------- Product detail editor (prices and identity remain separate) ----------
const activeProductDetails = (db) => db.productDetails && typeof db.productDetails === "object" && !Array.isArray(db.productDetails) ? db.productDetails : {};
const liveProduct = (db, slug) => {
  const product = products.find((p) => p.slug === slug);
  return product ? applyProductDetails(product, activeProductDetails(db)[slug]) : null;
};
api.get("/api/product-details", async (req, res) => {
  const db = await loadPublicState();
  cachePublicResponse(res, 15, 15).json({ details: activeProductDetails(db), deletedProducts: deletedOriginalSlugs(db) });
});
api.get("/api/admin/product-details", requireAdmin, async (req, res) => res.json({ details: activeProductDetails(await load()) }));
api.post("/api/admin/product-details", requireAdmin, async (req, res) => {
  const slug = String(req.body?.slug || "").trim();
  const original = products.find((p) => p.slug === slug);
  if (!original) return res.status(400).json({ error: "Unknown product." });
  const entry = req.body?.details;
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return res.status(400).json({ error: "Enter product details." });
  const requiredText = (key, max) => typeof entry[key] === "string" && entry[key].trim().length > 0 && entry[key].trim().length <= max;
  const optionalText = (key, max) => typeof entry[key] === "string" && entry[key].length <= max;
  if (!requiredText("name", 100) || !requiredText("description", 1500) ||
      !["duration", "limit", "type", "delivery", "terms"].every((k) => optionalText(k, 1200)) ||
      !allCategories.some((c) => c.slug === entry.category && c.slug !== "discounts") ||
      typeof entry.popular !== "boolean" ||
      !Array.isArray(entry.months) || entry.months.length > 12 || !entry.months.every((n) => Number.isInteger(n) && n >= 1 && n <= 120) ||
      !Array.isArray(entry.features) || entry.features.length > 12 || !entry.features.every((line) => typeof line === "string" && line.trim().length >= 1 && line.length <= 250))
    return res.status(400).json({ error: "Check the name, category, description, duration, feature list and other product fields." });
  const oldOptions = original.options || [];
  if (!Array.isArray(entry.optionLabels) || entry.optionLabels.length !== oldOptions.length ||
      entry.optionLabels.some((label) => typeof label !== "string" || label.trim().length < 1 || label.trim().length > 80) ||
      new Set(entry.optionLabels.map((label) => label.trim().toLowerCase())).size !== entry.optionLabels.length)
    return res.status(400).json({ error: "Enter a unique name for each existing plan. Use Edit prices to change the cost." });
  const changes = {
    name: entry.name.trim(), description: entry.description.trim(), category: entry.category,
    duration: entry.duration.trim(), limit: entry.limit.trim(), type: entry.type.trim(),
    delivery: entry.delivery.trim(), terms: entry.terms.trim(), popular: entry.popular,
    months: [...new Set(entry.months)].sort((a, b) => a - b),
    features: entry.features.map((line) => line.trim()),
    optionLabels: entry.optionLabels.map((label) => label.trim()),
  };
  // Never accept arbitrary keys such as price, slug, stock or ratings from the browser.
  const db = await load();
  db.productDetails ||= {};
  db.productDetails[slug] = changes;
  await save(db);
  res.json({ ok: true, details: db.productDetails });
});
api.delete("/api/admin/product-details/:slug", requireAdmin, async (req, res) => {
  if (!products.some((p) => p.slug === req.params.slug)) return res.status(404).json({ error: "Unknown product." });
  const db = await load();
  db.productDetails ||= {};
  delete db.productDetails[req.params.slug];
  await save(db);
  res.json({ ok: true, details: db.productDetails });
});

// ---------- Discounts: persisted and controlled by authenticated admin ----------
// type "percent" = percentage off every plan; type "amount" = rupees off each plan.
const activeDiscounts = (db) => db.discounts && typeof db.discounts === "object" && !Array.isArray(db.discounts) ? db.discounts : {};
const activePrices = (db) => db.priceOverrides && typeof db.priceOverrides === "object" && !Array.isArray(db.priceOverrides) ? db.priceOverrides : {};
const MAX_REGULAR_PRICE = 10000000;
const validRegularPrice = (n) => typeof n === "number" && Number.isSafeInteger(n) && n >= 1 && n <= MAX_REGULAR_PRICE;
const fixedDiscountError = (db, product, proposed) => {
  const discount = activeDiscounts(db)[product.slug];
  if (discount?.type !== "amount") return null;
  const min = regularPrice(product, null, { ...activePrices(db), [product.slug]: proposed });
  return discount.value >= min ? `Remove or reduce the Rs. ${discount.value} fixed discount first. Each regular price must exceed the discount.` : null;
};
// Saved separately: editing prices does not change built-in product data or historical orders.
api.get("/api/admin/prices", requireAdmin, async (req, res) => res.json({ prices: activePrices(await load()) }));
api.post("/api/admin/prices", requireAdmin, async (req, res) => {
  const slug = String(req.body?.slug || "").trim();
  const product = products.find((p) => p.slug === slug);
  if (!product) return res.status(400).json({ error: "Select a valid product." });
  let proposed;
  if (product.options?.length) {
    const entered = req.body?.options;
    if (!entered || typeof entered !== "object" || Array.isArray(entered) ||
        Object.keys(entered).length !== product.options.length ||
        product.options.some((o) => !validRegularPrice(entered[o.label])))
      return res.status(400).json({ error: "Enter a valid whole-rupee price for every plan (Rs. 1 to 10,000,000)." });
    proposed = { options: Object.fromEntries(product.options.map((o) => [o.label, entered[o.label]])) };
  } else {
    if (!validRegularPrice(req.body?.price)) return res.status(400).json({ error: "Enter a whole-rupee price from Rs. 1 to 10,000,000." });
    proposed = { price: req.body.price };
  }
  const db = await load();
  const conflict = fixedDiscountError(db, product, proposed);
  if (conflict) return res.status(400).json({ error: conflict });
  db.priceOverrides ||= {};
  db.priceOverrides[slug] = proposed;
  await save(db);
  res.json({ ok: true, prices: db.priceOverrides });
});
api.delete("/api/admin/prices/:slug", requireAdmin, async (req, res) => {
  const product = products.find((p) => p.slug === req.params.slug);
  if (!product) return res.status(400).json({ error: "Unknown product." });
  const db = await load();
  const conflict = fixedDiscountError(db, product, product.options?.length ?
    { options: Object.fromEntries(product.options.map((o) => [o.label, o.price])) } : { price: product.price });
  if (conflict) return res.status(400).json({ error: conflict });
  db.priceOverrides ||= {};
  delete db.priceOverrides[product.slug];
  await save(db);
  res.json({ ok: true, prices: db.priceOverrides });
});
api.get("/api/discounts", async (req, res) => {
  const db = await loadPublicState();
  cachePublicResponse(res, 10, 10).json({ discounts: activeDiscounts(db), prices: activePrices(db) });
});
api.get("/api/admin/discounts", requireAdmin, async (req, res) => res.json({ discounts: activeDiscounts(await load()) }));
api.post("/api/admin/discounts", requireAdmin, async (req, res) => {
  const slug = String(req.body?.slug || "").trim();
  const product = products.find((p) => p.slug === slug);
  if (!product) return res.status(400).json({ error: "Select a valid product." });
  const type = req.body.type;
  const value = Number(req.body.value);
  const db = await load();
  const lowest = regularPrice(product, null, activePrices(db));
  if (!["percent", "amount"].includes(type) || !Number.isFinite(value) || value <= 0 ||
      (type === "percent" && (value >= 100 || !Number.isInteger(value))) ||
      (type === "amount" && (!Number.isInteger(value) || value >= lowest)))
    return res.status(400).json({ error: type === "amount" ? `Discount must be whole rupees between 1 and ${lowest - 1}.` : "Enter a whole percentage from 1 to 99." });
  db.discounts ||= {};
  db.discounts[slug] = { type, value };
  await save(db);
  res.json({ ok: true, discounts: db.discounts });
});
api.delete("/api/admin/discounts/:slug", requireAdmin, async (req, res) => {
  const slug = String(req.params.slug);
  if (!products.some((p) => p.slug === slug)) return res.status(400).json({ error: "Unknown product." });
  const db = await load();
  db.discounts ||= {};
  delete db.discounts[slug];
  await save(db);
  res.json({ ok: true, discounts: db.discounts });
});

// ---------- Stock (the admin marks products Available or Out of stock) ----------
api.get("/api/stock", async (req, res) => cachePublicResponse(res, 10, 10).json({ outOfStock: (await loadPublicState()).outOfStock || [] }));

api.post("/api/admin/stock", requireAdmin, async (req, res) => {
  const { slug, available } = req.body;
  if (!products.some((p) => p.slug === slug)) return res.status(400).json({ error: "Unknown product." });
  const db = await load();
  const out = new Set(db.outOfStock || []);
  if (available) out.delete(slug); else out.add(slug);
  db.outOfStock = [...out];
  await save(db);
  res.json({ outOfStock: db.outOfStock });
});

// Price always comes from the server's own product list, never from the browser
const lineFor = (item, discounts, prices, details = {}, imported = new Map()) => {
  if(imported.has(String(item.key||"").split("|")[0])) {
    const p=imported.get(String(item.key||"").split("|")[0]);
    return {slug:p.slug,name:p.name,label:p.variant,originalPrice:p.price,price:p.finalPrice,qty:Math.min(Math.max(parseInt(item.qty)||1,1),20)};
  }
  const [slug, label] = String(item.key || "").split("|");
  const base = products.find((p) => p.slug === slug);
  const product = base ? applyProductDetails(base, details[slug]) : null;
  const option = product?.options?.find((o) => (o.key || o.label) === label || o.label === label);
  if (!product || (product.options && !option)) return null;
  const price = regularPrice(product, option, prices);
  if (!validRegularPrice(price)) return null;
  return { slug, name: product.name, label: option?.label || label || product.duration || "", originalPrice: price, price: salePrice(price, discounts[slug]), qty: Math.min(Math.max(parseInt(item.qty) || 1, 1), 20) };
};

api.post("/api/orders", async (req, res) => {
  const { customer = {}, items } = req.body || {};
  const text = (value, max) => String(value || "").trim().slice(0, max);
  const clean = { name: text(customer?.name, 80), email: text(customer?.email, 120), whatsapp: text(customer?.whatsapp, 30), payment: text(customer?.payment, 30), notes: text(customer?.notes, 500) };
  if (!clean.name || !clean.email || !clean.whatsapp || !/^\S+@\S+\.\S+$/.test(clean.email)) return res.status(400).json({ error: "Enter your name, a valid email, and your WhatsApp number." });

  // A retry after a lost response must not create a second charge/order.
  const idempotencyKey = String(req.get("x-idempotency-key") || "");
  if (idempotencyKey && !/^[a-f0-9-]{36}$/i.test(idempotencyKey))
    return res.status(400).json({ error: "Invalid order request ID." });
  const importSlugs = [...new Set((Array.isArray(items) ? items : []).map(i=>String(i?.key||'').split('|')[0]).filter(slug=>slug.startsWith('import-')))];
  const imported = new Map();
  for(const slug of importSlugs){const p=await findPublicVariant(slug);if(p)imported.set(slug,p);}
  if (usingOrderTable()) {
    // Always re-check live product rules before an order insert. Do NOT use
    // cached catalogue or browser-submitted prices for checkout.
    const db = await load();
    // During rollout, a retry of an order created by the legacy writer must
    // return its original number, not create another row in the new table.
    const previousLegacyOrder = idempotencyKey && (db.orders || []).find(o => o.idempotencyKey === idempotencyKey);
    if (previousLegacyOrder) return res.json({order:{number:previousLegacyOrder.number,total:previousLegacyOrder.total}});
    const validItems = Array.isArray(items) && items.length > 0 && items.length <= 20 &&
      items.every(item => item && typeof item === 'object');
    const lines = validItems
      ? items.map(item => lineFor(item, activeDiscounts(db), activePrices(db), activeProductDetails(db), imported)) : [];
    if (!lines.length || lines.includes(null)) return res.status(400).json({error:'Your cart is empty or has an unknown product.'});
    const soldOut = lines.find(line => (db.outOfStock || []).includes(line.slug) || imported.get(line.slug)?.unavailable);
    if (soldOut) return res.status(400).json({error:`${soldOut.name} is currently out of stock. Please remove it from your cart.`});
    const removed = lines.find(line => isDeletedOriginal(db, line.slug));
    if (removed) return res.status(400).json({error:`${removed.name} is no longer listed. Please remove it from your cart.`});
    const total = lines.reduce((sum, line) => sum + line.price * line.qty, 0);
    const order = await placeDedicatedOrder({idempotencyKey,customer:clean,items:lines,total});
    return res.json({order});
  }
  const result = await update((db) => {
    const prior = idempotencyKey && (db.orders || []).find((o) => o.idempotencyKey === idempotencyKey);
    if (prior) return { prior: true, order: { number: prior.number, total: prior.total } };
    const lines = Array.isArray(items) && items.length > 0 && items.length <= 20 && items.every((item) => item && typeof item === "object")
      ? items.map((item) => lineFor(item, activeDiscounts(db), activePrices(db), activeProductDetails(db), imported)) : [];
    if (!lines.length || lines.includes(null)) return { error: "Your cart is empty or has an unknown product." };
    const soldOut = lines.find((l) => (db.outOfStock || []).includes(l.slug) || imported.get(l.slug)?.unavailable);
    if (soldOut) return { error: `${soldOut.name} is currently out of stock. Please remove it from your cart.` };
    const removed = lines.find(line => isDeletedOriginal(db, line.slug));
    if (removed) return {error:`${removed.name} is no longer listed. Please remove it from your cart.`};
    db.orders ||= [];
    let number;
    do number = `AIT-${crypto.randomInt(100000, 1000000)}`; while (db.orders.some((o) => o.number === number));
    const order = { number, idempotencyKey, date: new Date().toISOString(), status: "Pending", customer: clean, items: lines,
      total: lines.reduce((sum, l) => sum + l.price * l.qty, 0) };
    db.orders.push(order);
    return { order: { number: order.number, total: order.total } };
  });
  if (result.error) return res.status(400).json(result);
  res.json({ order: result.order });
});

// In production this one server also serves the built website (after "npm run build")
app.use("/api", (req, res) => res.status(404).json({ error: "API endpoint not found." }));
if (!process.env.VERCEL && !process.env.CLOUDFLARE_WORKER) {
  try {
    const dist = fileURLToPath(new URL("../dist/", import.meta.url));
    if (fs.existsSync(dist)) {
      app.use("/assets", express.static(path.join(dist, "assets"), { maxAge: "1y", immutable: true })); // file names change when content changes
      app.use(express.static(dist, { redirect: false, index: false, maxAge: "1d" }));
  // Each URL has its own pre-rendered file (dist/product/gemini-pro/index.html). Unknown URLs get a real 404 status.
  api.get("*", async (req, res) => {
    const page = path.resolve(dist, "." + req.path, "index.html");
    if (page.startsWith(dist) && fs.existsSync(page)) {
      let html = fs.readFileSync(page, "utf8");
      // Keep the search-engine data honest: out-of-stock products are reported as such
      const slug = req.path.match(/^\/product\/([^/]+)\/?$/)?.[1];
      if (slug && products.some(p => p.slug === slug) && isDeletedOriginal(await load(), slug)) {
        return res.status(404).type('text/plain').send('This product is no longer listed.');
      }
      if (slug) {
        const db = await load();
        if ((db.outOfStock || []).includes(slug)) html = html.replaceAll("https://schema.org/InStock", "https://schema.org/OutOfStock");
        const product = isDeletedOriginal(db, slug) ? null : liveProduct(db, slug);
        const discount = activeDiscounts(db)[slug];
        if (product) {
          const escapeMeta = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
          const title = `Buy ${product.name} in Pakistan | ${brand.name}`;
          const description = `${product.description} Order online with support on WhatsApp.`;
          html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeMeta(title)}</title>`)
            .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${escapeMeta(description)}" />`)
            .replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${escapeMeta(title)}" />`)
            .replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${escapeMeta(description)}" />`);
        }
        // Keep Product structured data aligned with the live promotion for search crawlers.
        if (product) html = html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, (markup, json) => {
          try {
            const doc = JSON.parse(json);
            const schema = doc["@graph"]?.find((item) => item["@type"] === "Product");
            if (!schema?.offers) return markup;
            schema.name = product.name;
            schema.description = product.description;
            const prices = (product.options || [null]).map((o) => salePrice(regularPrice(product, o, activePrices(db)), discount));
            if (product.options) {
              schema.offers.lowPrice = Math.min(...prices);
              schema.offers.highPrice = Math.max(...prices);
            } else schema.offers.price = prices[0];
            return `<script type="application/ld+json">${JSON.stringify(doc).replace(/</g, "\\u003c")}</script>`;
          } catch { return markup; }
        });
      }
      return res.type("html").set("Cache-Control", "no-cache").send(html);
    }
    res.status(404).sendFile(path.join(dist, "index.html"));
    });
  }
} catch {}
}

app.use((err, req, res, next) => {
  const status = Number.isInteger(err?.status) && err.status >= 400 && err.status < 600 ? err.status : 500;
  console.error("API error:", err?.message || "Unexpected failure");
  if (!res.headersSent) res.status(status).json({ error: status === 500 ? "Server error. Please try again." : err.message });
});

export default app;
if (!process.env.VERCEL && !process.env.CLOUDFLARE_WORKER && process.env.NODE_ENV !== "test") {
  const port = process.env.PORT || 5000;
  app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
}
