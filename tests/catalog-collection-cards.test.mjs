import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildCatalogGroups } from '../src/utils/catalogGroups.js';
import { selectCatalogCollections } from '../src/utils/catalogCategoryView.js';

const originals = [
  {slug:'canva-original',brand:'Canva',name:'Canva Original 1 Year',category:'creative-tools',price:3500},
  {slug:'chatgpt-original',brand:'ChatGPT',name:'ChatGPT Plus',category:'ai-tools',price:2500},
];
const imported = [
  {slug:'canva',brand:'Canva',category:'creative-tools',count:40,minPrice:400,listedMinPrice:400,orderableMinPrice:450,availableCount:39,durations:['1 Month','1 Year']},
  {slug:'capcut',brand:'CapCut',category:'creative-tools',count:30,minPrice:500,listedMinPrice:500,orderableMinPrice:500,availableCount:30,durations:['1 Month'],hasDiscount:true},
  {slug:'chatgpt',brand:'ChatGPT',category:'ai-tools',count:52,minPrice:800,listedMinPrice:800,orderableMinPrice:800,availableCount:52},
  {slug:'gpt-api',brand:'GPT API',category:'api-tools',count:22,minPrice:1200,listedMinPrice:1200,orderableMinPrice:1200,availableCount:22},
];
const groups = buildCatalogGroups(originals,imported,{priceFor:p=>({price:p.price})});

test('each category shows unique tool collections rather than dozens of plan cards', () => {
  const creative = selectCatalogCollections(groups,{category:'creative-tools'});
  assert.deepEqual(new Set(creative.map(g=>g.slug)),new Set(['canva','capcut']));
  assert.equal(creative.length,2);
  assert.ok(creative.find(g=>g.slug==='canva').count >= 40);
  assert.equal(creative.find(g=>g.slug==='canva').minPrice,450);
  assert.deepEqual(selectCatalogCollections(groups,{category:'ai-tools'}).map(g=>g.slug),['chatgpt']);
  assert.deepEqual(selectCatalogCollections(groups,{category:'api-tools'}).map(g=>g.slug),['gpt-api']);
});

test('All Products shows one card per group including imported-only tools, never every plan', () => {
  const all=selectCatalogCollections(groups,{category:'all'});
  assert.equal(all.length,4);
  assert.equal(new Set(all.map(g=>g.slug)).size,all.length);
  assert.ok(all.reduce((n,g)=>n+g.count,0)>100);
});

test('discounts, search, provider, price and duration filter collections, not individual plans', () => {
  assert.deepEqual(selectCatalogCollections(groups,{category:'discounts'}).map(g=>g.slug),['capcut']);
  assert.deepEqual(selectCatalogCollections(groups,{category:'api-tools',apiProvider:'gpt-api'}).map(g=>g.slug),['gpt-api']);
  assert.equal(selectCatalogCollections(groups,{category:'ai-tools',apiProvider:'gpt-api'}).length,1);
  assert.deepEqual(selectCatalogCollections(groups,{category:'creative-tools',search:'capcut'}).map(g=>g.slug),['capcut']);
  assert.deepEqual(selectCatalogCollections(groups,{category:'creative-tools',search:'month-only-credit',extra:[{slug:'canva',brand:'Canva'}]}).map(g=>g.slug),['canva']);
  assert.deepEqual(selectCatalogCollections(groups,{category:'creative-tools',duration:'long'}).map(g=>g.slug),['canva']);
  assert.deepEqual(selectCatalogCollections(groups,{category:'creative-tools',price:'under1000'}).map(g=>g.slug).sort(),['canva','capcut']);
});

test('the public grid renders the group card and leaves plans to collection detail pages',()=>{
  const grid=readFileSync(new URL('../src/components/ProductGrid.jsx',import.meta.url),'utf8');
  const details=readFileSync(new URL('../src/components/ImportedGroupDetails.jsx',import.meta.url),'utf8');
  assert.match(grid,/ImportedToolCard key=\{group.slug\}/);
  assert.doesNotMatch(grid,/CatalogVariantCard/);
  assert.doesNotMatch(grid,/const allMode=true/);
  assert.match(grid,/filtered\.map\(group => <ImportedToolCard/);
  assert.doesNotMatch(grid,/Load more tools/);
  assert.doesNotMatch(grid,/homeLimit\s*\?\s*homeLimit\s*:/);
  assert.match(details,/Choose your plan/);
});
