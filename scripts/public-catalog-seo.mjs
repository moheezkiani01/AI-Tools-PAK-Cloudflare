// Build-time SEO reads only approved, in-stock, unflagged imported listings.
// Supplier identifiers, cost prices and review notes are NEVER embedded in HTML.
const SAFE_SLUG = /^import-[a-z0-9-]{5,140}$/;
export const publicSeoProduct = (row) => row?.status === 'published' && row.unavailable === false &&
  SAFE_SLUG.test(String(row.slug || '')) &&
  (!Array.isArray(row.review_flags) || row.review_flags.length === 0) &&
  Boolean(String(row.name || '').trim());

export async function approvedSeoProducts({env=process.env, request=fetch}={}) {
  const url=env.SUPABASE_URL;
  const key=env.SUPABASE_SECRET_KEY;
  if(!url || !key) return [];
  const rows=[];
  const select='slug,name,description,category,status,unavailable,review_flags';
  for(let offset=0;offset<20000;offset+=500){
    let response;
    try {
      response=await request(`${String(url).replace(/\/$/,'')}/rest/v1/ai_tools_catalog?select=${select}&status=eq.published&unavailable=eq.false&order=slug&offset=${offset}&limit=500`,{
        headers:{apikey:key,Accept:'application/json'},signal:AbortSignal.timeout(7000)
      });
      if(!response.ok) throw Error(`HTTP ${response.status}`);
      const part=await response.json();
      if(!Array.isArray(part)) throw Error('Non-array response');
      rows.push(...part);
      if(part.length<500) break;
    }catch(error){
      // Safer to omit dynamic product URLs than to publish incomplete or stale SEO content.
      console.warn(`Skipped dynamic SEO pages (catalogue unavailable: ${error.message}).`);
      return [];
    }
  }
  return rows.filter(publicSeoProduct).map(p=>({slug:p.slug,name:String(p.name).slice(0,160),description:String(p.description||'').slice(0,280),category:p.category}));
}
