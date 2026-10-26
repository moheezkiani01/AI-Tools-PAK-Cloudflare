import { isApiOffer, apiIdentity, displayCategory, customerBrand } from './catalogTaxonomy.js';
// One customer-facing collection per brand, regardless of how many plans it has.
// Public grouping never reads supplier costs, credentials or private product fields.
const aliases = [
  [/^chatgpt|^gpt[ -]?(plus|pro|go)\b/i, ['chatgpt', 'ChatGPT']],
  [/^gemini|^google ai/i, ['gemini', 'Gemini']],
  [/^claude/i, ['claude', 'Claude']],
  [/^supergrok|^grok/i, ['grok', 'Grok']],
  [/^elevenlabs/i, ['elevenlabs', 'ElevenLabs']],
  [/^veo\b/i, ['veo', 'Google Veo']],
  [/^runway/i, ['runway', 'Runway']],
  [/^leonardo/i, ['leonardo-ai', 'Leonardo AI']],
  [/^canva/i, ['canva', 'Canva']],
  [/^capcut/i, ['capcut', 'CapCut']],
  [/^adobe/i, ['adobe', 'Adobe']],
  [/^figma/i, ['figma', 'Figma']],
  [/^helium[ -]?10/i, ['helium-10', 'Helium 10']],
  [/^success[. ]?ai/i, ['success-ai', 'Success.ai']],
  [/^youtube/i, ['youtube', 'YouTube']],
  [/^prime video|^amazon prime/i, ['amazon-prime', 'Prime Video']],
  [/^n8n\b/i, ['n8n', 'n8n']],
  [/^manus/i, ['manus', 'Manus']],
  [/^perplexity/i, ['perplexity', 'Perplexity']],
  [/^windows/i, ['microsoft', 'Microsoft']],
  [/^nordvpn/i, ['nordvpn', 'NordVPN']],
  [/^surfshark/i, ['surfshark', 'Surfshark']],
  [/^quillbot/i, ['quillbot', 'QuillBot']],
  [/^vidiq/i, ['vidiq', 'vidIQ']],
  [/^playht|^play\.ht/i, ['playht', 'PlayHT']],
];
export const brandIdentity = (product) => {
  if (isApiOffer(product)) return apiIdentity(product);
  const candidate = String(customerBrand(product) || product.name || product.slug || '').trim();
  for (const [pattern, [slug, name]] of aliases) {
    if (pattern.test(candidate)) return { slug, brand: name };
  }
  const words = candidate.split(/[\s(]+/).filter(Boolean);
  const brand = product.brand || words.slice(0, words[0]?.length <= 3 ? 2 : 1).join(' ') || 'AI Tool';
  return { brand, slug: String(brand).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') };
};

// Editorial relevance, NOT claimed sales/visitor statistics. Admin-featured listings are also prioritized.
export const editorialPicks = [
  'chatgpt', 'gemini', 'claude', 'canva', 'capcut', 'elevenlabs', 'perplexity',
  'adobe', 'figma', 'leonardo-ai', 'runway', 'grok', 'notion', 'grammarly',
  'cursor', 'replit', 'lovable', 'n8n', 'heygen', 'gamma', 'semrush', 'vidiq',
  'nordvpn', 'surfshark', 'youtube', 'netflix', 'microsoft', 'quillbot',
  'muse-ai-api', 'gpt-api', 'claude-api', 'gemini-api',
];
const rank = (slug) => { const index = editorialPicks.indexOf(slug); return index < 0 ? 1000 : index; };
const validPrice = (number) => number !== null && number !== undefined && number !== '' && Number.isFinite(Number(number)) && Number(number) > 0 ? Number(number) : null;
export function sortCatalogGroups(groups, sort = 'featured') {
  return [...groups].sort((a,b) => {
    if (sort === 'low') return a.minPrice - b.minPrice || a.brand.localeCompare(b.brand);
    if (sort === 'high') return b.minPrice - a.minPrice || a.brand.localeCompare(b.brand);
    if (sort === 'name-asc') return a.brand.localeCompare(b.brand);
    if (sort === 'name-desc') return b.brand.localeCompare(a.brand);
    return Number(!!b.adminFeatured) - Number(!!a.adminFeatured) ||
      rank(a.slug) - rank(b.slug) || a.brand.localeCompare(b.brand);
  });
}
export function buildCatalogGroups(products = [], importedGroups = [], { priceFor = (p) => ({price:p.price}), hasDiscount = () => false, isOut = () => false } = {}) {
  const groups = new Map();
  const ensure = (slug, brand, category) => {
    if (!groups.has(slug)) groups.set(slug, { slug, brand, category, count:0, minPrice:Infinity,
      legacyProducts: [], importedGroup: null, featured:false, adminFeatured:false, hasDiscount:false, available: false, orderableMinPrice: Infinity, listedMinPrice: Infinity });
    return groups.get(slug);
  };
  for (const p of products) {
    // Imported variants are already represented by the paged public group API.
    if (p.imported) continue;
    const identity = brandIdentity(p);
    if (!identity.slug) continue;
    const group = ensure(identity.slug, identity.brand, displayCategory(p));
    group.legacyProducts.push(p);
    group.count += p.options?.length || 1;
    const available = !isOut(p.slug) && !p.unavailable;
    group.available ||= available;
    if (available) {
      const prices = p.options?.length ? p.options.map(o => validPrice(priceFor(p,o).price)) : [validPrice(priceFor(p).price)];
      for (const price of prices) if (price !== null) {
        group.minPrice = Math.min(group.minPrice, price);
        group.orderableMinPrice = Math.min(group.orderableMinPrice, price);
      }
    }
    group.hasDiscount ||= hasDiscount(p.slug);
    group.featured ||= !!p.popular;
  }
  for (const imported of importedGroups) {
    // The API returns canonical group slugs (claude-api, gpt-api, muse-ai-api).
    // Keep those identities instead of recomputing an API summary as a normal
    // Claude/ChatGPT subscription: summaries do not include product names.
    const identity = brandIdentity({
      brand: imported.brand, name: imported.brand,
      groupSlug: imported.slug, category: imported.category,
    });
    const category = imported.category === 'api-tools' ? 'api-tools' : displayCategory(imported);
    const slug = category === 'api-tools' ? (imported.slug || identity.slug) : (identity.slug || imported.slug);
    if (!slug) continue;
    const group = ensure(slug, category === 'api-tools' ? (imported.brand || identity.brand) : identity.brand, category);
    // Never replace an existing normal tool collection with an API provider.
    group.category = category;
    group.importedGroup = imported;
    group.count += Number(imported.count) || 0;
    const listedPrice = validPrice(imported.listedMinPrice ?? imported.minPrice);
    const livePrice = validPrice(imported.orderableMinPrice ?? (imported.availableCount !== 0 ? imported.minPrice : null));
    if (listedPrice !== null) group.listedMinPrice = Math.min(group.listedMinPrice, listedPrice);
    if (livePrice !== null) {
      group.orderableMinPrice = Math.min(group.orderableMinPrice, livePrice);
      // Imported plan prices are current and take precedence over legacy prices
      // when an imported orderable plan exists.
      group.importedMinPrice = Math.min(group.importedMinPrice ?? Infinity, livePrice);
      group.minPrice = group.importedMinPrice;
    } else if (listedPrice !== null && !Number.isFinite(group.orderableMinPrice)) {
      // Nothing orderable in this collection: show a labelled reference price.
      group.minPrice = Math.min(group.minPrice, listedPrice);
    }
    group.available ||= (Number(imported.availableCount ?? imported.count) || 0) > 0;
    group.adminFeatured ||= !!imported.featured;
    group.featured ||= !!imported.featured;
    group.hasDiscount ||= !!imported.hasDiscount;
    group.needsConfirmation ||= !!imported.needsConfirmation;
  }
  return sortCatalogGroups([...groups.values()].filter(g => g.count && Number.isFinite(g.minPrice)).map(g => ({
    ...g, priceIsEnquiryOnly:!Number.isFinite(g.orderableMinPrice),
  })));
}
