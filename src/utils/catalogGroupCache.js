// Only public catalogue group summaries are cached. Never store supplier costs,
// admin data, or customer records here. This cache is per-browser tab.
export const CATALOG_GROUP_CACHE_KEY = 'ai-tools-pak:catalog-groups:v2';
export const CATALOG_GROUP_CACHE_MS = 90_000;

export function readCachedCatalogGroups(storage, now = Date.now()) {
  if (!storage) return null;
  try {
    const raw = storage.getItem(CATALOG_GROUP_CACHE_KEY);
    if (!raw) return null;
    const payload = JSON.parse(raw);
    if (!Number.isFinite(payload?.time) || now - payload.time > CATALOG_GROUP_CACHE_MS || now < payload.time || !Array.isArray(payload.groups)) return null;
    return payload.groups;
  } catch { return null; }
}

export function writeCachedCatalogGroups(storage, groups, now = Date.now()) {
  if (!storage || !Array.isArray(groups)) return;
  try { storage.setItem(CATALOG_GROUP_CACHE_KEY, JSON.stringify({ time: now, groups })); }
  catch { /* Browsers may block session storage. Network loading still works. */ }
}

export function clearCachedCatalogGroups(storage) {
  try { storage?.removeItem(CATALOG_GROUP_CACHE_KEY); } catch {}
}
