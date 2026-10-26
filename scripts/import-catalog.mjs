// Run with four private files. Dry run is the default, --commit writes to Supabase.
import fs from 'node:fs';
import path from 'node:path';
import { readSources, prepareCatalog } from './catalog-utils.mjs';
import { products } from '../src/data/products.js';
const root=path.resolve(import.meta.dirname,'..');
const defaults=['fat.csv','fat.json','hit.csv','hit.json'].map(n=>path.join(root,'private-catalog',n));
const filenames=process.argv.slice(2).filter(a=>!a.startsWith('--'));
const paths=filenames.length===4?filenames:defaults;
if(paths.some(p=>!fs.existsSync(p))) {
 console.error('Missing catalog inputs. Put fat.csv, fat.json, hit.csv, hit.json into private-catalog/ or pass their four exact paths.');process.exit(1);
}
const result=prepareCatalog(readSources(paths),products);
console.log(JSON.stringify(result.stats,null,2));
console.log('All unique, non-hidden variants can be browsed. Flagged plans remain NON-ORDERABLE until resale/access conditions are verified.');
if(!process.argv.includes('--commit')) {console.log('Dry run: database NOT modified. Run with --commit to upload after migration.'); process.exit(0);}
const env=path.join(root,'server','.env');
if(fs.existsSync(env))for(const line of fs.readFileSync(env,'utf8').split(/\r?\n/)){
 const found=line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
 if(found&&!process.env[found[1]])process.env[found[1]]=found[2].replace(/^["']|["']$/g,'');
}
const url=process.env.SUPABASE_URL,secret=process.env.SUPABASE_SECRET_KEY;
if(!/^https:\/\/[a-z\d-]+\.supabase\.co\/?$/i.test(url||'') || !secret){console.error('Add SUPABASE_URL and SUPABASE_SECRET_KEY to your private server/.env before --commit.');process.exit(1);}
const test=await fetch(`${url.replace(/\/$/,'')}/rest/v1/ai_tools_catalog_settings?select=usd_to_pkr&id=eq.1`,{headers:{apikey:secret}});
if(!test.ok){console.error('Supabase catalog table not initialized. Run supabase/catalog_migration.sql first. HTTP',test.status);process.exit(1);}
// Earlier versions merged an explicitly different VIP+ tier into VIP by
// discarding the plus symbol. Stop rather than attach one supplier ID to both.
const previousVipSlug='import-meitu-vip-7-days-full-warranty-ad3dfd80cac5';
const vipCheck=await fetch(`${url.replace(/\/$/,'')}/rest/v1/ai_tools_catalog?select=slug,source_ids&slug=eq.${previousVipSlug}&limit=1`,{headers:{apikey:secret}});
if(!vipCheck.ok){console.error('Could not verify earlier import metadata. HTTP',vipCheck.status);process.exit(1);}
const oldVip=await vipCheck.json();
if(oldVip[0]?.source_ids?.includes('6aacd7575271203cb12cc28c')) {
 console.error('Earlier import accidentally combined VIP and VIP+. Backup your database, run supabase/catalog_duplicate_correction.sql in Supabase SQL Editor, then retry --commit.');
 process.exit(1);
}
let done=0;
for(let i=0;i<result.variants.length;i+=20){
 const payload=result.variants.slice(i,i+20);
 const response=await fetch(`${url.replace(/\/$/,'')}/rest/v1/rpc/ai_tools_import_catalog`,{
  method:'POST',headers:{apikey:secret,'Content-Type':'application/json'},body:JSON.stringify({rows:payload})
 });
 if(!response.ok){console.error('Import stopped at batch',i/20+1,'HTTP',response.status,await response.text());process.exit(1);}
 done+=payload.length;
 console.log(`Saved ${done}/${result.variants.length} private catalog variants`);
}
console.log('Import complete. All non-hidden plans are browseable; flagged pending plans cannot be ordered. Orders and reviews were not changed.');
