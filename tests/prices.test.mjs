import test from "node:test";
import assert from "node:assert/strict";
import { priceInfo, regularPrice } from "../src/utils/discounts.js";
import { products } from "../src/data/products.js";
const p = (slug) => products.find((item) => item.slug === slug);

test("single product regular price override and percentage discount", () => {
  const product = p("chatgpt-plus");
  const overrides = { [product.slug]: { price: 3000 } };
  const discounts = { [product.slug]: { type: "percent", value: 20 } };
  assert.deepEqual(priceInfo(product, discounts, null, overrides),
    { original: 3000, price: 2400, onSale: true, rule: discounts[product.slug] });
  assert.equal(product.price, 2200);
});
test("different edited prices for multiple plans, cheapest shown in grid", () => {
  const product = p("adobe-creative");
  const prices = { [product.slug]: { options: { "2 Months": 2000, "1 Year": 26000 } } };
  assert.equal(regularPrice(product, null, prices), 2000);
  assert.equal(priceInfo(product, {}, product.options[1], prices).price, 26000);
  const discount = { [product.slug]: { type: "amount", value: 500 } };
  assert.equal(priceInfo(product, discount, product.options[0], prices).price, 1500);
  assert.equal(priceInfo(product, discount, product.options[1], prices).price, 25500);
});
test("without an override prices stay at catalog defaults", () => {
  assert.equal(regularPrice(p("chatgpt-plus")), 2200);
  assert.equal(regularPrice(p("replit-core")), 3200);
});
