import { applyProductDetails } from '../src/utils/productDetails.js';
import { priceInfo } from '../src/utils/discounts.js';
import { makeCatalogVariants, sortVariants } from '../src/utils/catalogVariants.js';
import { deletedOriginalSlugs } from './productDeletion.js';
import { allCategories } from '../src/data/categories.js';

const durationMonths = (value) => {
  const text=String(value||'').toLowerCase();
  let match=text.match(/(\d+)\s*(?:months?|mos?\b)/);
  if(match)return +match[1];
  match=text.match(/(\d+)\s*(?:years?|yrs?\b)/);
  if(match)return +match[1]*12;
  match=text.match(/(\d+)\s*(?:days?|d\b)/);
  return match? +match[1]/30 : null;
};
const priceRanges = { under1000:[0,999], mid:[1000,2500], high:[2501,10000], premium:[10001,Infinity] };
const durationMatches = (key, months) => key==='all' ||
  (months !== null && ((key==='short'&&months<=2)||(key==='medium'&&months>=3&&months<=6)||(key==='long'&&months>=12)));

// Server-side filter + pagination: clients receive only displayed public records.
// Private Supabase columns, costs, supplier IDs and checkout secrets never appear.
export function buildBrowsePage(originals, imports, db={}, input={}) {
  const page=Math.max(1,Math.min(2000,parseInt(input.page,10)||1));
  const limit=Math.max(1,Math.min(60,parseInt(input.limit,10)||20));
  const search=String(input.search||'').toLowerCase().trim().slice(0,100);
  const price=Object.hasOwn(priceRanges,input.price)?input.price:'all';
  const duration=['all','short','medium','long'].includes(input.duration)?input.duration:'all';
  const featured=input.featured==='popular'?'popular':'all';
  const sort=['featured','low','high','name-asc','name-desc'].includes(input.sort)?input.sort:'featured';
  const allowedCategories = new Set(['all', ...allCategories.map(c=>c.slug)]);
  const category = allowedCategories.has(input.category) ? input.category : 'all';
  const provider = category === 'api-tools' && /^[a-z0-9-]{1,80}$/.test(String(input.provider||'')) ? String(input.provider) : 'all';
  const deleted=new Set(deletedOriginalSlugs(db));
  const out=new Set(Array.isArray(db.outOfStock)?db.outOfStock:[]);
  const details=db.productDetails||{};
  const legacy=originals.filter(p=>!deleted.has(p.slug)).map(p=>{
    const edited=applyProductDetails(p,details[p.slug]);
    return {...edited,unavailable:!!edited.unavailable||out.has(edited.slug)};
  });
  const all=makeCatalogVariants(legacy,imports,(p,o)=>priceInfo(p,db.discounts||{},o,db.priceOverrides||{}));
  const matches=sortVariants(all.filter(p=>{
    if(category==='discounts' ? !p.discounted : category!=='all' && p.category!==category)return false;
    if(provider!=='all' && p.groupSlug!==provider)return false;
    if(search && !`${p.name} ${p.brand} ${p.duration} ${p.description}`.toLowerCase().includes(search))return false;
    if(price!=='all'&&(p.price<priceRanges[price][0]||p.price>priceRanges[price][1]))return false;
    if(featured==='popular'&&!p.featured)return false;
    if(!durationMatches(duration,durationMonths(p.duration)))return false;
    return true;
  }),sort);
  const offset=(page-1)*limit;
  return {items:matches.slice(offset,offset+limit),total:matches.length,page,limit,hasMore:offset+limit<matches.length};
}

// Short-lived bounded memo for repeated public search pages in the SAME warm
// function instance. Identity checks ensure any fresh state/catalogue snapshot
// invalidates old results. Checkout never uses this memo.
let browseSnapshot = { originals: null, imports: null, state: null, pages: new Map() };
export function buildCachedBrowsePage(originals, imports, state, query = {}) {
  if (browseSnapshot.originals !== originals || browseSnapshot.imports !== imports || browseSnapshot.state !== state) {
    browseSnapshot = { originals, imports, state, pages: new Map() };
  }
  const key = JSON.stringify([
    query.page || 1, query.limit || 20, query.search || '', query.price || '',
    query.duration || '', query.featured || '', query.sort || '',
    query.category || 'all', query.provider || 'all',
  ]);
  const item = browseSnapshot.pages.get(key);
  if (item && item.expires > Date.now()) return item.value;
  const value = buildBrowsePage(originals, imports, state, query);
  if (browseSnapshot.pages.size >= 100) browseSnapshot.pages.delete(browseSnapshot.pages.keys().next().value);
  browseSnapshot.pages.set(key, { value, expires: Date.now() + 2_000 });
  return value;
}
