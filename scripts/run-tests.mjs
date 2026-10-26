// Compatibility switch applies ONLY to the test subprocess. Production defaults
// to cookie sessions; raw admin password headers are disabled by default.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
const tests=fs.readdirSync(new URL('../tests/',import.meta.url)).filter(f=>f.endsWith('.test.mjs')).sort().map(f=>`tests/${f}`);
const result=spawnSync(process.execPath,['--test',...tests],{
  stdio:'inherit',env:{...process.env,ALLOW_LEGACY_ADMIN_HEADER:'true', ORDER_STORAGE_V2:'false'}
});
process.exit(result.status ?? 1);
