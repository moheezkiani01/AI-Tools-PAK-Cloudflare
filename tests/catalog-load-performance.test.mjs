import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CATALOG_GROUP_CACHE_KEY, CATALOG_GROUP_CACHE_MS,
  readCachedCatalogGroups, writeCachedCatalogGroups, clearCachedCatalogGroups,
} from '../src/utils/catalogGroupCache.js';

const makeStorage = () => {
  const store = new Map();
  return {
    getItem: key => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
    removeItem: key => store.delete(key),
    keys: store,
  };
};

test('cached public group summaries are immediately usable and expire safely', () => {
  const storage = makeStorage();
  const groups = [{ slug: 'chatgpt', brand: 'ChatGPT', minPrice: 1414, count: 17 }];
  const now = 120_000;
  assert.equal(readCachedCatalogGroups(storage, now), null);
  writeCachedCatalogGroups(storage, groups, now);
  assert.equal(storage.keys.has(CATALOG_GROUP_CACHE_KEY), true);
  assert.deepEqual(readCachedCatalogGroups(storage, now + CATALOG_GROUP_CACHE_MS - 1), groups);
  assert.equal(readCachedCatalogGroups(storage, now + CATALOG_GROUP_CACHE_MS + 1), null);
  clearCachedCatalogGroups(storage);
  assert.equal(readCachedCatalogGroups(storage, now), null);
});

test('catalogue cache handles blocked storage gracefully', () => {
  const storage = { getItem(){ throw Error('blocked'); }, setItem(){ throw Error('blocked'); }, removeItem(){ throw Error('blocked'); } };
  assert.equal(readCachedCatalogGroups(storage), null);
  assert.doesNotThrow(() => writeCachedCatalogGroups(storage, []));
  assert.doesNotThrow(() => clearCachedCatalogGroups(storage));
});

test('homepage uses waiting placeholders until the real group summary arrives', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const hero = readFileSync(new URL('../src/components/Hero.jsx', import.meta.url), 'utf8');
  assert.match(app, /catalogReady=\{catalogReady\}/);
  assert.match(hero, /!catalogReady && !catalogError && Array.from\(\{ length: 4 \}/);
  assert.match(hero, /catalogReady && popular\.map/);
});

test('summary query fetches lean data in one Supabase batch for 791 rows', async () => {
  const previousFetch = global.fetch;
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_URL = 'https://unit-test.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_test';
  const { listPublicGroups } = await import('../server/catalog.js');
  let calls = 0;
  global.fetch = async url => {
    calls++;
    const link = new URL(url);
    assert.equal(link.searchParams.get('limit'), '1000');
    assert.equal(link.searchParams.get('select').includes('description'), false);
    return new Response(JSON.stringify(Array.from({ length: 791 }, (_, i) => ({
      slug: `import-product-${i}`, group_slug: 'chatgpt', brand: 'ChatGPT', name: `ChatGPT ${i}`,
      category: 'ai-tools', variant: '1 month', product_type: 'subscription',
      price_pkr: 3750, manual_price_pkr: null, discount_percent: 0, featured: false,
      unavailable: false, status: 'pending', review_flags: [],
    }))), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const result = await listPublicGroups({ limit: 30 });
    assert.equal(result.groups.length, 1);
    assert.equal(result.groups[0].count, 791);
    assert.equal(calls, 1);
  } finally {
    global.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY = previousKey;
  }
});
