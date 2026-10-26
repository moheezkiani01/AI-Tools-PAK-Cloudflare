// Local development: private JSON file. Production: Supabase PostgreSQL JSONB row.
// A database-side compare-and-save function prevents lost updates on Vercel.
import fs from "node:fs";
import crypto from "node:crypto";
import { createRefreshAheadCache } from "./refreshAheadCache.js";

const DB_FILE = (() => {
  try { return new URL("./db.json", import.meta.url); } catch { return null; }
})();
const versions = new WeakMap();
const empty = () => ({ clicks: [], tokens: [], reviews: [], orders: [], questions: [], deletedProducts: [] });

export class StoreError extends Error {
  constructor(message, status = 503) { super(message); this.status = status; }
}

const isVercel = () => Boolean(process.env.VERCEL);
const isCloudflare = () => Boolean(process.env.CLOUDFLARE_WORKER);
const isHosted = () => isVercel() || isCloudflare();
const hasSupabase = () => Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
const storageReady = () => {
  const oneProvided = Boolean(process.env.SUPABASE_URL) !== Boolean(process.env.SUPABASE_SECRET_KEY);
  if (oneProvided || (isHosted() && !hasSupabase())) {
    throw new StoreError("Supabase is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY in your hosting environment and redeploy.");
  }
  if (hasSupabase() && !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(process.env.SUPABASE_URL)) {
    throw new StoreError("SUPABASE_URL must be your project's https://PROJECT.supabase.co URL.");
  }
};

// This uses the current sb_secret_ format (server ONLY, never prefixed VITE_).
// Supabase's new secret keys go in the apikey header, NOT Authorization: Bearer.
export async function supabaseRequest(path, { method = "GET", body, count = false } = {}) {
  storageReady();
  if (!hasSupabase()) throw new StoreError("Supabase is not configured.");
  let response;
  try {
    response = await fetch(`${process.env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: process.env.SUPABASE_SECRET_KEY,
        "Content-Type": "application/json",
        Prefer: count ? "return=representation,count=exact" : "return=representation",
        Accept: "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(10000),
    });
  } catch { throw new StoreError("Supabase could not be reached. Check the project status and connection."); }
  if (!response.ok) {
    const setup = response.status === 404 ? " Run supabase/schema.sql in Supabase SQL Editor." : " Check the Supabase project URL, key, and SQL setup.";
    throw new StoreError(`Supabase database request failed (HTTP ${response.status}).${setup}`);
  }
  const result = await response.json().catch(() => undefined);
  if (result === undefined) throw new StoreError("Supabase returned an unreadable response.");
  if (count) {
    const contentRange = response.headers.get("content-range") || "";
    const match = contentRange.match(/\/(\d+)$/);
    // A missing count is not zero; the caller needs to handle it explicitly.
    return { data: result, count: match ? Number(match[1]) : null };
  }
  return result;
}

// Public-only shop state can refresh just ahead of its two-second TTL.
// Checkout, admin and writes still use load() and bypass this cache entirely.
// All cache results are read-only for callers. Admin saves invalidate the
// cache; expired snapshots are never returned after their freshness limit.
const publicStateCache = createRefreshAheadCache(load, {
  ttlMs: 2_000, refreshAheadMs: 450,
});
export function loadPublicState() { return publicStateCache.get(); }
export function invalidatePublicStateCache() { publicStateCache.invalidate(); }

export async function load() {
  storageReady();
  let db;
  let revision = 0;
  if (hasSupabase()) {
    const rows = await supabaseRequest("ai_tools_state?select=revision,payload&id=eq.1");
    if (!Array.isArray(rows) || rows.length !== 1) {
      throw new StoreError("Supabase database is not initialized. Run supabase/schema.sql in SQL Editor.");
    }
    revision = Number(rows[0].revision);
    db = rows[0].payload;
  } else {
    try { db = DB_FILE && fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE, "utf8")) : empty(); }
    catch { throw new StoreError("Local database could not be read. Make a backup before changing it."); }
    revision = Number(db?._revision || 0);
  }
  if (!db || typeof db !== "object" || Array.isArray(db) || !Number.isSafeInteger(revision) || revision < 0) {
    throw new StoreError("Stored data is invalid. Do not overwrite it; restore a backup.");
  }
  // Existing handlers expect these arrays to exist (initial schema supplies {}).
  for (const field of ["clicks", "tokens", "reviews", "orders", "questions"]) db[field] ||= [];
  versions.set(db, revision);
  return db;
}

export async function save(db) {
  storageReady();
  const revision = versions.get(db);
  if (!Number.isSafeInteger(revision)) throw new StoreError("Reload the data before changing it.", 409);
  const next = { ...db, _revision: revision + 1 };
  if (hasSupabase()) {
    // SQL function does UPDATE ... WHERE revision = expected_revision atomically.
    const saved = await supabaseRequest("rpc/ai_tools_compare_and_save", {
      method: "POST", body: { expected_revision: revision, next_payload: next },
    });
    if (saved !== true) throw new StoreError("The data changed while saving. Please retry your action.", 409);
  } else {
    const current = DB_FILE && fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE, "utf8")) : empty();
    if (Number(current._revision || 0) !== revision) throw new StoreError("Another change was saved first. Please retry.", 409);
    let temp = null;
    try {
      temp = new URL(`./.db-${crypto.randomBytes(6).toString("hex")}.tmp`, import.meta.url);
    } catch {
      temp = null;
    }
    try {
      if (temp && DB_FILE) {
        fs.writeFileSync(temp, JSON.stringify(next, null, 2), { mode: 0o600 });
        fs.renameSync(temp, DB_FILE);
      }
    }
    finally { if (temp && fs.existsSync(temp)) fs.unlinkSync(temp); }
  }
  versions.set(db, revision + 1);
  invalidatePublicStateCache();
}

// Checkout, verified reviews and other multi-step updates replay after a write conflict.
export async function update(mutator, retries = 10) {
  for (let attempt = 0; attempt < retries; attempt++) {
    const db = await load();
    const result = mutator(db);
    if (result?.error || result?.prior) return result;
    try { await save(db); return result; }
    catch (err) {
      if (err.status !== 409 || attempt === retries - 1) throw err;
      await new Promise((resolve) => setTimeout(resolve, Math.min(attempt * 12, 60)));
    }
  }
}

// Shared login lockouts (not process-local) even when Vercel creates multiple functions.
export async function adminFailureCount(ipHash, failed = false) {
  if (!hasSupabase()) return null; // Local server uses its small in-memory rate limiter.
  const result = await supabaseRequest("rpc/ai_tools_admin_attempt", {
    method: "POST", body: { p_ip_hash: ipHash, p_failed: failed },
  });
  if (!Number.isInteger(result) || result < 0) throw new StoreError("Could not verify admin login limits.");
  return result;
}

export const databaseMode = () => (hasSupabase() ? "supabase" : isHosted() ? "not-configured" : "local-json");
