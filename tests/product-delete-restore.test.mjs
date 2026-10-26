import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deletedStatus, restoredStatus, isDeletedStatus, deletedOriginalSlugs, isDeletedOriginal } from '../server/productDeletion.js';
import { allPublicVariants, adminCatalog, findPublicVariant, invalidatePublicCatalogCache } from '../server/catalog.js';

for (const prior of ['pending','published','hidden','rejected']) {
  test(`soft-deleted imported ${prior} restores its exact earlier state without an extra row`, () => {
    const stored = deletedStatus(prior);
    assert.equal(stored, `deleted-${prior}`);
    assert.equal(restoredStatus(stored), prior);
    assert.equal(isDeletedStatus(stored), true);
  });
}
test('original catalogue deletion uses only a small slug list, not a copied product', () => {
  const db = {orders:[{number:'AIT-123456'}], reviews:[{id:'review-1'}], deletedProducts:['chatgpt-plus']};
  assert.deepEqual(deletedOriginalSlugs(db), ['chatgpt-plus']);
  assert.ok(isDeletedOriginal(db, 'chatgpt-plus'));
  assert.ok(!isDeletedOriginal(db, 'canva-pro-edu'));
  assert.deepEqual(deletedOriginalSlugs({}), []);
  db.deletedProducts = db.deletedProducts.filter(id => id !== 'chatgpt-plus');
  assert.equal(isDeletedOriginal(db, 'chatgpt-plus'), false);
  assert.equal(db.orders.length,1);
  assert.equal(db.reviews.length,1);
});
test('only deleted items use a status prefix, never an extra Supabase deletion table', () => {
  const sql = readFileSync(new URL('../supabase/catalog_delete_restore.sql', import.meta.url), 'utf8');
  assert.match(sql, /DROP CONSTRAINT IF EXISTS ai_tools_catalog_status_check/);
  assert.doesNotMatch(sql, /create\s+table|alter\s+table[^;]*add\s+column/i);
  const routes = readFileSync(new URL('../server/index.js', import.meta.url), 'utf8');
  assert.match(routes, /products\/:slug\/delete/);
  assert.match(routes, /products\/:slug\/restore/);
  assert.match(routes, /requireAdmin/);
  assert.match(routes, /isDeletedOriginal\(db, line\.slug\)/);
});

test('public imported catalogue ignores deleted plans; admin Deleted filter still finds them', async () => {
 const oldFetch=globalThis.fetch, oldUrl=process.env.SUPABASE_URL, oldKey=process.env.SUPABASE_SECRET_KEY;
 process.env.SUPABASE_URL='https://deleted-plan-tests.supabase.co';
 process.env.SUPABASE_SECRET_KEY='sb_secret_test';
 const plans = [
  {slug:'import-meitu-vip',group_slug:'meitu',brand:'Meitu',name:'Meitu VIP',description:'',variant:'1 Month',product_type:'subscription',price_pkr:1500,manual_price_pkr:null,discount_percent:0,featured:false,unavailable:false,category:'creative-tools',status:'published',review_flags:[]},
  {slug:'import-meitu-vip-plus',group_slug:'meitu',brand:'Meitu',name:'Meitu VIP+',description:'',variant:'1 Month',product_type:'subscription',price_pkr:5000,manual_price_pkr:null,discount_percent:0,featured:false,unavailable:false,category:'creative-tools',status:'deleted-published',review_flags:[]},
 ];
 const seen=[];
 globalThis.fetch=async url=>{
   const u=new URL(url); const qs=u.searchParams; seen.push(qs.get('status'));
   let result=[...plans];
   const status=qs.get('status');
   if(status==='in.(published,pending)')result=result.filter(p=>['published','pending'].includes(p.status));
   if(status==='like.deleted-*')result=result.filter(p=>p.status.startsWith('deleted-'));
   if(qs.has('slug'))result=result.filter(p=>p.slug===qs.get('slug').slice(3));
   if(qs.has('group_slug'))result=result.filter(p=>p.group_slug===qs.get('group_slug').slice(3));
   const offset=Number(qs.get('offset')||0); const limit=Number(qs.get('limit')||1000);
   if(u.pathname.endsWith('/ai_tools_catalog_settings'))return new Response(JSON.stringify([{usd_to_pkr:300}]),{status:200});
   return new Response(JSON.stringify(result.slice(offset,offset+limit)),{status:200,headers:{'content-range':`0-${result.length-1}/${result.length}`}});
 };
 try {
  invalidatePublicCatalogCache();
  const publicPlans=await allPublicVariants({summary:true});
  assert.deepEqual(publicPlans.map(p=>p.slug), ['import-meitu-vip']);
  assert.equal(await findPublicVariant('import-meitu-vip-plus'),null);
  const deleted=await adminCatalog({status:'deleted'});
  assert.deepEqual(deleted.rows.map(p=>p.slug), ['import-meitu-vip-plus']);
  assert.ok(seen.includes('like.deleted-*'));
 } finally {
  globalThis.fetch=oldFetch;
  if(oldUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=oldUrl;
  if(oldKey===undefined)delete process.env.SUPABASE_SECRET_KEY;else process.env.SUPABASE_SECRET_KEY=oldKey;
  invalidatePublicCatalogCache();
 }
});

test('admin includes Delete/Restore buttons and public context filters deleted originals', () => {
 const admin=readFileSync(new URL('../src/components/AdminCatalogWorkspace.jsx',import.meta.url),'utf8');
 const ctx=readFileSync(new URL('../src/context/ProductContext.jsx',import.meta.url),'utf8');
 for(const token of ['Deleted items', 'softDelete', 'Restore', 'Delete', 'useAllProducts', 'useDeletedOriginalProducts']) assert.ok(admin.includes(token),token);
 assert.match(ctx, /allProducts\.filter\(p => p\.imported \|\| !deletedOriginalProducts\.includes\(p\.slug\)\)/);
});
