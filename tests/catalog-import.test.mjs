import test from 'node:test';
import assert from 'node:assert/strict';
import {costCents, pricePkr, prepareCatalog,cleanDescription} from '../scripts/catalog-utils.mjs';
const example=(id,name,usd,description='',type='account')=>({productId:id,name,description,productType:type,price:{amount:usd,currency:'USD'},availability:{available:10},emoji:'chatgpt'});
test('USD costs have a single 25% markup at 300 PKR',()=>{
 for(const [usd,pkr] of [[1,375],[5,1875],[10,3750],[20,7500],[50,18750],[100,37500],[3.77,1414]])assert.equal(pricePkr(costCents(usd)),pkr);
});
test('bad price strings and fractions are rejected',()=>{assert.throws(()=>costCents('1.234'));assert.throws(()=>costCents('1e3'));assert.throws(()=>costCents(-1))});
test('csv/json duplicates imported only once; higher cost wins',()=>{
 const a=example('a'.repeat(24),'🔥 ChatGPT Plus 1 Month',5,'Full 1-month plan');
 const b=example('a'.repeat(24),'CHATGPT PLUS 1 MONTH',10,'Full 1-month plan');
 const c=example('b'.repeat(24),'chatgpt plus 1 month',7,'Full 1-month plan');
 const r=prepareCatalog([{source:'fat.csv',rows:[a]},{source:'fat.json',rows:[b,c]}]);
 assert.equal(r.stats.sourceRows,3);assert.equal(r.stats.csvJsonDuplicates,1);assert.equal(r.variants.length,1);
 assert.equal(r.variants[0].cost_cents,1000);assert.equal(r.variants[0].price_pkr,3750);
});
test('different plan, duration, type, credit size and warranty are distinct variants',()=>{
 const names=['ChatGPT Pro 1 Month','ChatGPT Pro 3 Months','ChatGPT Plus 1 Month','ChatGPT Pro 1 Month warranty 24h','ChatGPT Pro 1 Month warranty 7 Days','ChatGPT Pro 50M credits','ChatGPT Pro 100M credits'];
 const rows=names.map((x,i)=>example((i+1).toString(16).padStart(24,'0'),x,5));
 assert.equal(prepareCatalog([{source:'fat.json',rows}]).variants.length,rows.length);
});
test('imported records start unpublished and descriptions remove source links & credential requests',()=>{
 const row=example('9'.repeat(24),'ChatGPT upgrade',3,'Send password and 2FA secret to Telegram. https://example.org Please confirm eligibility.');
 const p=prepareCatalog([{source:'fat.json',rows:[row]}]).variants[0];
 assert.equal(p.status,'pending');assert.ok(p.flags.length>0);assert.ok(!p.description.includes('example.org'));
 assert.ok(!/send password/i.test(p.description));
});
test('deterministic reimport preserves same product ID',()=>{
 const row=example('9'.repeat(24),'Claude Pro 1 Month',6);
 const a=prepareCatalog([{source:'hit.json',rows:[row]}]).variants[0];const b=prepareCatalog([{source:'hit.json',rows:[row]}]).variants[0];
 assert.equal(a.slug,b.slug);assert.equal(a.price_pkr,b.price_pkr);
});

test('changing USD/PKR rate uses one markup (no compounding)',()=>{
 assert.equal(pricePkr(costCents('10'),300),3750);
 assert.equal(pricePkr(costCents('10'),320),4000);
 assert.equal(pricePkr(costCents('0.01'),300),4);
});

test('plan symbols are significant: VIP and VIP+ never get merged', () => {
 const base=example('1'.repeat(24),'Meitu VIP 7 Days full warranty','0.96');
 const extra=example('2'.repeat(24),'Meitu VIP+ 7 Days full warranty','0.97');
 const catalog=prepareCatalog([{source:'fat.json',rows:[base,extra]}]);
 assert.equal(catalog.variants.length,2);
 assert.equal(new Set(catalog.variants.map(v=>v.slug)).size,2);
 assert.deepEqual(catalog.variants.map(v=>v.cost_cents).sort((a,b)=>a-b),[96,97]);
});

test('every distinct supplier ID maps to exactly one retained variant', () => {
 const rows=[
   example('3'.repeat(24),'Canva Pro 1 Month',2.0),
   example('4'.repeat(24),'Canva Pro 1 Month',3.0),
   example('5'.repeat(24),'Canva Pro 3 Months',4.0),
 ];
 const {variants,stats}=prepareCatalog([{source:'fat.csv',rows},{source:'fat.json',rows}]);
 assert.equal(stats.sourceRows,6);
 assert.equal(stats.uniqueSourceIds,3);
 assert.equal(variants.length,2);
 assert.deepEqual(variants.flatMap(v=>v.source_ids).sort(),rows.map(v=>v.productId).sort());
 const one=variants.find(v=>v.name.includes('1 Month'));
 assert.equal(one.cost_cents,300);
 assert.equal(one.price_pkr,1125);
});
