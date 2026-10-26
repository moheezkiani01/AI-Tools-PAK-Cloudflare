// LOCAL read-only load test. NEVER points at a public website or makes orders.
// Example: node scripts/local-load-test.mjs --users=10 --requests=500 --url=http://127.0.0.1:5000/api/catalog/browse?page=1\&limit=20 --profile=true
const values = Object.fromEntries(process.argv.slice(2).map(arg => {
  const match = /^--([a-z-]+)=(.+)$/.exec(arg);
  if (!match) throw Error(`Unknown argument: ${arg}`);
  return [match[1],match[2]];
}));
const users = Number(values.users ?? 100);
const requests = Number(values.requests ?? 500);
const profile = values.profile === 'true';
const validate = values.validate === 'true';
const warmup = Number(values.warmup ?? 0);
const endpoint = new URL(values.url || 'http://127.0.0.1:5000/api/stats');
if (!['localhost','127.0.0.1','::1','[::1]'].includes(endpoint.hostname))
  throw Error('Safety stop: load testing is restricted to localhost, not live websites.');
if (endpoint.protocol !== 'http:' || !['/api/stats','/api/ratings','/api/catalog/groups','/api/catalog/browse','/api/stock'].includes(endpoint.pathname))
  throw Error('Safety stop: only read-only public test endpoints are allowed.');
if (!Number.isSafeInteger(users) || users < 1 || users > 1000 || !Number.isSafeInteger(requests) || requests < 1 || requests > 20000 || !Number.isSafeInteger(warmup) || warmup < 0 || warmup > 100)
  throw Error('Use --users=1..1000, --requests=1..20000, --warmup=0..100.');
if (values.profile !== undefined && !['true','false'].includes(values.profile))
  throw Error('Use --profile=true or --profile=false.');
if (values.validate !== undefined && !['true','false'].includes(values.validate))
  throw Error('Use --validate=true or --validate=false.');

const headers=profile && endpoint.pathname === '/api/catalog/browse' ? {'x-local-catalog-profile':'1'} : undefined;
const validateBody = (body) => {
  if (endpoint.pathname !== '/api/catalog/browse') return;
  const data=JSON.parse(new TextDecoder().decode(body));
  if (!data || !Array.isArray(data.items) || !Number.isSafeInteger(data.total) || data.total < 0 ||
      !Number.isSafeInteger(data.page) || !Number.isSafeInteger(data.limit) || data.items.length > data.limit ||
      data.items.some(item => !item || typeof item.name !== 'string' || typeof item.slug !== 'string' ||
        !Number.isFinite(Number(item.price)) || Number(item.price) < 0)) {
    throw Error('Invalid catalogue response data');
  }
};
for (let i=0; i<warmup; i++){
  const r=await fetch(endpoint,{headers,signal:AbortSignal.timeout(12000)});
  const bytes=await r.arrayBuffer();
  if (!r.ok) throw Error(`Warmup failed: HTTP ${r.status}`);
  if (validate) validateBody(bytes);
}

let next=0;
let successes=0;
let failures=0;
const durations=[];
const errors={};
const samples=[];
const start=performance.now();
async function worker() {
  while(next<requests) {
    const id=++next;
    const t=performance.now();
    try {
      const response=await fetch(endpoint,{headers,signal:AbortSignal.timeout(12000)});
      const bytes=await response.arrayBuffer();
      const duration=performance.now()-t;
      durations.push(duration);
      if (response.ok) {
        if(validate)validateBody(bytes);
        successes++;
      } else {
        failures++;
        errors[String(response.status)]=(errors[String(response.status)]||0)+1;
      }
      if(profile) samples.push({request:id,latencyMs:Math.round(duration),status:response.status,bytes:bytes.byteLength,
        serverTiming:response.headers.get('server-timing') || 'unavailable'});
    } catch(e) {
      failures++;
      errors[e.message==='Invalid catalogue response data'?'invalid-data':e.name||'network']=(errors[e.message==='Invalid catalogue response data'?'invalid-data':e.name||'network']||0)+1;
    }
  }
}
await Promise.all(Array.from({length:Math.min(users,requests)},worker));
durations.sort((a,b)=>a-b);
const elapsed=(performance.now()-start)/1000;
const percentile=p=>durations[Math.max(0,Math.ceil(durations.length*p)-1)]||0;
const result={target:endpoint.toString(),users,requests,ok:successes,failed:failures,
  seconds:Number(elapsed.toFixed(2)),requestsPerSecond:Number((requests/elapsed).toFixed(1)),
  latencyMs:{p50:Math.round(percentile(.5)),p95:Math.round(percentile(.95)),p99:Math.round(percentile(.99))},errors};
if(profile)result.diagnostics={maxLatencyMs:Math.round(durations.at(-1)||0),worstRequests:samples.sort((a,b)=>b.latencyMs-a.latencyMs).slice(0,10),
  note:'Server-Timing is available only with the matching local backend patch; browser/CDN behavior is not measured.'};
console.log(JSON.stringify(result,null,2));
if(failures)process.exitCode=1;
