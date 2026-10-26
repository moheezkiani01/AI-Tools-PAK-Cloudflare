import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { publicCacheHeader, cachePublicResponse } from '../server/publicCache.js';
import { loadPublicState, invalidatePublicStateCache } from '../server/dataStore.js';
import { placeDedicatedOrder, dedicatedOrderSummary, listDedicatedOrders, updateDedicatedOrder, usingOrderTable } from '../server/scaleOrders.js';

test('public cache is bounded and cannot be applied to private routes by default', () => {
  assert.equal(publicCacheHeader(15, 15), 'public, max-age=0, s-maxage=15, stale-while-revalidate=15');
  assert.equal(publicCacheHeader(999, -1), 'public, max-age=0, s-maxage=60, stale-while-revalidate=0');
  const headers = {};
  const response = { set(k,v) {headers[k]=v; return this;} };
  assert.equal(cachePublicResponse(response, 12, 15), response);
  assert.match(headers['Cache-Control'], /s-maxage=12/);
  const code = fs.readFileSync(new URL('../server/index.js', import.meta.url), 'utf8');
  assert.match(code, /app\.use\("\/api", \(req, res, next\) => \{ res\.set\("Cache-Control", "no-store"\)/);
  assert.doesNotMatch(code, /cachePublicResponse\(res[^\n]*\/api\/orders/);
  assert.match(code, /api\.get\('\/api\/catalog\/browse'/);
});

test('anonymous state reads coalesce without caching checkout state mutations', async () => {
  const oldFetch = global.fetch;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_URL = 'https://scale-test.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_scales';
  let reads = 0;
  global.fetch = async input => {
    if (String(input).includes('ai_tools_state')) {
      reads++;
      await new Promise(r => setTimeout(r, 3));
      return new Response(JSON.stringify([{revision:0,payload:{orders:[],reviews:[],clicks:[],tokens:[],questions:[]}}]), {status:200});
    }
    throw new Error('Unexpected mocked endpoint');
  };
  try {
    invalidatePublicStateCache();
    const states=await Promise.all(Array.from({length:60},()=>loadPublicState()));
    assert.equal(reads, 1);
    assert.ok(states.every(s=>s===states[0]));
    // A new mutable checkout read must still go to the source of truth.
    // The fresh-read function is intentionally not part of the public cache.
    const { load } = await import('../server/dataStore.js');
    await load();
    assert.equal(reads,2);
    invalidatePublicStateCache();
    await loadPublicState();
    assert.equal(reads,3);
  } finally {
    global.fetch = oldFetch;
    invalidatePublicStateCache();
    if (url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL=url;
    if (key === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY=key;
  }
});

test('optional row-per-order storage honors the idempotency response shape', async () => {
  const oldFetch = global.fetch;
  const oldUrl = process.env.SUPABASE_URL;
  const oldKey = process.env.SUPABASE_SECRET_KEY;
  const oldSwitch = process.env.ORDER_STORAGE_V2;
  process.env.ORDER_STORAGE_V2='true';
  process.env.SUPABASE_URL='https://scale-test.supabase.co';
  process.env.SUPABASE_SECRET_KEY='sb_secret_scales';
  let creates = 0;
  const entries=new Map();
  global.fetch=async(input,options={})=>{
    const path=new URL(String(input)).pathname;
    const query=new URL(String(input)).search;
    const body=options.body?JSON.parse(options.body):{};
    if(path.endsWith('/rpc/ai_tools_create_checkout_order')) {
      creates++;
      if(!entries.has(body.p_idempotency_key))entries.set(body.p_idempotency_key,{number:body.p_number,total:body.p_total,status:'Pending'});
      const result=entries.get(body.p_idempotency_key);
      return new Response(JSON.stringify({number:result.number,total:result.total}),{status:200});
    }
    if(path.endsWith('/rpc/ai_tools_checkout_order_summary'))return new Response(JSON.stringify({total:entries.size,days:[]}),{status:200});
    if(path.endsWith('/ai_tools_checkout_orders') && options.method==='PATCH') {
      const number=decodeURIComponent(new URLSearchParams(query).get('number').slice(3));
      const order=[...entries.values()].find(x=>x.number===number);
      if(order)order.status=body.status;
      return new Response(JSON.stringify(order?[{number}]:[]),{status:200});
    }
    if(path.endsWith('/ai_tools_checkout_orders'))return new Response(JSON.stringify([...entries.values()].map(o=>({...o,date:new Date().toISOString(),customer:{name:'Sample'},items:[],idempotency_key:'sample'}))),{status:200});
    throw Error(`Unexpected endpoint ${path}`);
  };
  try {
    assert.equal(usingOrderTable(),true);
    const shared='cedceded-2222-4222-8222-555555555555';
    const input={idempotencyKey:shared,customer:{name:'Sample'},items:[{slug:'demo',qty:1}],total:3400};
    const [a,b]=await Promise.all([placeDedicatedOrder(input),placeDedicatedOrder(input)]);
    assert.deepEqual(a,b,'identical idempotency keys must return one logical order');
    assert.equal(creates,2,'server may retry; SQL unique constraint must deduplicate');
    assert.equal((await dedicatedOrderSummary()).total,1);
    assert.equal((await listDedicatedOrders()).length,1);
    assert.equal(await updateDedicatedOrder(a.number,'Completed'),true);
    assert.equal((await listDedicatedOrders())[0].status,'Completed');
  } finally {
    global.fetch=oldFetch;
    if(oldUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=oldUrl;
    if(oldKey===undefined)delete process.env.SUPABASE_SECRET_KEY;else process.env.SUPABASE_SECRET_KEY=oldKey;
    if(oldSwitch===undefined)delete process.env.ORDER_STORAGE_V2;else process.env.ORDER_STORAGE_V2=oldSwitch;
  }
});

test('SQL migration is additive, RLS protected, and enforces idempotency', () => {
  const sql=fs.readFileSync(new URL('../supabase/optional_checkout_scaling.sql', import.meta.url),'utf8');
  assert.match(sql,/create table if not exists public\.ai_tools_checkout_orders/i);
  assert.match(sql,/idempotency_key text not null unique/i);
  assert.match(sql,/enable row level security/i);
  assert.match(sql,/on conflict \(idempotency_key\) do nothing/i);
  assert.match(sql,/revoke all on function public\.ai_tools_create_checkout_order/i);
  assert.doesNotMatch(sql,/drop table|truncate|delete from public\.ai_tools_state/i);
});

test('repeated browsing pages reuse one computed result until source data changes', async () => {
  const { buildCachedBrowsePage } = await import('../server/browse.js');
  const originals = [
    {slug:'canva1',name:'Canva Starter',brand:'Canva',description:'Design',duration:'1 month',category:'creative-tools',price:1200},
  ];
  const imports = [];
  const db = {orders:[],deletedProducts:[]};
  const pages=Array.from({length:1000},()=>buildCachedBrowsePage(originals,imports,db,{page:1,limit:20}));
  assert.equal(pages[0].total,1);
  assert.ok(pages.every(page=>page===pages[0]));
  const afterChange=buildCachedBrowsePage(originals,imports,{...db,deletedProducts:['canva1']},{page:1,limit:20});
  assert.equal(afterChange.total,0);
});

test('1,000 simultaneous catalogue summary requests share one mocked source read per warm instance', async () => {
  const { allPublicVariants, invalidatePublicCatalogCache } = await import('../server/catalog.js');
  const oldFetch = global.fetch;
  const oldUrl = process.env.SUPABASE_URL;
  const oldKey = process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_URL = 'https://scale-test.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_scales';
  const rows = Array.from({length:792}, (_, index) => ({
    slug:`import-scale-test-${String(index).padStart(5,'0')}`,
    group_slug:'chatgpt', brand:'ChatGPT', name:`ChatGPT Variant ${index}`,
    category:'ai-tools', variant:'1 Month', product_type:'Subscription',
    price_pkr:1250, manual_price_pkr:null, discount_percent:0,
    featured:false, unavailable:false, status:'published', review_flags:[],
  }));
  let databaseReads = 0;
  global.fetch = async () => {
    databaseReads++;
    await new Promise(r=>setTimeout(r, 4));
    return new Response(JSON.stringify(rows),{status:200});
  };
  try {
    invalidatePublicCatalogCache();
    const all = await Promise.all(Array.from({length:1000}, () => allPublicVariants({summary:true})));
    assert.equal(databaseReads,1);
    assert.ok(all.every(variants=>variants.length===792));
    invalidatePublicCatalogCache();
  } finally {
    global.fetch=oldFetch;
    invalidatePublicCatalogCache();
    if (oldUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY = oldKey;
  }
});
