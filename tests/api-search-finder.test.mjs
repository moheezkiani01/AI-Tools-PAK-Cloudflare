import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isApiOffer,apiIdentity,displayCategory} from '../src/utils/catalogTaxonomy.js';
import {buildCatalogGroups,brandIdentity} from '../src/utils/catalogGroups.js';
import {browseCategory} from '../server/catalog.js';
import {recommendedForNeed,needs} from '../src/utils/toolRecommendations.js';
const read = f => readFileSync(new URL(`../${f}`, import.meta.url),'utf8');
const normal={name:'Claude Pro One Month',brand:'Claude',category:'ai-tools',price:6000};
const api={name:'50M Credit API Claude 1 Day',brand:'Claude',category:'ai-tools',price:1000};
test('Claude normal subscription stays separate from Claude API',()=>{
  assert.equal(isApiOffer(normal),false);
  assert.equal(isApiOffer(api),true);
  assert.deepEqual(apiIdentity(api),{slug:'claude-api',brand:'Claude API'});
  assert.deepEqual(brandIdentity(api),{slug:'claude-api',brand:'Claude API'});
  assert.equal(displayCategory(api),'api-tools');
  assert.equal(browseCategory('Claude','ai-tools',api.name),'api-tools');
  assert.equal(browseCategory('Claude','ai-tools',normal.name),'ai-tools');
});
test('Muse AI, GPT and Gemini APIs receive dedicated groups',()=>{
  for(const [name,slug] of [['Muse AI API Credits','muse-ai-api'],['GPT API 5M tokens','gpt-api'],['Google Gemini API','gemini-api']]) {
    assert.equal(apiIdentity({name}).slug,slug);
  }
});
test('ordinary image and voice credits do not become API products',()=>{
  assert.equal(isApiOffer({name:'ElevenLabs 100K Credits',category:'ai-tools'}),false);
  assert.equal(isApiOffer({name:'Canva Pro Credits',category:'creative-tools'}),false);
  assert.equal(isApiOffer({name:'Akool Pro 600 Credits',brand:'API tools',category:'api-tools'}),false);
  assert.equal(browseCategory('API tools','api-tools','Akool Pro 600 Credits'),'creative-tools');
});
test('mixed legacy products are split into separate groups and categories',()=>{
  const groups=buildCatalogGroups([{...normal,slug:'claude-pro'},{...api,slug:'claude-api-credit'}],[],{priceFor:p=>({price:p.price}),hasDiscount:()=>false,isOut:()=>false});
  assert.deepEqual(groups.map(g=>g.slug).sort(),['claude','claude-api']);
  assert.equal(groups.find(g=>g.slug==='claude').category,'ai-tools');
  assert.equal(groups.find(g=>g.slug==='claude-api').category,'api-tools');
});
test('tool finder has an unbounded all-tools view excluding API packages',()=>{
  const groups=Array.from({length:23},(_,i)=>({slug:`tool${i}`,brand:`Tool ${i}`,category:'ai-tools',minPrice:i+1}));
  groups.push({slug:'claude-api',brand:'Claude API',category:'api-tools',minPrice:200});
  const all=recommendedForNeed(groups,needs.find(n=>n.all),Number.POSITIVE_INFINITY);
  assert.equal(all.length,23);
  assert.ok(!all.some(g=>g.category==='api-tools'));
  const finder=read('src/components/ToolFinder.jsx');
  assert.match(finder,/Number.POSITIVE_INFINITY/);
  assert.match(finder,/Show more tools/);
});
test('homepage search sits between logo marquee and category grid',()=>{
  const app=read('src/App.jsx');
  assert.ok(app.indexOf('<LogoStrip catalogGroups') < app.indexOf('<QuickToolSearch catalogGroups'));
  assert.ok(app.indexOf('<QuickToolSearch catalogGroups') < app.indexOf('<section id="categories"'));
  const search=read('src/components/QuickToolSearch.jsx');
  assert.match(search,/role="search"/);
  assert.match(search,/\/api\/catalog\/groups\?limit=/);
  assert.match(search,/\/products\?q=/);
  const grid=read('src/components/ProductGrid.jsx');
  assert.match(grid,/new URLSearchParams\(window.location.search\)/);
  assert.match(grid,/Browse API categories/);
});

test('public Supabase groups separate APIs without altering stored source records',async()=>{
  const {allPublicVariants, listPublicGroups, groupPublicVariants}=await import('../server/catalog.js');
  const previousFetch=global.fetch, previousUrl=process.env.SUPABASE_URL, previousKey=process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_URL='https://unit-test.supabase.co';process.env.SUPABASE_SECRET_KEY='sb_secret_test';
  const sample=(slug,groupSlug,brand,name,category)=>({slug,group_slug:groupSlug,brand,name,category,description:'',variant:'1 Month',product_type:'account',price_pkr:690,manual_price_pkr:null,discount_percent:0,featured:false,unavailable:false,status:'pending',review_flags:[]});
  const rows=[
    sample('import-claude-regular','claude','Claude','Claude Pro 1 Month','ai-tools'),
    sample('import-claude-api','claude','Claude','50M Token API Claude 1 Day','ai-tools'),
    sample('import-muse-token','api-tools','API tools','Muse AI 1B Token 1 Month','api-tools'),
    sample('import-akool-credits','api-tools','API tools','Akool Pro 600 Credits','api-tools'),
  ];
  global.fetch=async()=>new Response(JSON.stringify(rows),{status:200,headers:{'Content-Type':'application/json'}});
  try {
    const all=await allPublicVariants();
    assert.deepEqual(all.map(x=>x.category),['ai-tools','api-tools','api-tools','creative-tools']);
    const apis=await listPublicGroups({category:'api-tools'});
    assert.deepEqual(apis.groups.map(x=>x.slug).sort(),['claude-api','muse-ai-api']);
    assert.deepEqual((await groupPublicVariants('claude-api')).map(p=>p.slug),['import-claude-api']);
    const creative=await listPublicGroups({category:'creative-tools'});
    assert.deepEqual(creative.groups.map(g=>g.slug),['akool']);
    assert.ok(all.every(p=>!('price_cents' in p)&&!('review_flags' in p)));
  } finally {
    global.fetch=previousFetch;
    if(previousUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=previousUrl;
    if(previousKey===undefined)delete process.env.SUPABASE_SECRET_KEY;else process.env.SUPABASE_SECRET_KEY=previousKey;
  }
});
