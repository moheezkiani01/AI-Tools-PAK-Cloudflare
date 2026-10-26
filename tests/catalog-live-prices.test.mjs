import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildCatalogGroups } from '../src/utils/catalogGroups.js';
import { clearCachedCatalogGroups, readCachedCatalogGroups, writeCachedCatalogGroups, CATALOG_GROUP_CACHE_KEY } from '../src/utils/catalogGroupCache.js';
import { listPublicGroups, allPublicVariants, groupPublicVariants } from '../server/catalog.js';

const money = (p, o) => ({ price: o?.price ?? p.price });
const settings = { priceFor:money, hasDiscount:()=>false, isOut:()=>false };

const legacy = [
  { slug:'chatgpt-plus',name:'ChatGPT Plus',brand:'ChatGPT',category:'ai-tools',price:2200,duration:'1 Month' },
  { slug:'claude-pro',name:'Claude Pro',brand:'Claude',category:'ai-tools',price:5500,duration:'1 Month' },
];

test('new imported catalogue determines displayed starting price when an old original product overlaps', () => {
  const groups = buildCatalogGroups(legacy,[
    {slug:'chatgpt',brand:'ChatGPT',category:'ai-tools',minPrice:3199,count:12,availableCount:5},
    {slug:'claude',brand:'Claude',category:'ai-tools',minPrice:7000,count:8,availableCount:8},
  ],settings);
  const chat=groups.find(x=>x.slug==='chatgpt');
  const claude=groups.find(x=>x.slug==='claude');
  assert.equal(chat.minPrice,3199);
  assert.equal(claude.minPrice,7000);
  assert.equal(chat.count,13);
  assert.equal(chat.legacyProducts.length,1);
});

test('original catalogue still supplies prices when no imported plans are present', () => {
  const groups = buildCatalogGroups(legacy,[],settings);
  assert.equal(groups.find(x=>x.slug==='chatgpt').minPrice,2200);
  assert.equal(groups.find(x=>x.slug==='claude').minPrice,5500);
});

test('invalid or absent imported minimum cannot make brand cards show Rs. 0', () => {
  for (const minPrice of [null,undefined,'',0,-50,'not-a-price']) {
    const groups=buildCatalogGroups(legacy,[{slug:'chatgpt',brand:'ChatGPT',category:'ai-tools',minPrice,count:5}],settings);
    assert.equal(groups.find(g=>g.slug==='chatgpt').minPrice,2200);
  }
});

test('API summaries show the lowest orderable price and retain lower enquiry-only prices separately', async () => {
  const oldFetch=global.fetch, oldUrl=process.env.SUPABASE_URL, oldKey=process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_URL='https://pricing-test.supabase.co';
  process.env.SUPABASE_SECRET_KEY='sb_secret_test';
  const mock=[
    {slug:'import-chatgpt-regular',group_slug:'chatgpt',brand:'ChatGPT',name:'ChatGPT Plus 1 Month',description:'',category:'ai-tools',variant:'1 Month',product_type:'account',price_pkr:6000,manual_price_pkr:5500,discount_percent:10,featured:true,unavailable:false,status:'pending',review_flags:[]},
    {slug:'import-chatgpt-review',group_slug:'chatgpt',brand:'ChatGPT',name:'ChatGPT Short Plan',description:'',category:'ai-tools',variant:'1 Week',product_type:'account',price_pkr:1600,manual_price_pkr:null,discount_percent:0,featured:false,unavailable:false,status:'pending',review_flags:['sensitive']},
    {slug:'import-chatgpt-hidden',group_slug:'chatgpt',brand:'ChatGPT',name:'Do not publish',description:'',category:'ai-tools',variant:'1 Day',product_type:'account',price_pkr:1,manual_price_pkr:null,discount_percent:0,featured:false,unavailable:false,status:'hidden',review_flags:[]},
  ];
  global.fetch=async url=>{
    const u=new URL(url);
    const slug=u.searchParams.get('group_slug');
    return new Response(JSON.stringify(mock.filter(p=>p.status!=='hidden' && (!slug||p.group_slug===slug.slice(3)))),{status:200,headers:{'Content-Type':'application/json'}});
  };
  try {
    const group=(await listPublicGroups({limit:50})).groups[0];
    const visible=await groupPublicVariants('chatgpt');
    assert.equal(group.minPrice,4950);
    assert.equal(group.orderableMinPrice,4950);
    assert.equal(group.listedMinPrice,1600);
    assert.equal(Math.min(...visible.map(p=>p.finalPrice)),1600);
    assert.equal(group.availableCount,1);
    assert.equal(group.count,2);
    assert.equal(visible.find(p=>p.slug==='import-chatgpt-review').restricted,true);
    assert.equal(visible.find(p=>p.slug==='import-chatgpt-review').unavailable,true);
    assert.equal(visible.find(p=>p.slug==='import-chatgpt-regular').finalPrice,4950);
    assert.equal('review_flags' in visible[0],false);
  } finally {
    global.fetch=oldFetch;
    if(oldUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=oldUrl;
    if(oldKey===undefined)delete process.env.SUPABASE_SECRET_KEY;else process.env.SUPABASE_SECRET_KEY=oldKey;
  }
});

test('new summary cache key prevents last-import prices from being reused',()=>{
  const content=new Map([['ai-tools-pak:catalog-groups:v1',JSON.stringify({time:Date.now(),groups:[{slug:'chatgpt',minPrice:2200}]})]]);
  const storage={getItem:key=>content.get(key)??null,setItem:(key,v)=>content.set(key,v),removeItem:key=>content.delete(key)};
  assert.notEqual(CATALOG_GROUP_CACHE_KEY,'ai-tools-pak:catalog-groups:v1');
  assert.equal(readCachedCatalogGroups(storage),null);
  writeCachedCatalogGroups(storage,[{slug:'chatgpt',minPrice:3199}]);
  assert.equal(readCachedCatalogGroups(storage)[0].minPrice,3199);
  clearCachedCatalogGroups(storage);
  assert.equal(readCachedCatalogGroups(storage),null);
});

test('all customer-facing starting prices use the shared catalogue groups',()=>{
  const files=[
    '../src/components/Hero.jsx','../src/components/ImportedToolCard.jsx',
    '../src/components/ToolFinder.jsx','../src/components/QuickToolSearch.jsx',
    '../src/components/CategoryCard.jsx','../src/components/ProductGrid.jsx',
    '../src/components/ImportedGroups.jsx',
  ];
  for(const f of files){
    const source=readFileSync(new URL(f,import.meta.url),'utf8');
    assert.match(source,/minPrice/,f);
  }
  const app=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
  assert.match(app,/visibilitychange/);
  assert.match(app,/pricing-updated/);
  const cache=readFileSync(new URL('../src/utils/catalogVariantCache.js',import.meta.url),'utf8');
  assert.doesNotMatch(cache,/cache: 'no-store'/);
});

test('a merged brand uses the cheapest imported price across multiple source summaries',()=>{
  const merged=buildCatalogGroups([], [
    {slug:'suno',brand:'Suno',category:'ai-tools',count:3,minPrice:3000},
    {slug:'suno',brand:'Suno',category:'ai-tools',count:5,minPrice:900},
    {slug:'suno',brand:'Suno',category:'ai-tools',count:2,minPrice:1500},
  ],settings);
  assert.equal(merged.length,1);
  assert.equal(merged[0].minPrice,900);
  assert.equal(merged[0].count,10);
});

test('split-source brands have all plans on their detail page with one scoped request',async()=>{
  const {mixedSourceGroupSlugs}=await import('../server/catalog.js');
  assert.deepEqual([...mixedSourceGroupSlugs].sort(),['akool','minimax','openart','seedance','suno']);
  const oldFetch=global.fetch,oldUrl=process.env.SUPABASE_URL,oldKey=process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_URL='https://pricing-test.supabase.co';
  process.env.SUPABASE_SECRET_KEY='sb_secret_test';
  let calls=0;
  const row=(id,source)=>({slug:`import-${id}`,group_slug:source,brand:source==='api-tools'?'API tools':'Suno',name:'Suno Pro',description:'',category:source==='api-tools'?'api-tools':'ai-tools',variant:'1 Month',product_type:'subscription',price_pkr:1400,manual_price_pkr:null,discount_percent:0,featured:false,unavailable:false,status:'pending',review_flags:[]});
  global.fetch=async url=>{
    calls++;
    const query=new URL(url).searchParams;
    assert.equal(query.get('group_slug'),'in.(suno,api-tools)');
    return new Response(JSON.stringify([row('one','suno'),row('two','api-tools')]),{status:200});
  };
  try {
    const plans=await groupPublicVariants('suno');
    assert.equal(plans.length,2);
    assert.equal(calls,1);
  } finally {
    global.fetch=oldFetch;
    if(oldUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=oldUrl;
    if(oldKey===undefined)delete process.env.SUPABASE_SECRET_KEY;else process.env.SUPABASE_SECRET_KEY=oldKey;
  }
});
