import test from "node:test";
import assert from "node:assert/strict";
import { priceInfo, salePrice } from "../src/utils/discounts.js";
import { products } from "../src/data/products.js";

test("percentage sale pricing uses whole PKR", () => {
  assert.equal(salePrice(2200, { type: "percent", value: 20 }), 1760);
  assert.equal(salePrice(479, { type: "percent", value: 15 }), 407);
});
test("fixed rupees-off pricing and original prices remain unchanged", () => {
  const p = products.find((p) => p.slug === "chatgpt-plus");
  assert.equal(priceInfo(p, { [p.slug]: { type: "amount", value: 300 } }).price, p.price - 300);
  assert.equal(p.price, 2200);
  assert.equal(priceInfo(p, {}).onSale, false);
});
test("every plan on a multi-plan product is discounted", () => {
  const p = products.find((p) => p.slug === "adobe-creative");
  assert.deepEqual(p.options.map((option) => priceInfo(p, { [p.slug]: { type: "percent", value: 10 } }, option).price), [1530, 22500]);
});
test("sale price is never negative or more than the original", () => {
  assert.equal(salePrice(100, { type: "amount", value: 999 }), 1);
  assert.equal(salePrice(100, null), 100);
});
