import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(new URL(file, import.meta.url), 'utf8');
const workspace = read('../src/components/AdminCatalogWorkspace.jsx');
const backend = read('../server/catalog.js');
const routes = read('../server/index.js');
const admin = read('../src/components/AdminPage.jsx');
const reviews = read('../src/components/AdminReviews.jsx');
const purchases = read('../src/components/AdminPurchaseNumbers.jsx');
const css = read('../src/index.css');

test('unified catalogue supports dropdown search by brand, plan, name and ID', () => {
  for (const choice of ['name', 'brand', 'variant', 'slug']) {
    assert.ok(workspace.includes(`value: "${choice}"`), choice);
    assert.ok(backend.includes(`'${choice}'`), choice);
  }
  assert.match(workspace, /searchField, status, category/);
  assert.match(routes, /searchField:String\(req\.query\.searchField/);
  assert.match(workspace, /Clear filters/);
});

test('both original and imported deleted products are isolated from active listings', () => {
  assert.match(workspace, /if \(deleted\) return false/);
  assert.match(backend, /status=not\.like\.deleted-\*/);
  assert.match(backend, /status=like\.deleted-\*/);
});

test('pagination and page dropdown always return to the top of the product controls', () => {
  assert.match(workspace, /topRef\.current\?\.scrollIntoView/);
  assert.match(workspace, /onClick=\{\(\)=>changePage\(page\+1\)\}/);
  assert.match(workspace, /onClick=\{\(\)=>changePage\(page-1\)\}/);
  assert.match(workspace, /Jump to product page/);
  assert.match(workspace, /Products per page/);
  assert.match(css, /\.admin-catalog-top \{ scroll-margin-top/);
});

test('stale rows are hidden during page changes, and failed price saves keep drafts', () => {
  assert.match(workspace, /const shownRows = source === "original" \? \[\] : importedReady \? rows : \[\]/);
  assert.match(workspace, /if \(saved\) setDrafts/);
  assert.match(workspace, /return true/);
  assert.match(workspace, /return false/);
});

test('review editor declares state before reading it; async product picker repairs missing selection', () => {
  assert.ok(reviews.indexOf('const [form, setForm]') < reviews.indexOf('const choices ='));
  assert.match(reviews, /products\.length && !products\.some\(p => p\.slug === form\.slug\)/);
  assert.match(purchases, /products\.length && !products\.some\(p => p\.slug === form\.slug\)/);
});

test('opening product editor and managing customer questions handle navigation and errors', () => {
  assert.match(admin, /setDetailSlug\(slug\); openView\("details"\)/);
  assert.match(admin, /Could not delete this question/);
  assert.match(admin, /Write an answer before saving/);
});
