// Shared, display-only classification for legacy and imported listings.
// API subscriptions belong to their own provider collections; we never mutate
// the original supplier record, price, or existing orders to achieve this.
const normalize = value => String(value || '').trim().toLowerCase();
const apiWord = /\b(?:api|api-key|api-keys)\b/i;
const apiProviderMatchers = [
  [/\bmuse[ ._-]*ai\b|\bmuse\b/i, ['muse-ai-api', 'Muse AI API']],
  [/\b(?:chatgpt|openai|gpt|codex)\b/i, ['gpt-api', 'GPT API']],
  [/\b(?:claude|anthropic)\b/i, ['claude-api', 'Claude API']],
  [/\b(?:gemini|google ai)\b/i, ['gemini-api', 'Gemini API']],
  [/\b(?:grok|xai|x\.ai)\b/i, ['grok-api', 'Grok API']],
  [/\bdeepseek\b/i, ['deepseek-api', 'DeepSeek API']],
  [/\bperplexity\b/i, ['perplexity-api', 'Perplexity API']],
  [/\bkimi\b/i, ['kimi-api', 'Kimi API']],
];
export const isApiOffer = product => {
  if (!product) return false;
  // Source names are the strongest signal. Many supplier records are tagged
  // "api-tools" simply because they contain ordinary creative-tool credits.
  const name = `${product.name || ''} ${product.variant || ''}`;
  const brand = String(product.brand || '');
  const groupSlug = String(product.groupSlug || product.group_slug || '');
  if (apiWord.test(name) || /\bzapi\b/i.test(name) || /\bapi\b/i.test(String(product.productType || product.product_type || ''))) return true;
  // Public group summaries have a provider name and slug but no plan name.
  // Do not accidentally fold "Claude API" back into ordinary "Claude".
  if (/\bapi$/i.test(brand) && normalize(brand) !== 'api tools') return true;
  if (/(?:^|-)api$/i.test(groupSlug)) return true;
  // Muse token access is an API offer even when "API" is omitted from its title.
  if (/\bmuse(?:[ ._-]*ai)?\b/i.test(name) && /\btokens?\b/i.test(name)) return true;
  // Other explicitly API-categorized token packages are APIs only when they
  // identify a known model/provider; normal image/audio credits are not.
  if (normalize(product.category) === 'api-tools' && /\btokens?\b|\brpm\b/i.test(name)) {
    return apiProviderMatchers.some(([pattern]) => pattern.test(name));
  }
  return false;
};

const creativeCreditBrands = /\b(?:akool|artlist|buzzy|cuta?y|davinci|domo|dreamina|krea|lartai|lumiying|minimax|morphic|newtake|openart|pollo|seedance|suno|tryclico|elser|byflux|ecoboms)\b/i;
// Correct display-only miscategorization from old imports; never rewrite DB.
export function nonApiImportedCategory(product) {
  const category = normalize(product?.category);
  if (category !== 'api-tools') return product?.category;
  const name = String(product?.name || '');
  return creativeCreditBrands.test(name) ? 'creative-tools' : 'ai-tools';
}

export function customerBrand(product) {
  const brand = String(product?.brand || '');
  if (normalize(brand) !== 'api tools' || isApiOffer(product)) return brand;
  const name = String(product?.name || '').replace(/^(?:account|upgrade|redeem)\s+/i,'').trim();
  const known = name.match(/^(?:Chinese Model|Discord Nitro|MiniMax|Artlist AI|OpenArt|Krea|Akool|Domo AI|Dreamina|Suno|Elser\.ai|LartAI|Morphic|PolloAI|Seedance|Buzzy|Byflux\.ai|Ecoboms|Cuty AI|Davinci|LumiYing AI|Newtake AI)/i);
  return known?.[0] || name.split(/\s+/)[0] || 'Other AI Tools';
}

export function apiIdentity(product) {
  const source = `${product?.name || ''} ${product?.brand || ''} ${product?.variant || ''}`;
  for (const [pattern, [slug, brand]] of apiProviderMatchers) {
    if (pattern.test(source)) return {slug, brand};
  }
  const name = String(product?.brand || '').replace(/\bapi(?: tools?)?\b/gi, '').trim();
  if (name) {
    const slug = name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0,55);
    if (slug) return {slug:`${slug}-api`,brand:`${name} API`};
  }
  return {slug:'other-api',brand:'Other AI APIs'};
}

export function displayCategory(product) {
  return isApiOffer(product) ? 'api-tools' : nonApiImportedCategory(product);
}
