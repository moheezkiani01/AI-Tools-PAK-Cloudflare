import test from "node:test";
import assert from "node:assert/strict";
import { products } from "../src/data/products.js";
import { applyProductDetails, editableProductDetails } from "../src/utils/productDetails.js";
import { regularPrice, salePrice } from "../src/utils/discounts.js";

test("every original field is editable without changing slug or prices", () => {
  const base = products.find((p) => p.slug === "chatgpt-plus");
  const before = editableProductDetails(base);
  const custom = { ...before, name: "ChatGPT Plan", description: "New details", category: "professional", duration: "2 Months", months: [2],
    type: "Private account", limit: "Extra usage", features: ["Feature 1", "Feature 2"], delivery: "Delivery by email", terms: "Additional term", popular: false };
  const result = applyProductDetails(base, custom);
  for (const field of ["name", "description", "category", "duration", "months", "type", "limit", "features", "delivery", "terms", "popular"])
    assert.deepEqual(result[field], custom[field]);
  assert.equal(result.slug, base.slug);
  assert.equal(result.price, base.price);
  assert.equal(base.name, "ChatGPT Plus");
});

test("renamed plans preserve stable keys for carts and saved plan prices", () => {
  const base = products.find((p) => p.slug === "adobe-creative");
  const edited = applyProductDetails(base, { optionLabels: ["Two-month plan", "Annual plan"] });
  assert.deepEqual(edited.options.map((o) => o.label), ["Two-month plan", "Annual plan"]);
  assert.deepEqual(edited.options.map((o) => o.key), base.options.map((o) => o.label));
  const prices = { "adobe-creative": { options: { "2 Months": 2000, "1 Year": 25000 } } };
  assert.equal(regularPrice(edited, edited.options[0], prices), 2000);
  assert.equal(regularPrice(edited, edited.options[1], prices), 25000);
  assert.equal(salePrice(regularPrice(edited, edited.options[0], prices), { type: "percent", value: 20 }), 1600);
  assert.equal(regularPrice(edited, null, prices), 2000);
});

test("saved overrides do not permit changing the product price through detail fields", () => {
  const base = products.find((p) => p.slug === "gemini-pro");
  const merged = applyProductDetails(base, { price: 1, slug: "wrong", options: [{ label: "fake", price: 1 }] });
  assert.equal(merged.price, base.price);
  assert.equal(merged.slug, base.slug);
  assert.equal(merged.options, undefined);
});
