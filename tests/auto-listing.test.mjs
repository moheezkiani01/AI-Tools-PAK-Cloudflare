import test from 'node:test';
import assert from 'node:assert/strict';
import { eligibleForPublicListing } from '../server/catalog.js';
import { prepareCatalog, readSources } from '../scripts/catalog-utils.mjs';
import { products } from '../src/data/products.js';

test('unflagged pending records are automatically shown without per-product admin approval', () => {
  assert.equal(eligibleForPublicListing({status:'pending',review_flags:[]}), true);
  assert.equal(eligibleForPublicListing({status:'published',review_flags:[]}), true);
});
test('flagged pending plans remain visible for review, while hidden and rejected stay hidden', () => {
  assert.equal(eligibleForPublicListing({status:'pending',review_flags:['credential']}), true);
  assert.equal(eligibleForPublicListing({status:'hidden',review_flags:[]}), false);
  assert.equal(eligibleForPublicListing({status:'rejected',review_flags:[]}), false);
  assert.equal(eligibleForPublicListing({status:'pending'}), true);
});
test('automatic catalog policy does not depend on supplier costs or sales counts', () => {
  const listing={status:'pending',review_flags:[],cost_cents:100,source_ids:['private'],sales:5000};
  assert.equal(eligibleForPublicListing(listing),true);
});
