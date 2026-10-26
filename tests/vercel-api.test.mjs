import test, { after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";

const config = JSON.parse(fs.readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
test("Vercel deploy config includes serverless API and both dependency installs", () => {
  assert.equal(config.framework, "vite");
  assert.equal(config.outputDirectory, "dist");
  assert.match(config.installCommand, /npm --prefix server ci/);
  assert.ok(config.rewrites.some((r) => r.source.startsWith("/api/") && r.destination === "/api/index"));
});

// Simulates Supabase REST/PostgREST semantics offline, including atomic SQL RPC.
const database = {
  revision: 0,
  payload: { clicks: [], tokens: [], reviews: [], orders: [], questions: [] },
};
const failures = new Map();
const badKey = "bad-secret-test";
const secret = "sb_secret_test_only";
let forceMissingSchema = false;
const supabase = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  let input = "";
  for await (const chunk of req) input += chunk;
  const body = input ? JSON.parse(input) : {};
  const reply = (status, data) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  };
  if (req.headers.apikey !== secret || req.headers.authorization) return reply(401, { message: "bad key" });
  if (forceMissingSchema) return reply(404, { message: "schema missing" });
  if (req.method === "GET" && url.pathname === "/rest/v1/ai_tools_state")
    return reply(200, [{ revision: database.revision, payload: structuredClone(database.payload) }]);
  if (req.method === "POST" && url.pathname === "/rest/v1/rpc/ai_tools_compare_and_save") {
    if (Number(body.expected_revision) !== database.revision) return reply(200, false);
    database.revision++;
    database.payload = structuredClone(body.next_payload);
    return reply(200, true);
  }
  if (req.method === "POST" && url.pathname === "/rest/v1/rpc/ai_tools_admin_attempt") {
    let count = failures.get(body.p_ip_hash) || 0;
    if (body.p_failed) { count++; failures.set(body.p_ip_hash, count); }
    return reply(200, count);
  }
  return reply(404, { message: "unknown endpoint" });
});
await new Promise((resolve) => supabase.listen(0, "127.0.0.1", resolve));

process.env.VERCEL = "1";
process.env.SUPABASE_URL = `https://test.supabase.co`;
process.env.SUPABASE_SECRET_KEY = secret;
process.env.ADMIN_PASSWORD = "test_admin_secure_password_2026";
process.env.NODE_ENV = "test";

// Fetch intercept only the fake Supabase project, so no internet is required.
const realFetch = globalThis.fetch;
globalThis.fetch = (url, options) => {
  const u = String(url);
  if (u.startsWith("https://test.supabase.co/"))
    return realFetch(`http://127.0.0.1:${supabase.address().port}${new URL(u).pathname}${new URL(u).search}`, options);
  return realFetch(url, options);
};

const { default: app } = await import("../api/index.js");
const appServer = app.listen(0, "127.0.0.1");
await new Promise((resolve) => appServer.once("listening", resolve));
const endpoint = `http://127.0.0.1:${appServer.address().port}`;
const admin = { "Content-Type": "application/json", "x-admin-password": process.env.ADMIN_PASSWORD };
const request = async (url, options = {}) => {
  const resp = await realFetch(endpoint + url, options);
  return { status: resp.status, data: await resp.json() };
};

test("Vercel API uses Supabase persistent database", async () => {
  const health = await request("/api/health");
  assert.equal(health.status, 200);
  assert.equal(health.data.storage, "supabase");
  assert.equal((await request("/api/discounts")).status, 200);
  assert.equal((await request("/api/admin/questions", { headers: admin })).status, 200);
});

test("Checkout persists and retry doesn't create a second order", async () => {
  const headers = { "Content-Type": "application/json", "x-idempotency-key": "ddddeeee-eeee-4aaa-8bbb-ccccddddeeee" };
  const body = JSON.stringify({ customer: { name: "Sample Buyer", email: "customer@example.com", whatsapp: "03001234567" }, items: [{ key: "gemini-pro", qty: 1 }] });
  const a = await request("/api/orders", { method: "POST", headers, body });
  assert.equal(a.status, 200, JSON.stringify(a));
  const b = await request("/api/orders", { method: "POST", headers, body });
  assert.equal(b.status, 200);
  assert.deepEqual(a.data, b.data);
  assert.equal((await request("/api/health")).data.orders, 1);
  const orders = await request("/api/admin/website-orders", { headers: admin });
  assert.equal(orders.data.orders.length, 1);
  assert.equal(orders.data.orders[0].customer.name, "Sample Buyer");
  const complete = await request(`/api/admin/website-orders/${orders.data.orders[0].number}`, {
    method: "PATCH", headers: admin, body: JSON.stringify({ status: "Completed" }),
  });
  assert.equal(complete.status, 200);
  assert.equal((await request("/api/admin/website-orders", { headers: admin })).data.orders[0].status, "Completed");
});

test("Simultaneous checkout requests do not overwrite orders", async () => {
  const body = JSON.stringify({ customer: { name: "Buyer", email: "buyer@example.com", whatsapp: "03001234567" }, items: [{ key: "gemini-pro", qty: 1 }] });
  const jobs = [0, 1, 2, 3, 4].map((i) => request("/api/orders", {
    method: "POST", headers: { "Content-Type": "application/json", "x-idempotency-key": `99999999-9999-4999-8999-${String(i).padStart(12, "0")}` }, body,
  }));
  const results = await Promise.all(jobs);
  assert.ok(results.every((r) => r.status === 200), JSON.stringify(results));
  assert.equal((await request("/api/health")).data.orders, 6);
});

test("Admin settings persist and require password", async () => {
  const unauthorized = await request("/api/admin/prices", { headers: { "x-admin-password": "wrong" } });
  assert.equal(unauthorized.status, 401);
  const changed = await request("/api/admin/prices", { method: "POST", headers: admin,
    body: JSON.stringify({ slug: "gemini-pro", price: 1250 }) });
  assert.equal(changed.status, 200, JSON.stringify(changed));
  assert.equal((await request("/api/discounts")).data.prices["gemini-pro"].price, 1250);
});

test("Supabase key and SQL setup failures fail closed, without losing orders", async () => {
  delete process.env.SUPABASE_SECRET_KEY;
  const missingKey = await request("/api/health");
  assert.equal(missingKey.status, 503);
  assert.match(missingKey.data.error, /Supabase/i);
  process.env.SUPABASE_SECRET_KEY = badKey;
  const invalidKey = await request("/api/health");
  assert.equal(invalidKey.status, 503);
  process.env.SUPABASE_SECRET_KEY = secret;
  forceMissingSchema = true;
  const missingSchema = await request("/api/health");
  assert.equal(missingSchema.status, 503);
  assert.match(missingSchema.data.error, /schema.sql/);
  forceMissingSchema = false;
  assert.equal((await request("/api/health")).data.orders, 6);
});

const sql = fs.readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
test("SQL initializes private RLS tables and atomic compare-and-save function", () => {
  assert.match(sql, /create table if not exists public\.ai_tools_state/);
  assert.match(sql, /alter table public\.ai_tools_state enable row level security/);
  assert.match(sql, /revoke all on function public\.ai_tools_compare_and_save/);
  assert.match(sql, /where id = 1 and revision = expected_revision/);
});

after(async () => {
  globalThis.fetch = realFetch;
  await Promise.all([
    new Promise((resolve) => appServer.close(resolve)),
    new Promise((resolve) => supabase.close(resolve)),
  ]);
});
