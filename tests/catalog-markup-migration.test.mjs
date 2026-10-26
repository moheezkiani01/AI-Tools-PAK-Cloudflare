import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MARKUP_PERCENT, pricePkr, costCents } from '../scripts/catalog-utils.mjs';

const initialSql = fs.readFileSync(new URL('../supabase/catalog_migration.sql', import.meta.url), 'utf8');
const upgradeSql = fs.readFileSync(new URL('../supabase/catalog_markup_25.sql', import.meta.url), 'utf8');

test('all import and repricing functions use 25% rather than 15%', () => {
  assert.equal(MARKUP_PERCENT, 25);
  for (const sql of [initialSql, upgradeSql]) {
    assert.doesNotMatch(sql, /\*\s*1\.15\b/);
    assert.match(sql, /ai_tools_import_catalog\(rows jsonb\)/);
    assert.match(sql, /ai_tools_reprice_catalog\(\)/);
    assert.match(sql, /\*\s*1\.25\b/);
  }
});

test('new pricing recomputes from USD cost, using half-up PKR rounding', () => {
  for (const [usd, expected] of [['0.01',4], ['1',375], ['3.77',1414], ['10',3750], ['100',37500]]) {
    assert.equal(pricePkr(costCents(usd), 300), expected);
  }
});

test('existing catalog migration updates calculated price only, not manual overrides or orders', () => {
  assert.match(upgradeSql, /\bbegin;/i);
  assert.match(upgradeSql, /\bcommit;/i);
  assert.match(upgradeSql, /update public\.ai_tools_catalog as c/i);
  assert.match(upgradeSql, /c\.cost_cents::numeric/);
  assert.match(upgradeSql, /c\.price_pkr is distinct from/i);
  assert.doesNotMatch(upgradeSql, /set\s+(?:manual_price_pkr|discount_percent)\s*=/i);
  assert.doesNotMatch(upgradeSql, /\b(?:drop|truncate|delete)\s+(?:table|from|public)/i);
});
