import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isApiOffer, displayCategory, apiIdentity } from '../src/utils/catalogTaxonomy.js';
import { buildCatalogGroups } from '../src/utils/catalogGroups.js';
import { makeCatalogVariants } from '../src/utils/catalogVariants.js';

const legacy=[{slug:'claude-normal',brand:'Claude',name:'Claude Pro 1 Month',category:'ai-tools',price:4500}];
const imported=[
  {slug:'claude',brand:'Claude',category:'ai-tools',count:9,minPrice:300},
  {slug:'claude-api',brand:'Claude API',category:'api-tools',count:26,minPrice:490},
  {slug:'gpt-api',brand:'GPT API',category:'api-tools',count:35,minPrice:350},
  {slug:'muse-ai-api',brand:'Muse AI API',category:'api-tools',count:3,minPrice:999},
  {slug:'gemini-api',brand:'Gemini API',category:'api-tools',count:5,minPrice:700},
];

test('API summaries remain in their original API category after frontend grouping',()=>{
  const groups=buildCatalogGroups(legacy,imported,{priceFor:p=>({price:p.price})});
  const claude=groups.find(g=>g.slug==='claude');
  const claudeApi=groups.find(g=>g.slug==='claude-api');
  assert.equal(claude.category,'ai-tools');
  assert.equal(claude.count,10);
  assert.equal(claudeApi.category,'api-tools');
  assert.equal(claudeApi.count,26);
  assert.equal(claudeApi.importedGroup.slug,'claude-api');
  assert.equal(claudeApi.minPrice,490);
  assert.equal(groups.filter(g=>g.category==='api-tools').length,4);
  assert.deepEqual(groups.filter(g=>g.category==='api-tools').map(g=>g.slug).sort(),['claude-api','gemini-api','gpt-api','muse-ai-api']);
});

test('brand-only provider summaries are recognized as APIs without plan descriptions',()=>{
  for(const p of imported.filter(p=>p.category==='api-tools')){
    assert.equal(isApiOffer(p),true,p.brand);
    assert.equal(displayCategory(p),'api-tools',p.brand);
    assert.equal(apiIdentity(p).slug,p.slug,p.brand);
  }
  assert.equal(isApiOffer({brand:'API tools',name:'Akool credits 300',category:'api-tools'}),false);
  assert.equal(isApiOffer({brand:'Claude',name:'Claude Pro 1 Month',category:'ai-tools'}),false);
});

test('imported API plans keep their provider group in All Products',()=>{
  const plans=makeCatalogVariants([], [
    {slug:'import-a',groupSlug:'claude-api',brand:'Claude API',name:'Claude API $10 1 month',category:'api-tools',price:3450,finalPrice:3450},
    {slug:'import-b',groupSlug:'claude',brand:'Claude',name:'Claude Pro 1 month',category:'ai-tools',price:6500,finalPrice:6500},
  ]);
  assert.deepEqual(plans.map(p=>[p.groupSlug,p.category]),[['claude-api','api-tools'],['claude','ai-tools']]);
});

test('API section has selectable provider categories with counts and prices',()=>{
  const grid=readFileSync(new URL('../src/components/ProductGrid.jsx',import.meta.url),'utf8');
  assert.match(grid,/Browse API categories/);
  assert.match(grid,/apiProviders\.map/);
  assert.match(grid,/aria-pressed=\{apiProvider\s*===\s*g\.slug\}/);
  assert.match(grid,/formatPrice\(g\.minPrice\)/);
  assert.match(grid,/setApiProvider\(g\.slug\)/);
});
