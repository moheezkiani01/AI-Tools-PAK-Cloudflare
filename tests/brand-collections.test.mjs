import test from 'node:test';
import assert from 'node:assert/strict';
import { products } from '../src/data/products.js';
import { brandIdentity, buildCatalogGroups, sortCatalogGroups } from '../src/utils/catalogGroups.js';

const dummy = {priceFor:p=>({price:p.price}),hasDiscount:()=>false,isOut:()=>false};

test('original ChatGPT and Claude variations are grouped once per brand',()=>{
 const groups=buildCatalogGroups(products,[],dummy);
 assert.equal(groups.filter(g=>g.slug==='chatgpt').length,1);
 assert.equal(groups.find(g=>g.slug==='chatgpt').legacyProducts.length,2);
 assert.equal(groups.find(g=>g.slug==='claude').legacyProducts.length,2);
});
test('imported catalog merges into its legacy brand without duplicating the main card',()=>{
 const groups=buildCatalogGroups(products,[{slug:'chatgpt',brand:'ChatGPT',category:'ai-tools',count:9,minPrice:1400,featured:true,hasDiscount:false}],dummy);
 const chat=groups.filter(g=>g.slug==='chatgpt');
 assert.equal(chat.length,1);
 assert.equal(chat[0].count,11);
 assert.equal(chat[0].minPrice,1400);
 assert.equal(chat[0].adminFeatured,true);
});
test('published imported brands appear even if no legacy product exists',()=>{
 const groups=buildCatalogGroups(products,[{slug:'wink',brand:'wink',category:'creative-tools',count:1,minPrice:3143}],dummy);
 assert.equal(groups.find(g=>g.slug==='wink').minPrice,3143);
});
test('lowest plan amount comes from all legacy price options',()=>{
 const g=buildCatalogGroups([{slug:'one',name:'Canva Plan',category:'creative-tools',options:[{price:1800},{price:900}],price:1800}],[],{...dummy,priceFor:(p,o)=>({price:o?.price||p.price})});
 assert.equal(g[0].minPrice,900);
 assert.equal(g[0].count,2);
});
test('curated choices appear before other brands without inventing popularity numbers',()=>{
 const list=sortCatalogGroups([{slug:'wink',brand:'Wink',minPrice:3000},{slug:'chatgpt',brand:'ChatGPT',minPrice:1500}]);
 assert.equal(list[0].brand,'ChatGPT');
});
test('price and alphabetic sorting are stable',()=>{
 const list=[{slug:'canva',brand:'Canva',minPrice:2000},{slug:'chatgpt',brand:'ChatGPT',minPrice:1000}];
 assert.equal(sortCatalogGroups(list,'low')[0].slug,'chatgpt');
 assert.equal(sortCatalogGroups(list,'name-asc')[0].slug,'canva');
});
test('no supplier cost fields are included in customer-facing group summaries',()=>{
 const groups=buildCatalogGroups([{slug:'test',name:'QuillBot Plus',category:'productivity',price:700,costUsd:1,supplier:'private'}],[],dummy);
 assert.equal('costUsd' in groups[0],false);
 assert.equal('supplier' in groups[0],false);
});
