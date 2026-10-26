import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { categories } from '../src/data/categories.js';

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const grid = readFileSync(new URL('../src/components/ProductGrid.jsx', import.meta.url), 'utf8');
const order = categories.map((item) => item.slug);

test('every configured category, including education, business, API and Discounts, appears in catalogue', () => {
  assert.equal(order.length, 11);
  assert.deepEqual(order.slice(-4), ['education-research', 'professional', 'api-tools', 'discounts']);
  assert.match(grid, /\.\.\.allCategories\.map\(item =>/);
  assert.match(grid, /slug:'all', name:'All Products'/);
});

test('homepage shows category cards in a responsive grid rather than a fixed four-card selection', () => {
  assert.match(app, /sm:grid-cols-2 xl:grid-cols-3/);
  assert.match(app, /categories\.map\(\(c\) => <CategoryCard/);
  assert.doesNotMatch(app, /categories\.slice\(0,\s*8\)/);
});
