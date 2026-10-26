import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('build prerenders canonical brand collection pages and includes them in sitemap',()=>{
 const source=read('scripts/prerender.mjs');
 assert.match(source,/brandGroups\.map/);
 assert.match(source,/`\/tool\/\$\{g\.slug\}`/);
 assert.match(source,/CollectionPage/);
 assert.match(source,/FAQPage/);
 assert.match(source,/sitemap\.xml/);
});
test('product structured data does not publish outdated admin-editable offer prices',()=>{
 const source=read('scripts/prerender.mjs');
 const productSchema=source.split('const productSchema = (p) => {')[1].split('\n};')[0];
 assert.doesNotMatch(productSchema,/priceCurrency|InStock|AggregateOffer/);
});
test('SPA links maintain canonical URL after in-app navigation',()=>{
 const app=read('src/App.jsx');
 assert.match(app,/document\.head\.querySelector\('link\[rel="canonical"\]'\)/);
 assert.match(app,/window\.location\.origin/);
});
