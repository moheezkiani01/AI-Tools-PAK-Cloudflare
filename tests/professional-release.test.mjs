import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyAdminPassword, startAdminSession, readAdminSession, clearAdminSession, hasValidAdminCsrf } from '../server/adminAuth.js';
import { buildBrowsePage } from '../server/browse.js';
import { publicSeoProduct, approvedSeoProducts } from '../scripts/public-catalog-seo.mjs';
import { listPublicGroups, invalidatePublicCatalogCache, requiresResaleVerification } from '../server/catalog.js';

const req=(cookie='',method='GET')=>({headers:{cookie},method,secure:false,get(n){return this.headers[n.toLowerCase()]||''}});
const res=()=>({headers:{},set(k,v){this.headers[k]=v}});
const password='Professional-password!123456789';
test('password validation is constant-time compatible and exact',()=>{
  assert.equal(verifyAdminPassword(password,password),true);
  assert.equal(verifyAdminPassword(password+'x',password),false);
  assert.equal(verifyAdminPassword('',password),false);
});
test('secure admin cookie stores no raw password, validates signature and csrf',()=>{
  const request=req();const response=res();
  const session=startAdminSession(request,response,password);
  const cookie=response.headers['Set-Cookie'];
  assert.match(cookie,/HttpOnly; SameSite=Strict/);
  assert.ok(!cookie.includes(password));
  const authenticated=req(cookie.split(';')[0]);
  const loaded=readAdminSession(authenticated,password);
  assert.deepEqual(loaded,session && {csrfToken:session.csrfToken});
  const post={...authenticated,method:'POST',get(n){return n==='x-admin-csrf'?session.csrfToken:''}};
  assert.equal(hasValidAdminCsrf(post,loaded),true);
  assert.equal(hasValidAdminCsrf({...post,get:()=>''},loaded),false);
  assert.equal(readAdminSession(req(cookie.split(';')[0].replace(/.$/,'x')),password),null);
  assert.equal(readAdminSession(authenticated,'changed-password'),null);
  const logout=res();clearAdminSession(request,logout);
  assert.match(logout.headers['Set-Cookie'],/Max-Age=0/);
});
test('cookie has Secure flag when behind an HTTPS proxy',()=>{
  const request=req();request.headers['x-forwarded-proto']='https';
  const response=res();startAdminSession(request,response,password);
  assert.match(response.headers['Set-Cookie'],/; Secure;/);
});
const originals=[
  {slug:'app-one',brand:'Canva',name:'Canva premium',description:'Design',category:'creative-tools',price:1500,duration:'1 Month'},
  {slug:'app-two',brand:'Notion',name:'Notion starter',description:'Notes',category:'productivity',price:550,duration:'1 Month',popular:true},
];
const imports=[
  {slug:'import-aaa-1234567',brand:'Claude',name:'Claude pro',description:'Assistant',category:'ai-tools',price:800,finalPrice:800,variant:'1 Month',groupSlug:'claude',featured:true,unavailable:false},
  {slug:'import-bbb-1234567',brand:'Claude',name:'Claude premium',description:'Assistant',category:'ai-tools',price:1900,finalPrice:1900,variant:'3 Months',groupSlug:'claude',featured:false,unavailable:true,restricted:true},
];
test('pagination merges original and imported plans without duplicates',()=>{
  const db={deletedProducts:[],priceOverrides:{'app-one':{price:1700}},discounts:{'app-one':{type:'percent',value:10}}};
  const page1=buildBrowsePage(originals,imports,db,{page:1,limit:2,sort:'low'});
  const page2=buildBrowsePage(originals,imports,db,{page:2,limit:2,sort:'low'});
  assert.equal(page1.total,4);
  assert.equal(page2.total,4);
  assert.equal(new Set([...page1.items,...page2.items].map(i=>i.id)).size,4);
  const canva=[...page1.items,...page2.items].find(p=>p.slug==='app-one');
  assert.equal(canva.price,1530);
});
test('browse search, duration and stock filters reflect edited state',()=>{
  const db={deletedProducts:['app-two'],outOfStock:['app-one'],productDetails:{'app-one':{name:'Canva redesigned'}}};
  const listing=buildBrowsePage(originals,imports,db,{search:'claude',duration:'medium',limit:20});
  assert.equal(listing.total,1);
  assert.equal(listing.items[0].slug,'import-bbb-1234567');
  assert.equal(listing.items[0].restricted,true);
  const all=buildBrowsePage(originals,imports,db,{limit:20});
  assert.equal(all.total,3);
  assert.ok(!all.items.some(x=>x.slug==='app-two'));
  assert.ok(all.items.find(x=>x.slug==='app-one').unavailable);
});
test('SEO pages exclude unapproved and unavailable imported plans',async()=>{
  const entries=[
    {slug:'import-safe-123456789',name:'Safe plan',status:'published',unavailable:false,review_flags:[]},
    {slug:'import-pend-123456789',name:'Pending',status:'pending',unavailable:false,review_flags:[]},
    {slug:'import-flag-123456789',name:'Flagged',status:'published',unavailable:false,review_flags:['credentials']},
    {slug:'import-out-123456789',name:'No stock',status:'published',unavailable:true,review_flags:[]}
  ];
  assert.deepEqual(entries.filter(publicSeoProduct).map(p=>p.name),['Safe plan']);
  let called='';
  const included=await approvedSeoProducts({env:{SUPABASE_URL:'https://project.supabase.co',SUPABASE_SECRET_KEY:'secret'},request:async(url,options)=>{
    called=url;
    assert.ok(options.headers.apikey==='secret');
    return {ok:true,json:async()=>entries};
  }});
  assert.equal(included.length,1);
  assert.ok(!called.includes('cost_usd'));
});

test('publishing a flagged plan cannot bypass review restrictions',()=>{
  assert.equal(requiresResaleVerification({status:'published',review_flags:['restricted-access']}),true);
  assert.equal(requiresResaleVerification({status:'published',review_flags:[]}),false);
  assert.equal(requiresResaleVerification({status:'pending',review_flags:[]}),false);
});
