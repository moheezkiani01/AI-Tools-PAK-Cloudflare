import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = file=>fs.readFileSync(file,'utf8');

test('homepage preserves the original categories and unified catalogue; new groups are inside it',()=>{
 const app=read('src/App.jsx');
 assert.match(app,/useState\("all"\)/);
 assert.match(app,/<CategoryCard[^>]*catalogGroups=\{catalogGroups\}/);
 assert.match(app,/<ProductGrid[^>]*catalogGroups=\{catalogGroups\}/);
 assert.doesNotMatch(app,/<ImportedGroups home\s*\/>/);
});
test('all categories list each tool once with plan count and starting PKR price',()=>{
 const card=read('src/components/CategoryCard.jsx');
 assert.match(card,/catalogGroups\.filter/);
 assert.match(card,/group\.count/);
 assert.match(card,/formatPrice\(group\.minPrice\)/);
 assert.match(card,/href=\{`\/tool\//);
});
test('product catalogue opens collection detail and has All Products as the home default',()=>{
 const grid=read('src/components/ProductGrid.jsx');
 const app=read('src/App.jsx');
 assert.match(grid,/category='all'/);
 assert.match(grid,/ImportedToolCard/);
 assert.match(grid,/sortCatalogGroups/);
 assert.match(grid,/name-asc/);
 assert.match(app,/group=\{catalogGroups\.find/);
});
test('known official domains and graceful logo fallback remain',()=>{
 const logos=read('src/components/BrandIcon.jsx');
 assert.match(logos,/brandDomains\[key\]/);
 assert.match(logos,/setFailed\(true\)|setAttempt\(\(current\) => current \+ 1\)/);
 assert.match(read('src/data/brandDomains.js'),/"wink": "wink\.ai"/);
});
test('backend catalog remains non-public for sensitive supplier costs',()=>{
 const catalog=read('server/catalog.js');
 assert.match(catalog,/hasDiscount/);
 assert.doesNotMatch(catalog.split('const SELECT = ')[1].split(';')[0],/cost_cents|source_ids/);
});
