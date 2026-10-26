import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import http from 'node:http';

const source = readFileSync(new URL('../src/components/AdminCatalogWorkspace.jsx',import.meta.url),'utf8');
const page = readFileSync(new URL('../src/components/AdminPage.jsx',import.meta.url),'utf8');

test('every catalogue tab uses unified original and imported products instead of legacy-only editors',()=>{
 for(const view of ['catalog','products','prices','discounts'])assert.ok(page.includes(`"${view}"`));
 assert.match(page, /AdminCatalogWorkspace/);
 assert.match(source, /allProducts\.filter\(p => !p\.imported\)/);
 assert.match(source, /\/api\/admin\/catalog\?/);
 for(const action of ['/api/admin/stock','AdminPrices','AdminDiscounts','manual_price_pkr','discount_percent','featured','unavailable','status'])
  assert.ok(source.includes(action.replaceAll('\\','')),`missing ${action}`);
});
test('unified admin supports searching, pricing, availability, paging and preserved editors',()=>{
 for(const word of ['Search','Previous','Next','BrandIcon','AdminPrices','AdminDiscounts','status','category','source','onEdit','25%'])
  assert.ok(source.includes(word),word);
 assert.match(source,/setPage\(1\)/);
 assert.match(source,/window\.dispatchEvent\(new Event\("catalog-updated"\)\)/);
});

const originalFetch=globalThis.fetch;
const password='admin_safe_local_test_password';
process.env.NODE_ENV='test';process.env.VERCEL='1';process.env.ADMIN_PASSWORD=password;
process.env.SUPABASE_URL='https://admin-suite.supabase.co';process.env.SUPABASE_SECRET_KEY='sb_secret_test';
const rows=[
 {slug:'import-chatgpt-paid-one',name:'ChatGPT Standard',brand:'ChatGPT',status:'pending',review_flags:[],featured:true,unavailable:false,category:'ai-tools',price_pkr:3750,manual_price_pkr:null,discount_percent:0},
 {slug:'import-claude-risk-two',name:'Claude account shared OTP',brand:'Claude',status:'pending',review_flags:['credentials'],featured:false,unavailable:true,category:'ai-tools',price_pkr:2400,manual_price_pkr:null,discount_percent:0},
 {slug:'import-canva-hidden-three',name:'Canva plan',brand:'Canva',status:'hidden',review_flags:[],featured:false,unavailable:false,category:'creative-tools',price_pkr:900,manual_price_pkr:null,discount_percent:10},
];
const send=(payload,status=200,extra={})=>new Response(JSON.stringify(payload),{status,headers:{'content-type':'application/json',...extra}});
globalThis.fetch=async(url,opts={})=>{
 if(!String(url).startsWith('https://admin-suite.supabase.co/'))return originalFetch(url,opts);
 const parsed=new URL(url),q=parsed.searchParams,pathname=parsed.pathname;
 if(pathname.endsWith('/rpc/ai_tools_admin_attempt'))return send(0);
 if(pathname.endsWith('/ai_tools_catalog_settings'))return send([{usd_to_pkr:300}]);
 if(pathname.endsWith('/ai_tools_catalog') && (opts.method||'GET')==='GET') {
  let matches=rows;
  if(q.get('status')?.startsWith('eq.'))matches=matches.filter(r=>r.status===q.get('status').slice(3));
  if(q.get('category')?.startsWith('eq.'))matches=matches.filter(r=>r.category===q.get('category').slice(3));
  if(q.get('or')) {
   const m=q.get('or').match(/name\.ilike\.\*([^*]+)\*/);
   if(m) matches=matches.filter(r=>`${r.name} ${r.brand}`.toLowerCase().includes(m[1].toLowerCase()));
  }
  if(q.get('slug')?.startsWith('eq.'))matches=matches.filter(r=>r.slug===q.get('slug').slice(3));
  const offset=Number(q.get('offset')||0), limit=Number(q.get('limit')||500);
  const pageRows=matches.slice(offset,offset+limit);
  return send(pageRows,200,{'content-range':pageRows.length?`${offset}-${offset+pageRows.length-1}/${matches.length}`:`*/${matches.length}`});
 }
 if(pathname.endsWith('/ai_tools_catalog') && opts.method==='PATCH') {
  const r=rows.find(p=>p.slug===q.get('slug')?.slice(3));
  if(!r)return send([],200);
  Object.assign(r,JSON.parse(opts.body));return send([{slug:r.slug,status:r.status}]);
 }
 return send({error:'unexpected mock route'},404);
};
const {default:app}=await import('../server/index.js');
const server=http.createServer(app);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const root=`http://127.0.0.1:${server.address().port}`;
const request=async(path,pw=password,method='GET',data)=>{
 const r=await originalFetch(root+path,{method,headers:{'content-type':'application/json','x-admin-password':pw},...(data?{body:JSON.stringify(data)}:{})});
 return {status:r.status,body:await r.json()};
};

test('all admin catalogue screens are protected',async()=>{
 for(const url of ['/api/admin/catalog','/api/admin/catalog/summary'])assert.equal((await request(url,'wrong')).status,401);
});
test('admin overview includes flagged, unpublished and hidden import counts',async()=>{
 const r=await request('/api/admin/catalog/summary');
 assert.equal(r.status,200,JSON.stringify(r));
 assert.deepEqual(r.body,{total:3,featured:1,unavailable:1,flagged:1,visible:1});
});
test('admin search supports brand filter and does not expose supplier fields',async()=>{
 const r=await request('/api/admin/catalog?search=Claude&category=ai-tools&page=1&limit=60');
 assert.equal(r.status,200,JSON.stringify(r));
 assert.equal(r.body.rows.length,1);
 assert.equal(r.body.total,1);
 assert.equal(r.body.hasMore,false);
 assert.equal(r.body.rows[0].brand,'Claude');
 assert.ok(!('cost_cents' in r.body.rows[0]));
});

test('paginated imported catalogue returns correct total and stable offsets',async()=>{
 const first=await request('/api/admin/catalog?offset=0&limit=2');
 assert.equal(first.status,200); assert.equal(first.body.total,3);
 assert.equal(first.body.rows.length,2); assert.equal(first.body.hasMore,true);
 const second=await request('/api/admin/catalog?offset=2&limit=2');
 assert.equal(second.status,200); assert.equal(second.body.total,3);
 assert.equal(second.body.rows.length,1); assert.equal(second.body.hasMore,false);
 const last=await request('/api/admin/catalog?offset=60&limit=2');
 assert.equal(last.status,200); assert.equal(last.body.total,3);
 assert.equal(last.body.rows.length,0); assert.equal(last.body.hasMore,false);
});

test('imported plan discount/price/featured changes work through protected backend',async()=>{
 const r=await request('/api/admin/catalog/import-chatgpt-paid-one',password,'PATCH',{manual_price_pkr:4500,discount_percent:25,featured:false});
 assert.equal(r.status,200,JSON.stringify(r));
 const after=await request('/api/admin/catalog?search=ChatGPT');
 assert.equal(after.body.rows[0].manual_price_pkr,4500);
 assert.equal(after.body.rows[0].discount_percent,25);
 assert.equal(after.body.rows[0].featured,false);
});
after(async()=>{globalThis.fetch=originalFetch;await new Promise(resolve=>server.close(resolve));});
