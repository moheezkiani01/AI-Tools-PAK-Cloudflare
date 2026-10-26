// In-tab cache of PUBLIC catalog records only. No supplier prices or customer data.
// Shares in-flight requests across brand, All Products and individual detail pages.
const TTL = 45_000;
const groups = new Map();
const products = new Map();
let all = null;
let version = 0;

const live = entry => entry && entry.expires > Date.now();
const reloadQuery = () => version ? `?_updated=${version}` : '';
const recordProducts = items => {
  for (const item of items) if (item?.slug) products.set(item.slug, { value: item, expires: Date.now() + TTL });
};

export function readCachedGroupVariants(slug) {
  const entry = groups.get(slug);
  if (live(entry) && entry.value) return entry.value;
  if (live(all) && all.value) return all.value.filter(p => p.groupSlug === slug);
  return null;
}

export function readCachedProductVariant(slug) {
  const entry = products.get(slug);
  return live(entry) ? entry.value : null;
}

export function readCachedAllVariants() {
  return live(all) && all.value ? all.value : null;
}

export function clearVariantCache() {
  version++;
  groups.clear(); products.clear(); all = null;
}

export function fetchGroupVariants(slug) {
  if (!slug) return Promise.resolve([]);
  const cached = readCachedGroupVariants(slug);
  if (cached) return Promise.resolve(cached);
  const entry = groups.get(slug);
  if (live(entry) && entry.promise) return entry.promise;
  const started = version;
  const promise = fetch(`/api/catalog/groups/${encodeURIComponent(slug)}${reloadQuery()}`)
    .then(r => { if (!r.ok) throw Error('Could not load plans'); return r.json(); })
    .then(data => {
      if (!Array.isArray(data.variants)) throw Error('Invalid plans response');
      if (version === started) {
        groups.set(slug, { value: data.variants, expires: Date.now() + TTL });
        recordProducts(data.variants);
      }
      return data.variants;
    })
    .catch(err => { if (version === started) groups.delete(slug); throw err; });
  groups.set(slug, { promise, expires: Date.now() + TTL });
  return promise;
}

export function fetchProductVariant(slug) {
  const cached = readCachedProductVariant(slug);
  if (cached) return Promise.resolve(cached);
  const existing = products.get(slug);
  if (live(existing) && existing.promise) return existing.promise;
  const started = version;
  const promise = fetch(`/api/catalog/variants/${encodeURIComponent(slug)}${reloadQuery()}`)
    .then(r => { if (!r.ok) throw Error('Product unavailable'); return r.json(); })
    .then(data => {
      if (!data.variant?.slug) throw Error('Invalid product response');
      if (version === started) recordProducts([data.variant]);
      return data.variant;
    })
    .catch(err => { if (version === started) products.delete(slug); throw err; });
  products.set(slug, { promise, expires: Date.now() + TTL });
  return promise;
}

export function fetchAllCatalogVariants() {
  if (readCachedAllVariants()) return Promise.resolve(all.value);
  if (live(all) && all.promise) return all.promise;
  const started = version;
  const promise = fetch(`/api/catalog/variants${reloadQuery()}`)
    .then(r => { if (!r.ok) throw Error('Could not load catalogue'); return r.json(); })
    .then(data => {
      if (!Array.isArray(data.variants)) throw Error('Invalid catalogue response');
      if (version === started) {
        all = { value: data.variants, expires: Date.now() + TTL };
        recordProducts(data.variants);
      }
      return data.variants;
    })
    .catch(err => { if (version === started) all = null; throw err; });
  all = { promise, expires: Date.now() + TTL };
  return promise;
}

// Preload only when the visitor points to or focuses a matching link.
export function prefetchCatalogRoute(href) {
  const route = String(href || '').split(/[?#]/, 1)[0].split('/').filter(Boolean);
  if (route[0] === 'tool' && route[1]) return fetchGroupVariants(route[1]).catch(() => null);
  if (route[0] === 'product' && route[1]?.startsWith('import-')) return fetchProductVariant(route[1]).catch(() => null);
  // All Products is now server-paginated: do not prefetch hundreds of plans.
  if (route[0] === 'products') return Promise.resolve(null);
  return Promise.resolve(null);
}

if (typeof window !== 'undefined') {
  window.addEventListener('catalog-updated', clearVariantCache);
  window.addEventListener('pricing-updated', clearVariantCache);
  window.addEventListener('discounts-updated', clearVariantCache);
}
