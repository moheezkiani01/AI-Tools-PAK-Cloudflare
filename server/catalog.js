import { allCategories } from "../src/data/categories.js";
import { isApiOffer, apiIdentity, displayCategory, customerBrand } from '../src/utils/catalogTaxonomy.js';
import { supabaseRequest, StoreError } from './dataStore.js';
import { isDeletedStatus } from './productDeletion.js';
import { createRefreshAheadCache } from './refreshAheadCache.js';

// Only the safe public fields are selected. Cost price, supplier IDs, and
// review rules never leave the backend.
const SELECT = 'slug,group_slug,brand,name,description,category,variant,product_type,price_pkr,manual_price_pkr,discount_percent,featured,unavailable,status,review_flags';
// The public catalogue is complete: keep one card for each unique variant,
// including records that require supplier/resale verification. Review is an
// ORDERING restriction, not a reason to silently omit products from browsing.
// Explicitly hidden/rejected records still respect the administrator's choice.
// Costs, supplier IDs and review criteria are never sent to the browser.
const SUMMARY_SELECT = SELECT.replace('description,', '');
const publicQuery = (summary = false) => 'select=' + (summary ? SUMMARY_SELECT : SELECT) + '&status=in.(published,pending)';
export const eligibleForPublicListing = row => row?.status === 'published' || row?.status === 'pending';
export const requiresResaleVerification = row =>
  // A status toggle must never bypass uncleared review flags.
  (Array.isArray(row?.review_flags) && row.review_flags.length > 0) ||
  (row?.status !== 'published' && !Array.isArray(row?.review_flags));

const defaultCreativeBrands = new Set(['wink', 'meitu', 'beautycam', 'xingtu']);
// Safe display-only classification for imported brands. Does not change stored records or pricing.
export const browseCategory = (brand, category, name = "", productType = "") => {
  const brandName = String(brand || '').toLowerCase();
  if (isApiOffer({brand, category, name: name || '', productType})) return 'api-tools';
  if (category === 'api-tools') return displayCategory({brand,category,name,productType});
  if (/^(coursera|duolingo|kahoot|quizlet|udemy|turnitin)$/.test(brandName)) return 'education-research';
  if (category === 'productivity' && defaultCreativeBrands.has(brandName)) return 'creative-tools';
  return category;
};

const visible = (p) => {
  const category = browseCategory(p.brand, p.category, p.name, p.product_type);
  const api = category === 'api-tools' ? apiIdentity(p) : null;
  const brand = api?.brand || customerBrand(p);
  const fallbackGroup = !api && p.brand === 'API tools' ? brand.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') : null;
  const requiresReview = requiresResaleVerification(p);
  return {
    slug:p.slug, groupSlug:api?.slug || fallbackGroup || p.group_slug, brand,
    name:p.name, description:p.description, category,
    variant:p.variant, productType:p.product_type, featured:p.featured,
    // A flagged pending record can be browsed but must not be purchased.
    unavailable: !!p.unavailable || requiresReview, restricted: requiresReview, price:Number(p.manual_price_pkr ?? p.price_pkr),
    pricePkr:Number(p.manual_price_pkr ?? p.price_pkr), discountPercent:p.discount_percent,
    finalPrice:Math.round(Number(p.manual_price_pkr ?? p.price_pkr)*(100-p.discount_percent)/100),
    needsConfirmation:p.status === 'pending',
  };
};

// Checkout always uses findPublicVariant() and a fresh Supabase read.
// Anonymous catalogue browsing can safely reuse a short-lived snapshot.
// Requests arriving shortly BEFORE expiry trigger one background refresh,
// reducing expiry-time latency spikes on busy warm application instances.
// No expired snapshot is served; cache invalidation also cancels outdated
// refresh results so an admin edit can never re-install an older snapshot.
const PUBLIC_CACHE_MS = 8_000;
const PUBLIC_REFRESH_AHEAD_MS = 1_500;
const fetchPublicVariants = async (summary) => {
  const rows = [];
  const pageSize = 1000;
  for (let page = 0; page < 30; page++) {
    const list = await supabaseRequest(`ai_tools_catalog?${publicQuery(summary)}&order=slug&offset=${page * pageSize}&limit=${pageSize}`);
    if (!Array.isArray(list)) throw new StoreError('Invalid catalog response');
    rows.push(...list);
    if (list.length < pageSize) break;
  }
  return rows.filter(eligibleForPublicListing).map(visible);
};
const publicResults = {
  summary: createRefreshAheadCache(() => fetchPublicVariants(true), {
    ttlMs: PUBLIC_CACHE_MS, refreshAheadMs: PUBLIC_REFRESH_AHEAD_MS,
  }),
  full: createRefreshAheadCache(() => fetchPublicVariants(false), {
    ttlMs: PUBLIC_CACHE_MS, refreshAheadMs: PUBLIC_REFRESH_AHEAD_MS,
  }),
};
export function invalidatePublicCatalogCache() {
  publicResults.summary.invalidate();
  publicResults.full.invalidate();
}
export const allPublicVariants = ({ summary = false } = {}) =>
  (summary ? publicResults.summary : publicResults.full).get();

export async function findPublicVariant(slug) {
  if(!slug.startsWith('import-')) return null;
  const rows=await supabaseRequest(`ai_tools_catalog?${publicQuery()}&slug=eq.${encodeURIComponent(slug)}&limit=1`);
  return rows[0] && eligibleForPublicListing(rows[0]) ? visible(rows[0]) : null;
}

export async function listPublicGroups({search='',category='all',page=1,limit=12,featured=false}={}) {
  const list=await allPublicVariants({ summary: !search });
  const map=new Map();
  for(const v of list){
    if(category==='discounts'?!v.discountPercent:category!=='all'&&v.category!==category)continue;
    if(featured&&!v.featured)continue;
    if(search&&!`${v.brand} ${v.name} ${v.description}`.toLowerCase().includes(search.toLowerCase()))continue;
    if(!map.has(v.groupSlug))map.set(v.groupSlug,{
      slug:v.groupSlug,brand:v.brand,category:v.category,count:0,minPrice:Infinity,listedMinPrice:Infinity,orderableMinPrice:Infinity,
      featured:false,hasDiscount:false,availableCount:0,needsConfirmation:false,durations:[],
    });
    const g=map.get(v.groupSlug);
    g.count++;
    if(v.variant && g.durations.length<100 && !g.durations.includes(v.variant))g.durations.push(v.variant);
    // Never advertise an enquiry-only price as the cheapest BUYABLE offer.
    // Keep the lowest listed price separately for transparency and filtering.
    if(Number.isFinite(v.finalPrice) && v.finalPrice > 0){
      g.listedMinPrice=Math.min(g.listedMinPrice,v.finalPrice);
      if(!v.unavailable)g.orderableMinPrice=Math.min(g.orderableMinPrice,v.finalPrice);
    }
    if(!v.unavailable)g.availableCount++;
    g.featured ||= !!v.featured;
    g.hasDiscount ||= v.discountPercent>0;
    g.needsConfirmation ||= v.needsConfirmation;
  }
  const groups=[...map.values()].map(g=>({
    ...g,
    minPrice:Number.isFinite(g.orderableMinPrice)?g.orderableMinPrice:g.listedMinPrice,
    orderableMinPrice:Number.isFinite(g.orderableMinPrice)?g.orderableMinPrice:null,
    listedMinPrice:Number.isFinite(g.listedMinPrice)?g.listedMinPrice:null,
  })).filter(g=>Number.isFinite(g.minPrice))
    .sort((a,b)=>Number(b.featured)-Number(a.featured)||a.brand.localeCompare(b.brand));
  return {groups:groups.slice((page-1)*limit,page*limit),total:groups.length,page,limit};
}
// Most collections map directly to the stored group_slug, so ask Supabase
// for that brand's rows (usually a handful) instead of downloading hundreds.
// API provider identities are calculated from plan names, so those must still
// use the full public list to avoid dropping plans grouped under other brands.
// These brands have variants classified into their own source group AND an
// older generic "API tools" source group. Never show only one subset while the
// group summary counts all of them. This list is audited against all four
// supplier source files, not inferred from prices or reviews.
export const mixedSourceGroupSlugs = new Set(['akool','minimax','openart','seedance','suno']);
export async function groupPublicVariants(slug) {
  const name=String(slug || '').trim();
  if (!name || name.length>90) return [];
  if (!name.endsWith('-api') && name !== 'other-api') {
    const groupFilter=mixedSourceGroupSlugs.has(name)
      ? `in.(${encodeURIComponent(name)},api-tools)`
      : `eq.${encodeURIComponent(name)}`;
    const direct=await supabaseRequest(`ai_tools_catalog?${publicQuery()}&group_slug=${groupFilter}&limit=1000`);
    if (!Array.isArray(direct)) throw new StoreError('Invalid catalog response');
    const visibleRows=direct.filter(eligibleForPublicListing).map(visible).filter(p=>p.groupSlug===name);
    if (visibleRows.length && direct.length < 1000) return visibleRows;
  }
  return (await allPublicVariants()).filter(p=>p.groupSlug===name);
}
export async function adminCatalog({search='',searchField='all',status='',category='all',page=1,limit=30,offset=null}={}) {
  const safePage=Math.max(1,Math.floor(Number(page)||1));
  const safeLimit=Math.max(1,Math.min(100,Math.floor(Number(limit)||30)));
  const safeOffset=offset===null? (safePage-1)*safeLimit : Math.max(0,Math.floor(Number(offset)||0));
  // Admin-only fields: no supplier IDs, USD costs or sourcing instructions.
  const fields='slug,group_slug,brand,name,description,category,variant,product_type,price_pkr,manual_price_pkr,discount_percent,featured,unavailable,status,review_flags';
  const filters=[`select=${fields}&order=updated_at.desc,slug.asc&offset=${safeOffset}&limit=${safeLimit}`];
  if(status==='deleted')filters.push('status=like.deleted-*');
  else if(status&&['pending','published','hidden','rejected'].includes(status))filters.push(`status=eq.${status}`);
  else filters.push('status=not.like.deleted-*'); // Keep Trash out of All products.
  if(category!=='all' && allCategories.some(c=>c.slug===category)) filters.push(`category=eq.${encodeURIComponent(category)}`);
  const safe=String(search).trim().replace(/[^a-zA-Z0-9 _.-]/g,'').slice(0,80);
  if(safe) {
    const term=encodeURIComponent(`*${safe}*`);
    const allowed=['name','brand','variant','slug'];
    const fields=allowed.includes(searchField)?[searchField]:allowed;
    if(fields.length===1)filters.push(`${fields[0]}=ilike.${term}`);
    else filters.push(`or=(${fields.map(field=>`${field}.ilike.${term}`).join(',')})`);
  }
  const fetched=await supabaseRequest(`ai_tools_catalog?${filters.join('&')}`,{count:true});
  if(!Array.isArray(fetched?.data))throw new StoreError('Could not load imported catalogue.');
  const settings=await supabaseRequest('ai_tools_catalog_settings?select=usd_to_pkr&id=eq.1');
  const total=Number.isSafeInteger(fetched.count) ? fetched.count : null;
  return {rows:fetched.data,total,hasMore:total===null?fetched.data.length===safeLimit:safeOffset+fetched.data.length<total,
    exchangeRate:settings[0]?.usd_to_pkr||300,page:safePage,offset:safeOffset,limit:safeLimit};
}
export async function patchCatalog(slug,updates) {
  const rows=await supabaseRequest(`ai_tools_catalog?slug=eq.${encodeURIComponent(slug)}&select=slug`,{method:'PATCH',body:updates});
  invalidatePublicCatalogCache();
  return rows;
}
