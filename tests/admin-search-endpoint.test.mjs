import test, { after } from 'node:test';
import assert from 'node:assert/strict';
const savedFetch = globalThis.fetch;
process.env.SUPABASE_URL = 'https://admin-usability.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'sb_secret_admin_usability_test';
const catalog = [
  { slug:'import-gemini-pro', name:'Gemini Pro', brand:'Gemini', variant:'1 month', status:'pending', category:'ai-tools' },
  { slug:'import-claude-pro', name:'Claude Pro', brand:'Claude', variant:'1 month', status:'published', category:'ai-tools' },
  { slug:'import-gemini-deleted', name:'Gemini Legacy', brand:'Gemini', variant:'6 months', status:'deleted-published', category:'ai-tools' },
];
let lastCatalogQuery;
globalThis.fetch = async (url) => {
  const parsed = new URL(url);
  if (parsed.pathname.endsWith('/ai_tools_catalog_settings')) return new Response(JSON.stringify([{usd_to_pkr:300}]), {status:200});
  if (!parsed.pathname.endsWith('/ai_tools_catalog')) throw Error(`Unexpected path ${url}`);
  lastCatalogQuery=parsed.searchParams;
  let rows = [...catalog];
  const status=parsed.searchParams.get('status');
  if (status==='not.like.deleted-*') rows=rows.filter(row=>!row.status.startsWith('deleted-'));
  else if (status==='like.deleted-*') rows=rows.filter(row=>row.status.startsWith('deleted-'));
  else if (status?.startsWith('eq.')) rows=rows.filter(row=>row.status===status.slice(3));
  const direct = ['name','brand','variant','slug'].find(field=>parsed.searchParams.get(field)?.startsWith('ilike.'));
  if (direct) {
    const term=parsed.searchParams.get(direct).slice(6).replaceAll('*','').toLowerCase();
    rows=rows.filter(row=>String(row[direct]).toLowerCase().includes(term));
  }
  const aggregate=parsed.searchParams.get('or');
  if (aggregate) {
    const term=aggregate.match(/ilike\.\*([^*]+)\*/)?.[1]?.toLowerCase();
    if(term) rows=rows.filter(row=>Object.values(row).some(v=>String(v).toLowerCase().includes(term)));
  }
  const total=rows.length;
  const offset=Number(parsed.searchParams.get('offset')||0), limit=Number(parsed.searchParams.get('limit')||30);
  rows=rows.slice(offset,offset+limit);
  return new Response(JSON.stringify(rows),{status:200,headers:{'content-range':rows.length?`${offset}-${offset+rows.length-1}/${total}`:`*/${total}`}});
};
const {adminCatalog}=await import('../server/catalog.js');
after(()=>{globalThis.fetch=savedFetch;});

test('admin All products excludes soft deleted items; Trash contains them', async()=>{
  const active=await adminCatalog({});
  assert.equal(active.total,2);
  assert.equal(lastCatalogQuery.get('status'),'not.like.deleted-*');
  const trashed=await adminCatalog({status:'deleted'});
  assert.equal(trashed.total,1);
  assert.equal(trashed.rows[0].slug,'import-gemini-deleted');
});

test('admin search dropdown searches the selected field and obeys totals',async()=>{
  const brand=await adminCatalog({search:'Gemini',searchField:'brand'});
  assert.equal(lastCatalogQuery.get('brand'),'ilike.*Gemini*');
  assert.equal(brand.total,1);
  const slug=await adminCatalog({search:'claude-pro',searchField:'slug'});
  assert.equal(lastCatalogQuery.get('slug'),'ilike.*claude-pro*');
  assert.equal(slug.rows[0].brand,'Claude');
  const all=await adminCatalog({search:'Gemini',searchField:'all'});
  assert.match(lastCatalogQuery.get('or'),/slug\.ilike/);
  assert.equal(all.total,1);
});
