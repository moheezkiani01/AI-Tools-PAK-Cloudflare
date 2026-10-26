import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const page = readFileSync(new URL('../src/components/AdminPage.jsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');

test('admin has navigation to every existing management feature', () => {
  for (const id of ['catalog', 'trash', 'orders', 'questions', 'reviews', 'products', 'details', 'prices', 'discounts', 'purchases']) {
    assert.match(page, new RegExp(`id: "${id}"`));
    assert.ok(page.includes(`view === "${id}"`) || page.includes('"catalog", "trash", "products", "discounts", "prices"') && ['catalog','trash','products','discounts','prices'].includes(id), `missing view ${id}`);
  }
});
test('dashboard statistics are loaded from existing endpoint rather than hard-coded numbers', () => {
  assert.match(page, /fetch\("\/api\/stats"/);
  assert.match(page, /stats\?\.total/);
  assert.match(page, /stats\?\.website/);
  assert.match(page, /waiting.length/);
  assert.match(page, /\/api\/admin\/catalog\?limit=1/);
  assert.match(page, /catalogStats\.total/);
  assert.doesNotMatch(page, /Catalogue health/);
  assert.doesNotMatch(page, /id: "imports"/);
});
test('customer question answering and faq publication endpoints are unchanged', () => {
  assert.match(page, /questions\/\$\{encodeURIComponent\(q.id\)\}\/answer/);
  assert.match(page, /questions\/\$\{encodeURIComponent\(q.id\)\}\/publish/);
  assert.match(page, /faqBusy/);
});
test('question inbox allows search and status filtering', () => {
  assert.match(page, /setQuestionSearch/);
  assert.match(page, /tab === "waiting"/);
  assert.match(page, /setTab\("answered"\)/);
});
test('responsive admin avoids off-screen sidebar and keeps mobile navigation', () => {
  assert.match(page, /admin-mobile-nav/);
  assert.match(page, /admin-section-picker/);
  assert.match(styles, /@media \(max-width: 800px\)/);
  assert.match(styles, /\.admin-sidebar \{ display: none; \}/);
});
