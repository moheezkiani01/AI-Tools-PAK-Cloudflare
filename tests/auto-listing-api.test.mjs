import test from 'node:test';
import assert from 'node:assert/strict';
import { allPublicVariants, findPublicVariant, listPublicGroups } from '../server/catalog.js';
const fakeRows = [
  { slug:'import-chatgpt-abc123',group_slug:'chatgpt',brand:'ChatGPT',name:'ChatGPT Plus 1 Month',description:'One month',category:'ai-tools',variant:'1 month',product_type:'subscription',price_pkr:3450,manual_price_pkr:null,discount_percent:0,featured:true,unavailable:false,status:'pending',review_flags:[] },
  { slug:'import-chatgpt-xyz567',group_slug:'chatgpt',brand:'ChatGPT',name:'ChatGPT 3 Months',description:'Three months',category:'ai-tools',variant:'3 months',product_type:'subscription',price_pkr:5000,manual_price_pkr:null,discount_percent:0,featured:false,unavailable:true,status:'pending',review_flags:[] },
  { slug:'import-secret-123456',group_slug:'chatgpt',brand:'ChatGPT',name:'Password 2FA account',description:'Sensitive',category:'ai-tools',variant:'1 month',product_type:'account',price_pkr:1000,manual_price_pkr:null,discount_percent:0,featured:false,unavailable:false,status:'pending',review_flags:['password'] },
  { slug:'import-old-123456',group_slug:'old',brand:'Old',name:'Hidden',description:'Hidden',category:'ai-tools',variant:'1 month',product_type:'account',price_pkr:999,manual_price_pkr:null,discount_percent:0,featured:false,unavailable:false,status:'hidden',review_flags:[] },
];

test('Supabase public routes include all pending plans but block flagged checkouts and hide private fields',async()=>{
  const old = global.fetch;
  const oldUrl=process.env.SUPABASE_URL;const oldKey=process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_URL='https://unit-test.supabase.co';process.env.SUPABASE_SECRET_KEY='sb_secret_test_only';
  global.fetch=async url=>{
    const request=new URL(url);
    const slug=request.searchParams.get('slug');
    const records=fakeRows.filter(p=>p.status!=='hidden'&&(!slug||p.slug===slug.slice(3)));
    return new Response(JSON.stringify(records),{status:200,headers:{'Content-Type':'application/json'}});
  };
  try{
    const list=await allPublicVariants();
    assert.equal(list.length,3);
    assert.ok(list.every(p=>p.needsConfirmation));
    assert.ok(list.every(p=>!('review_flags' in p)&&!('cost_cents' in p)&&!('source_ids' in p)));
    const groups=await listPublicGroups({limit:20});
    assert.equal(groups.total,1);
    assert.equal(groups.groups[0].count,3);
    assert.equal(groups.groups[0].availableCount,1);
    assert.equal(groups.groups[0].minPrice,3450);
    assert.equal(groups.groups[0].listedMinPrice,1000);
    assert.equal(groups.groups[0].orderableMinPrice,3450);
    const risky=await findPublicVariant('import-secret-123456');
    assert.equal(risky.restricted,true);
    assert.equal(risky.unavailable,true);
    assert.equal('review_flags' in risky,false);
    assert.equal((await findPublicVariant('import-chatgpt-abc123')).pricePkr,3450);
  }finally{
    global.fetch=old;
    if(oldUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=oldUrl;
    if(oldKey===undefined)delete process.env.SUPABASE_SECRET_KEY;else process.env.SUPABASE_SECRET_KEY=oldKey;
  }
});
