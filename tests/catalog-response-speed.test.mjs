import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { allPublicVariants, findPublicVariant, listPublicGroups, invalidatePublicCatalogCache } from '../server/catalog.js';

const row = {
  slug: 'import-test-performance-01', group_slug: 'chatgpt', brand: 'ChatGPT',
  name: 'ChatGPT Plus 1 Month', description: 'One month', category: 'ai-tools',
  variant: '1 month', product_type: 'subscription', price_pkr: 4500,
  manual_price_pkr: null, discount_percent: 0, featured: true,
  unavailable: false, status: 'published', review_flags: [],
};

test('concurrent public catalogue requests share one Supabase read; admin invalidation refetches', async () => {
  const original = global.fetch;
  const beforeUrl = process.env.SUPABASE_URL;
  const beforeKey = process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_URL = 'https://unit-test.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_test';
  let calls = 0;
  global.fetch = async () => {
    calls++;
    await new Promise(resolve => setTimeout(resolve, 5));
    return new Response(JSON.stringify([row]), { status: 200 });
  };
  try {
    invalidatePublicCatalogCache();
    const [a,b,c] = await Promise.all([
      listPublicGroups({limit:50}), listPublicGroups({limit:50}), listPublicGroups({limit:20}),
    ]);
    assert.equal(calls, 1);
    assert.equal(a.groups[0].minPrice, 4500);
    assert.deepEqual(a.groups, b.groups);
    assert.equal(c.groups.length, 1);
    await listPublicGroups({limit:50});
    assert.equal(calls, 1);
    invalidatePublicCatalogCache();
    await listPublicGroups({limit:50});
    assert.equal(calls, 2);
    await findPublicVariant(row.slug);
    await findPublicVariant(row.slug);
    assert.equal(calls, 4, 'checkout-style product lookups must stay uncached');
  } finally {
    global.fetch = original;
    invalidatePublicCatalogCache();
    if (beforeUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = beforeUrl;
    if (beforeKey === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY = beforeKey;
  }
});

test('public catalogue renders unique tool collections and visible cards defer offscreen work', () => {
  const grid = readFileSync(new URL('../src/components/ProductGrid.jsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(grid, /\/api\/catalog\/groups\?limit=200/);
  assert.match(grid, /selectCatalogCollections/);
  assert.doesNotMatch(grid, /CatalogVariantCard/);
  assert.doesNotMatch(grid, /const indexedVariants = useMemo/);
  assert.match(grid, /controller\.abort\(\)/);
  assert.match(css, /content-visibility:\s*auto/);
  assert.match(app, /connection\?\.saveData/);
  assert.match(app, /prefetchCatalogRoute\(href\)/);
});

test('price and discount changes invalidate the public detail cache as well', () => {
  const code = readFileSync(new URL('../src/utils/catalogVariantCache.js', import.meta.url), 'utf8');
  assert.match(code, /addEventListener\('catalog-updated', clearVariantCache\)/);
  assert.match(code, /addEventListener\('pricing-updated', clearVariantCache\)/);
  assert.match(code, /addEventListener\('discounts-updated', clearVariantCache\)/);
  const api = readFileSync(new URL('../server/index.js', import.meta.url), 'utf8');
  assert.match(api, /invalidatePublicCatalogCache\(\)/);
});
