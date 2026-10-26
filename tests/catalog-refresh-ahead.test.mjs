import test from 'node:test';
import assert from 'node:assert/strict';
import { createRefreshAheadCache } from '../server/refreshAheadCache.js';

test('cold requests coalesce; pre-expiry requests return instantly while one refresh runs', async () => {
  let clock=0, reads=0, release;
  const cache=createRefreshAheadCache(() => {
    reads++;
    return reads===1 ? 'initial' : new Promise(resolve=>{release=resolve;});
  },{ttlMs:100,refreshAheadMs:30,now:()=>clock});
  const results=await Promise.all(Array.from({length:50},()=>cache.get()));
  assert.equal(reads,1);
  assert.ok(results.every(item=>item==='initial'));
  clock=71;
  assert.equal(await cache.get(),'initial');
  await Promise.resolve();
  assert.equal(reads,2,'at most one background refresh for the same key');
  assert.equal(await cache.get(),'initial');
  clock=101;
  const afterExpiry=cache.get();
  release('updated');
  assert.equal(await afterExpiry,'updated','expired data is never returned');
  assert.equal(await cache.get(),'updated');
  assert.equal(reads,2);
});

test('failed background refresh retains the original only until the TTL expires',async()=>{
  let clock=0,reads=0;
  const cache=createRefreshAheadCache(()=>{
    reads++;
    if(reads===2)throw new Error('Temporary outage');
    return `value-${reads}`;
  },{ttlMs:100,refreshAheadMs:30,now:()=>clock});
  assert.equal(await cache.get(),'value-1');
  clock=80;
  assert.equal(await cache.get(),'value-1');
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(reads,2);
  clock=101;
  assert.equal(await cache.get(),'value-3');
});

test('invalidating while a refresh is running cannot repopulate an old snapshot', async()=>{
  let clock=0,reads=0,releaseOld;
  const cache=createRefreshAheadCache(()=>{
    reads++;
    return reads===1 ? new Promise(resolve=>{releaseOld=resolve;}) : 'new';
  },{ttlMs:100,refreshAheadMs:20,now:()=>clock});
  const old=cache.get();
  await Promise.resolve();
  cache.invalidate();
  assert.equal(await cache.get(),'new');
  releaseOld('old');
  assert.equal(await old,'old','the original caller may finish its in-progress read');
  assert.equal(await cache.get(),'new','the invalidated old read never overwrites the cache');
});

test('misconfigured caching settings fail early',()=>{
  assert.throws(()=>createRefreshAheadCache(()=>1,{ttlMs:0}),RangeError);
  assert.throws(()=>createRefreshAheadCache(()=>1,{ttlMs:10,refreshAheadMs:10}),RangeError);
});
