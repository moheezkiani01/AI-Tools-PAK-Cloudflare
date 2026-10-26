import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deletedStatus, restoredStatus } from '../server/productDeletion.js';
import { adminCatalog } from '../server/catalog.js';

const file = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const page = file('../src/components/AdminPage.jsx');
const workspace = file('../src/components/AdminCatalogWorkspace.jsx');
const css = file('../src/index.css');
const migration = file('../supabase/catalog_delete_restore.sql');

test('Admin has a dedicated Deleted items / Restore sidebar and quick action', () => {
  assert.match(page, /id: "trash", name: "Deleted items \/ Restore"/);
  assert.match(page, /\["catalog", "trash", "products", "discounts", "prices"\]\.includes\(view\)/);
  assert.match(page, /onNavigate=\{openView\}/);
  assert.match(page, /onClick=\{\(\) => openView\(item\.id\)\}/);
  assert.match(workspace, /mode === "trash" \? "deleted" : "all"/);
  assert.match(workspace, /onNavigate\?\.\("trash"\)/);
});

test('Both types of product show the action first; delete and restore have distinct styles', () => {
  assert.match(workspace, /aria-label=\{`\$\{isDeleted \? "Restore" : "Delete"\} \$\{p.name\}`\}/);
  assert.match(workspace, /aria-label=\{`\$\{isDeleted \? "Restore" : "Delete"\} \$\{row.name\}`\}/);
  assert.equal((workspace.match(/admin-restore-button/g) || []).length, 2);
  assert.equal((workspace.match(/admin-danger-button/g) || []).length, 2);
  assert.match(css, /\.admin-restore-button/);
  assert.match(css, /\.admin-danger-button/);
});

test('Delete/Restore requires an actual successful API result before showing success', () => {
  assert.match(workspace, /data\.ok !== true \|\| data\.slug !== row\.slug \|\| data\.deleted !== !deleted/);
  assert.match(workspace, /POST/);
  assert.match(workspace, /\/api\/admin\/products\/\$\{encodeURIComponent\(row\.slug\)\}/);
  assert.match(workspace, /mode === "trash" \? "deleted" : "all"/);
});

test('Sidebar has independent bounded vertical scrolling on desktop, mobile keeps dropdown', () => {
  assert.match(css, /max-height:\s*calc\(100dvh - 2rem\)/);
  assert.match(css, /overflow-y:\s*auto/);
  assert.match(css, /overscroll-behavior-y:\s*contain/);
  assert.match(page, /className="admin-mobile-nav"/);
  assert.match(workspace, /scrollIntoView\(\{ block: "start", behavior: "auto" \}\)/);
});

test('Restore preserves the previous status and does not require new storage', () => {
  for (const status of ['pending', 'published', 'hidden', 'rejected']) {
    assert.equal(restoredStatus(deletedStatus(status)), status);
  }
  assert.doesNotMatch(migration, /CREATE\s+TABLE|ADD\s+COLUMN/i);
});
