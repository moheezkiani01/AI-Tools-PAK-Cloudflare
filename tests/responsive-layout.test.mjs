import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = name => readFileSync(new URL(`../src/components/${name}`, import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

test('navigation uses full desktop links only at wide (xl) breakpoint', () => {
  const nav = read('Navbar.jsx');
  assert.match(nav, /hidden items-center gap-8 xl:flex/);
  assert.match(nav, /xl:hidden/);
  assert.match(nav, /aria-expanded=\{menuOpen\}/);
});
test('main product listing provides mobile and desktop grids', () => {
  const grid = read('ProductGrid.jsx');
  assert.match(grid, /sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4/);
  assert.match(grid, /grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6/);
});
test('homepage categories reflow to two and three columns without clipping categories', () => {
  assert.match(app, /sm:grid-cols-2 xl:grid-cols-3/);
  assert.match(app, /categories.map\(\(c\) => <CategoryCard/);
});
test('checkout and product details stack on mobile', () => {
  assert.match(read('Checkout.jsx'), /lg:grid-cols-\[1fr_380px\]/);
  assert.match(read('ProductDetails.jsx'), /lg:grid-cols-\[1fr_380px\]/);
});
test('mobile product bottom bar allows titles to shrink and prices to wrap', () => {
  const details = read('ProductDetails.jsx');
  assert.match(details, /min-w-0 flex-1/);
  assert.match(details, /truncate text-xs/);
  assert.match(details, /btn-primary shrink-0 px-4/);
});
test('cart drawer fits viewport and breaks long text', () => {
  const cart = read('Cart.jsx');
  assert.match(cart, /w-full max-w-md/);
  assert.match(cart, /min-w-0 break-words/);
  assert.match(cart, /bg-\[#d9fdd3\]/);
});
test('product cards keep mobile action buttons flexible', () => {
  const product = read('ProductCard.jsx');
  assert.match(product, /grid grid-cols-2 gap-2/);
  assert.match(product, /btn-primary min-w-0/);
  assert.match(product, /btn-ghost min-w-0/);
});
test('compare table scrolls inside its own container', () => {
  const compare = read('ComparePage.jsx');
  assert.match(compare, /overflow-x-auto/);
  assert.match(compare, /min-w-\[720px\]/);
});
test('admin navigation provides a narrow-screen selector instead of an overflowing tab row', () => {
  assert.match(read('AdminPage.jsx'), /admin-mobile-nav/);
  assert.match(read('AdminPage.jsx'), /admin-section-picker/);
  assert.match(read('AdminPage.jsx'), /navItems/);
  const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  assert.match(css, /max-width: 800px/);
  assert.match(css, /\.admin-sidebar \{ display: none; \}/);
});
test('header and review title can avoid long-name overflow', () => {
  assert.match(read('ReviewPage.jsx'), /min-w-0 break-words/);
  assert.match(read('Hero.jsx'), /min-\[420px\]:flex-nowrap/);
});
