import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeCatalogVariants, sortVariants, textMatches } from '../src/utils/catalogVariants.js';
import { categories } from '../src/data/categories.js';

const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('All Products contains distinct legacy plan choices and every eligible imported variant', () => {
  const legacy=[{slug:'canva',name:'Canva',price:1000,category:'creative-tools',options:[{label:'1 Month',price:800},{label:'1 Year',price:3500}]}];
  const imported=Array.from({length:459},(_,i)=>({slug:`import-plan-${i}`,name:`Imported Plan ${i}`,brand:'Claude',groupSlug:'claude',category:'ai-tools',variant:'1 Month',finalPrice:900+i}));
  const items=makeCatalogVariants(legacy,imported,(p,o)=>({price:o?.price||p.price}));
  assert.equal(items.length,461);
  assert.equal(items.filter(p=>p.groupSlug==='canva').length,2);
  assert.equal(items.filter(p=>p.slug.startsWith('import-')).length,459);
});
test('all product sort prioritizes curated brands and supports pricing',()=>{
  const rows=makeCatalogVariants([{slug:'wink',name:'Wink',price:3400},{slug:'chatgpt-plus',name:'ChatGPT Plus',price:2900}],[],p=>({price:p.price}));
  assert.equal(sortVariants(rows)[0].groupSlug,'chatgpt');
  assert.equal(sortVariants(rows,'high')[0].price,3400);
  assert.equal(textMatches(rows[0],'wink'),true);
});
test('All Products page starts on all, not AI Tools',()=>{
  const page=read('src/components/CategoryPage.jsx');
  assert.match(page,/useState\(slug\)/);
  assert.doesNotMatch(page,/slug === "all" \? "ai-tools"/);
  const grid=read('src/components/ProductGrid.jsx');
  assert.match(grid,/category='all'/);
  assert.match(grid,/ImportedToolCard/);
  assert.doesNotMatch(grid,/CatalogVariantCard/);
  assert.match(grid,/ONE card per tool/);
  assert.match(read('src/utils/catalogVariantCache.js'),/\/api\/catalog\/variants/);
});
test('category additions keep Discounts last and include API and learning categories',()=>{
  assert.deepEqual(categories.slice(-4).map(c=>c.slug),['education-research','professional','api-tools','discounts']);
});
test('homepage strip animates and respects reduced motion without mouse effects',()=>{
  const css=read('src/index.css');
  const strip=read('src/components/LogoStrip.jsx');
  assert.match(css,/brand-marquee-loop/);
  assert.match(strip,/className="brand-marquee/);
  assert.doesNotMatch(read('src/App.jsx'),/initMouseEffects|CursorEffects/);
});
