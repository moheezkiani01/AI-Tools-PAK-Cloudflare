import { sortCatalogGroups } from './catalogGroups.js';

const priceRanges = { under1000:[0,999], mid:[1000,2500], high:[2501,10000], premium:[10001,Infinity] };
const durationRanges = {
  short: months => months !== null && months <= 2,
  medium: months => months !== null && months >= 3 && months <= 6,
  long: months => months !== null && months >= 12,
};
function durationMonths(value) {
  const text = String(value || '').toLowerCase();
  let match = text.match(/(\d+)\s*(?:months?|mos?\b)/);
  if (match) return Number(match[1]);
  match = text.match(/(\d+)\s*(?:years?|yrs?\b)/);
  if (match) return Number(match[1]) * 12;
  match = text.match(/(\d+)\s*(?:days?|d\b)/);
  return match ? Number(match[1]) / 30 : null;
}

// Filter the already-deduplicated collection summaries, not individual plans.
// extra contains search-only matches returned by the server so a search for
// a subscription name finds its parent collection without making another card.
export function selectCatalogCollections(groups, {category='all',search='',apiProvider='all',price='all',duration='all',popularity='all',sort='featured',extra=[]}={}) {
  const term = String(search).trim().toLowerCase();
  return sortCatalogGroups(groups.filter(group => {
    const legacy = group.legacyProducts || [];
    if (term && !(`${group.brand} ${group.slug}`.toLowerCase().includes(term)
      || legacy.some(p => `${p.name} ${p.description} ${p.duration || ''}`.toLowerCase().includes(term))
      || extra.some(p => p.slug === group.importedGroup?.slug || p.brand === group.brand))) return false;
    if (category === 'discounts' ? !group.hasDiscount : category !== 'all' && group.category !== category) return false;
    if (category === 'api-tools' && apiProvider !== 'all' && group.slug !== apiProvider) return false;
    if (price !== 'all' && priceRanges[price] && (group.minPrice < priceRanges[price][0] || group.minPrice > priceRanges[price][1])) return false;
    if (popularity === 'popular' && !group.featured && !group.adminFeatured) return false;
    if (duration !== 'all' && durationRanges[duration]
      && !legacy.some(p => (p.months || []).some(durationRanges[duration]) || durationRanges[duration](durationMonths(p.duration)))
      && !(group.importedGroup?.durations || []).some(d => durationRanges[duration](durationMonths(d)))) return false;
    return true;
  }), sort);
}
