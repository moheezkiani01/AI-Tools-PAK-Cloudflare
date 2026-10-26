// The server owns the active discount rules. Never trust a price sent by the browser.
export function salePrice(original, rule) {
  if (!rule || !Number.isFinite(original) || original <= 0) return original;
  const n = Number(rule.value);
  if (!Number.isFinite(n) || n <= 0) return original;
  const result = rule.type === "percent" ? Math.round(original * (100 - n) / 100) : original - n;
  return Math.max(1, Math.min(original, result));
}
// Admin-edited regular prices are stored separately from the product catalog defaults.
// For products with several plans, show the cheapest edited plan as the "from" price.
export function regularPrice(product, option = null, prices = {}) {
  const record = prices?.[product.slug];
  if (product.options?.length) {
    if (option) return record?.options?.[option.key || option.label] ?? option.price;
    return Math.min(...product.options.map((o) => record?.options?.[o.key || o.label] ?? o.price));
  }
  return record?.price ?? product.price;
}

export function priceInfo(product, discounts = {}, option = null, prices = {}) {
  const original = regularPrice(product, option, prices);
  const price = salePrice(original, discounts[product.slug]);
  return { original, price, onSale: price < original, rule: discounts[product.slug] || null };
}
