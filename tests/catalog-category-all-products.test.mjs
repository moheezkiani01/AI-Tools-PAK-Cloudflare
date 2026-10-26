import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildBrowsePage, buildCachedBrowsePage } from '../server/browse.js';

const original = [
  {slug:'design-legacy',name:'Canva Teams',brand:'Canva',description:'Design software',category:'creative-tools',price:1500,duration:'1 Month'},
  {slug:'ai-legacy',name:'OpenAI ChatGPT Plus',brand:'ChatGPT',description:'AI assistant',category:'ai-tools',price:2000,duration:'1 Month'},
  {slug:'discounted-legacy',name:'Notion Pro',brand:'Notion',description:'Workspace',category:'productivity',price:1800,duration:'1 Month'},
];
const imported = [
  ...Array.from({length:46},(_,i)=>({
    slug:`import-creative-${i}`,brand:'Canva',name:`Canva plan ${i}`,description:'Creative',
    category:'creative-tools',variant:'1 Month',finalPrice:800+i,featured:false,groupSlug:'canva'
  })),
  ...Array.from({length:15},(_,i)=>({
    slug:`import-ai-${i}`,brand:'Claude',name:`Claude plan ${i}`,description:'AI',
    category:'ai-tools',variant:'1 Month',finalPrice:1200+i,featured:false,groupSlug:'claude',
    restricted:i===1
  })),
  {slug:'import-api-gpt',brand:'GPT API',name:'GPT API credits',description:'API',category:'api-tools',variant:'1 Month',finalPrice:1800,groupSlug:'gpt-api'},
  {slug:'import-api-muse',brand:'Muse AI API',name:'Muse API credits',description:'API',category:'api-tools',variant:'1 Month',finalPrice:1900,groupSlug:'muse-ai-api'},
  {slug:'import-discount',brand:'CapCut',name:'CapCut Special',description:'Video',category:'creative-tools',variant:'1 Month',finalPrice:900,discountPercent:25,groupSlug:'capcut'},
];
const db={discounts:{'discounted-legacy':{type:'percent',value:20}}};

test('backend can still retrieve all original and imported variants for plan detail pages',()=>{
  const creative=buildBrowsePage(original,imported,db,{category:'creative-tools',page:1,limit:20});
  assert.equal(creative.total,48); // 46 imported + CapCut discount + original Canva
  assert.equal(creative.items.length,20);
  assert.ok(creative.items.every(p=>p.category==='creative-tools'));
  const pages=Array.from({length:3},(_,i)=>buildBrowsePage(original,imported,db,{category:'creative-tools',page:i+1,limit:20}));
  const ids=pages.flatMap(p=>p.items.map(item=>item.id));
  assert.equal(ids.length,48);
  assert.equal(new Set(ids).size,48);
  assert.equal(buildBrowsePage(original,imported,db,{category:'ai-tools'}).total,16);
  assert.equal(buildBrowsePage(original,imported,db,{category:'all'}).total,original.length+imported.length);
});

test('API subcategories list all provider variants; other categories exclude them',()=>{
  assert.equal(buildBrowsePage(original,imported,db,{category:'api-tools'}).total,2);
  const gpt=buildBrowsePage(original,imported,db,{category:'api-tools',provider:'gpt-api'});
  assert.deepEqual(gpt.items.map(p=>p.slug),['import-api-gpt']);
  assert.equal(buildBrowsePage(original,imported,db,{category:'ai-tools',provider:'gpt-api'}).total,16,'API provider filter does not leak into another category');
});

test('Discounts category shows imported and legacy discounted plans but no full-price plans',()=>{
  const discount=buildBrowsePage(original,imported,db,{category:'discounts'});
  assert.equal(discount.total,2);
  assert.deepEqual(new Set(discount.items.map(p=>p.slug)),new Set(['import-discount','discounted-legacy']));
  assert.ok(discount.items.every(p=>p.discounted));
  assert.equal(discount.items.find(p=>p.slug==='discounted-legacy').price,1440);
});

test('category and provider are part of the cached-page identity',()=>{
  const all=buildCachedBrowsePage(original,imported,db,{category:'all'});
  const creative=buildCachedBrowsePage(original,imported,db,{category:'creative-tools'});
  const ai=buildCachedBrowsePage(original,imported,db,{category:'ai-tools'});
  const gpt=buildCachedBrowsePage(original,imported,db,{category:'api-tools',provider:'gpt-api'});
  const muse=buildCachedBrowsePage(original,imported,db,{category:'api-tools',provider:'muse-ai-api'});
  assert.notEqual(all.total,creative.total);
  assert.notEqual(creative.total,ai.total);
  assert.notEqual(gpt.items[0].slug,muse.items[0].slug);
  assert.equal(buildCachedBrowsePage(original,imported,db,{category:'creative-tools'}),creative,'same key reuses result');
});

test('category buttons show brand collection cards rather than every subscription plan',()=>{
  const jsx=fs.readFileSync(new URL('../src/components/ProductGrid.jsx',import.meta.url),'utf8');
  assert.match(jsx,/ImportedToolCard key=\{group.slug\}/);
  assert.doesNotMatch(jsx,/CatalogVariantCard/);
  assert.match(jsx,/setCategory\?\.\(slug\)/);
  const helper=fs.readFileSync(new URL('../src/utils/catalogCategoryView.js',import.meta.url),'utf8');
  assert.match(helper,/group.category !== category/);
  assert.match(jsx,/filtered\.map\(group => <ImportedToolCard/);
  assert.doesNotMatch(jsx,/Load more tools/);
  assert.doesNotMatch(jsx,/navigate\('\/products'\)/);
});
