import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  fetchGroupVariants, fetchProductVariant, fetchAllCatalogVariants,
  readCachedGroupVariants, readCachedProductVariant, readCachedAllVariants,
  clearVariantCache,
} from '../src/utils/catalogVariantCache.js';

const sample = { slug:'import-test-plan', groupSlug:'chatgpt', name:'ChatGPT Plan', pricePkr:3750, finalPrice:3750 };

test('opening the same collection shares requests, and its products open from memory', async () => {
  clearVariantCache();
  const original=global.fetch;
  let count=0;
  global.fetch=async url=>{
    count++;
    assert.equal(new URL(url, 'https://local.test').pathname, '/api/catalog/groups/chatgpt');
    return new Response(JSON.stringify({variants:[sample]}),{status:200});
  };
  try {
    const [a,b]=await Promise.all([fetchGroupVariants('chatgpt'),fetchGroupVariants('chatgpt')]);
    assert.deepEqual(a,b);
    assert.equal(count,1);
    assert.deepEqual(readCachedGroupVariants('chatgpt'),[sample]);
    assert.deepEqual(await fetchProductVariant(sample.slug),sample);
    assert.equal(count,1);
  } finally { global.fetch=original; clearVariantCache(); }
});

test('All Products reuses the public variant list, including on return navigation',async()=>{
  clearVariantCache(); const original=global.fetch;let count=0;
  global.fetch=async ()=>{count++;return new Response(JSON.stringify({variants:[sample]}),{status:200});};
  try {
    assert.equal((await fetchAllCatalogVariants()).length,1);
    assert.deepEqual(readCachedAllVariants(),[sample]);
    assert.deepEqual(await fetchGroupVariants('chatgpt'),[sample]);
    await fetchAllCatalogVariants();
    assert.equal(count,1);
  }finally{global.fetch=original;clearVariantCache();}
});

test('catalog changes invalidate public caches so edits are not stuck',async()=>{
  clearVariantCache();const original=global.fetch;let count=0;
  global.fetch=async ()=>{count++;return new Response(JSON.stringify({variant:{...sample,finalPrice:count*500}}),{status:200});};
  try {
    await fetchProductVariant(sample.slug);
    assert.equal(readCachedProductVariant(sample.slug).finalPrice,500);
    clearVariantCache();
    assert.equal(readCachedProductVariant(sample.slug),null);
    assert.equal((await fetchProductVariant(sample.slug)).finalPrice,1000);
    assert.equal(count,2);
  }finally{global.fetch=original;clearVariantCache();}
});

test('brand pages and product views avoid showing partial legacy-only plans before imports arrive',()=>{
  const group=readFileSync(new URL('../src/components/ImportedGroupDetails.jsx',import.meta.url),'utf8');
  const details=readFileSync(new URL('../src/components/ProductDetails.jsx',import.meta.url),'utf8');
  const grid=readFileSync(new URL('../src/components/ProductGrid.jsx',import.meta.url),'utf8');
  const app=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
  assert.match(group,/fetchGroupVariants\(importedSlug\)/);
  assert.match(group,/status!=='loading'&&<div/);
  assert.match(details,/readCachedProductVariant\(slug\)/);
  assert.match(grid,/\/api\/catalog\/groups\?limit=200/);
  assert.match(grid,/ImportedToolCard/);
  assert.match(app,/prefetchCatalogRoute\(href\)/);
});

test('regular brand plan fetch filters at Supabase instead of scanning the full catalogue',async()=>{
  const previous=global.fetch,oldUrl=process.env.SUPABASE_URL,oldKey=process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_URL='https://unit-test.supabase.co';
  process.env.SUPABASE_SECRET_KEY='sb_secret_test';
  let calls=0;
  global.fetch=async url=>{
    calls++;
    const query=new URL(url).searchParams;
    assert.equal(query.get('group_slug'),'eq.chatgpt');
    return new Response(JSON.stringify([{
      slug:sample.slug,group_slug:'chatgpt',brand:'ChatGPT',name:sample.name,description:'One month',
      category:'ai-tools',variant:'1 month',product_type:'subscription',price_pkr:3750,
      manual_price_pkr:null,discount_percent:0,featured:false,unavailable:false,
      status:'pending',review_flags:[],
    }]),{status:200});
  };
  try {
    const { groupPublicVariants }=await import('../server/catalog.js');
    const items=await groupPublicVariants('chatgpt');
    assert.equal(items.length,1);
    assert.equal(calls,1);
    assert.equal(items[0].finalPrice,3750);
    assert.equal('cost_cents' in items[0],false);
  } finally {
    global.fetch=previous;
    if(oldUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=oldUrl;
    if(oldKey===undefined)delete process.env.SUPABASE_SECRET_KEY;else process.env.SUPABASE_SECRET_KEY=oldKey;
  }
});
