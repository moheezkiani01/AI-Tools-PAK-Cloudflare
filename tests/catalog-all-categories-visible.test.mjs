import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {categories} from '../src/data/categories.js';
import {buildCatalogGroups} from '../src/utils/catalogGroups.js';
import {selectCatalogCollections} from '../src/utils/catalogCategoryView.js';

const grid=readFileSync(new URL('../src/components/ProductGrid.jsx',import.meta.url),'utf8');
const app=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');

test('all configured categories including Discounts and All Products are visible without horizontal scrolling',()=>{
  assert.equal(categories.length,11);
  assert.match(grid,/categoryChoices\.map\(c => <button/);
  assert.match(grid,/\.\.\.allCategories\.map\(item =>/);
  assert.match(grid,/slug:'all', name:'All Products'/);
  assert.match(grid,/grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6/);
  assert.doesNotMatch(grid,/<nav[^>]*overflow-x-auto/);
});

test('a selected category lists all 35 distinct tools, not 8 or 20 cards, with individual plans kept on tool page',()=>{
  const imported=Array.from({length:35}, (_,i)=>({
    slug:`design-${i}`,brand:`Design Brand ${i}`,category:'creative-tools',
    count:3,minPrice:150+i,listedMinPrice:150+i,orderableMinPrice:150+i,availableCount:3
  }));
  const groups=buildCatalogGroups([],imported);
  const selected=selectCatalogCollections(groups,{category:'creative-tools'});
  assert.equal(selected.length,35);
  assert.equal(new Set(selected.map(g=>g.slug)).size,35);
  assert.equal(selected.reduce((n,g)=>n+g.count,0),105);
  assert.match(grid,/filtered\.map\(group => <ImportedToolCard/);
  assert.doesNotMatch(grid,/filtered\.slice\(0,\s*shown\)/);
  assert.doesNotMatch(grid,/CatalogVariantCard|Load more tools/);
});

test('home catalogue defaults to All Products, category click resets narrowing filters in place',()=>{
  assert.match(app,/const \[category, setCategory\] = useState\("all"\)/);
  assert.doesNotMatch(app,/homeLimit=\{8\}/);
  assert.match(grid,/setCategory\?\.\(slug\)/);
  assert.match(grid,/setPrice\('all'\)/);
  assert.match(grid,/setSearch\(''\)/);
  assert.doesNotMatch(grid,/navigate\('\/products'\)/);
});
