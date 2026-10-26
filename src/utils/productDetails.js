// Public catalogue fields editable by the store administrator. Slugs and plan keys
// are permanent internal identifiers; retail prices are handled by the price editor.
export function applyProductDetails(product, changes = {}) {
  const fields = ["name", "category", "description", "duration", "limit", "type", "features", "delivery", "terms", "popular"];
  const merged = { ...product };
  for (const field of fields) if (Object.prototype.hasOwnProperty.call(changes, field)) merged[field] = changes[field];
  if (Object.prototype.hasOwnProperty.call(changes, "months")) merged.months = changes.months;
  if (Array.isArray(product.options)) {
    merged.options = product.options.map((option, i) => ({
      ...option,
      key: option.key || option.label,
      label: changes.optionLabels?.[i] || option.label,
    }));
  }
  return merged;
}

export function editableProductDetails(product) {
  return {
    name: product.name, category: product.category, description: product.description,
    duration: product.duration || "", months: [...(product.months || [])], limit: product.limit || "",
    type: product.type || "", features: product.features || [],
    delivery: product.delivery || "", terms: product.terms || "", popular: !!product.popular,
    optionLabels: product.options?.map((o) => o.label) || [],
  };
}
