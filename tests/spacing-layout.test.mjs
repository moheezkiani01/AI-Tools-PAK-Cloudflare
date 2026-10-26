import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
test("Category cards lead directly into the tool finder with compact spacing", () => {
  const app = read("App.jsx");
  const finder = read("components/ToolFinder.jsx");
  assert.match(app, /id="categories" className="[^"]*pb-4/);
  assert.match(finder, /id="finder" className="[^"]*pt-5/);
  assert.match(app, /sm:grid-cols-2 xl:grid-cols-3/);
});
test("Home sections no longer have oversized vertical padding", () => {
  for (const file of ["App.jsx", "components/ToolFinder.jsx", "components/ProductGrid.jsx", "components/HowItWorks.jsx", "components/OrdersChart.jsx", "components/WhyChoose.jsx", "components/FAQ.jsx", "components/Contact.jsx"]) {
    assert.doesNotMatch(read(file), /py-20/, file);
  }
});
test("Standalone catalogue pages avoid adding two large top gaps", () => {
  assert.match(read("components/CategoryPage.jsx"), /compactTop/);
  assert.match(read("components/ProductGrid.jsx"), /compactTop \?/);
});
