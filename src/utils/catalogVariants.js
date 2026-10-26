import { displayCategory } from './catalogTaxonomy.js';
import { brandIdentity, editorialPicks } from './catalogGroups.js';
const normalized = x => String(x || '').toLowerCase();
export function makeCatalogVariants(legacyProducts = [], importedProducts = [], priceFor = p => ({price:p.price})) {
  const merged = new Map();
  for (const p of legacyProducts) {
    if (p.imported) continue;
    const identity = brandIdentity(p);
    const options = p.options?.length ? p.options : [null];
    options.forEach((o, i) => {
      const priceData = priceFor(p, o);
      const value = Number(priceData.price);
      if (!Number.isFinite(value) || value < 0) return;
      const name = o ? `${p.name} — ${o.label}` : p.name;
      const id = `${p.slug}:${i}`;
      merged.set(id,{id,slug:p.slug,brand:identity.brand,groupSlug:identity.slug,icon:p.slug,
        name,category:displayCategory(p),description:p.description||'',duration:o?.label||p.duration||'',optionIndex:o?i:null,price:value,
        featured:!!p.popular,unavailable:!!p.unavailable,discounted:!!priceData.onSale});
    });
  }
  for (const p of importedProducts) {
    if (!p?.slug) continue;
    merged.set(p.slug,{id:p.slug,slug:p.slug,brand:p.brand,groupSlug:p.category === 'api-tools' ? (p.groupSlug || brandIdentity(p).slug) : (brandIdentity(p).slug || p.groupSlug),
      name:p.name,category:displayCategory(p),description:p.description||'',duration:p.variant||'',
      price:Number(p.finalPrice),featured:!!p.featured,unavailable:!!p.unavailable,restricted:!!p.restricted,discounted:Number(p.discountPercent)>0});
  }
  return [...merged.values()].filter(p=>Number.isFinite(p.price) && p.price >= 0);
}
const rank = group => {const i = editorialPicks.indexOf(group);return i < 0 ? 1000 : i;};
export function sortVariants(items, sort = 'featured') {
  return [...items].sort((a,b)=>{
    if (sort === 'low') return a.price-b.price || a.name.localeCompare(b.name);
    if (sort === 'high') return b.price-a.price || a.name.localeCompare(b.name);
    if (sort === 'name-asc') return a.name.localeCompare(b.name);
    if (sort === 'name-desc') return b.name.localeCompare(a.name);
    return Number(!!b.featured)-Number(!!a.featured) || rank(a.groupSlug)-rank(b.groupSlug) ||
      a.name.localeCompare(b.name);
  });
}
export const textMatches = (p, term) => !term || normalized(`${p.name} ${p.brand} ${p.duration} ${p.description}`).includes(normalized(term));
