import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const config = JSON.parse(fs.readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
const source = fs.readFileSync(new URL('../cloudflare/worker.js', import.meta.url), 'utf8');
const index = fs.readFileSync(new URL('../server/index.js', import.meta.url), 'utf8');
const datastore = fs.readFileSync(new URL('../server/dataStore.js', import.meta.url), 'utf8');

test('Workers serves API through Express and website as Vite static assets', () => {
  assert.equal(config.main, './cloudflare/worker.js');
  assert.equal(config.assets.directory, './dist');
  assert.equal(config.assets.not_found_handling, 'single-page-application');
  assert.ok(config.assets.run_worker_first.includes('/api/*'));
  assert.match(source, /httpServerHandler/);
  assert.match(source, /app\.listen\(3000\)/);
});

test('Cloudflare flag stops Node local server and file based website handling', () => {
  assert.equal(config.vars.CLOUDFLARE_WORKER, '1');
  assert.match(index, /!process\.env\.CLOUDFLARE_WORKER && fs\.existsSync\(dist\)/);
  assert.match(index, /!process\.env\.CLOUDFLARE_WORKER && process\.env\.NODE_ENV !== "test"/);
});

test('Workers does not fall back to ephemeral JSON storage without Supabase', () => {
  assert.match(datastore, /isHosted\(\) && !hasSupabase\(\)/);
  const result = spawnSync(process.execPath, ['--input-type=module', '-e',
    `import {load,databaseMode} from './server/dataStore.js'; if (databaseMode()!=='not-configured') process.exit(2); try {await load();process.exit(3)} catch(e) { if (!String(e.message).includes('Supabase is not configured')) process.exit(4); }`],
    {cwd: new URL('../',import.meta.url), encoding:'utf8', env:{...process.env,CLOUDFLARE_WORKER:'1',SUPABASE_URL:'',SUPABASE_SECRET_KEY:''}});
  assert.equal(result.status,0,result.stderr);
});

test('Cloudflare private secrets ignored by Git', () => {
  const ignore = fs.readFileSync(new URL('../.gitignore',import.meta.url),'utf8');
  assert.match(ignore, /\.dev\.vars\*/);
  assert.match(fs.readFileSync(new URL('../public/_headers', import.meta.url),'utf8'), /X-Frame-Options: DENY/);
});
