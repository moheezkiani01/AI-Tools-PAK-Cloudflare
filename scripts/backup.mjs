// Run locally: npm run backup. Keeps all customer data PRIVATE on your own machine.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const envPath = path.join(root, "server", ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (match && !(match[1] in process.env)) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}
const { load, databaseMode } = await import("../server/dataStore.js");
if (process.argv.includes("--cloud") && databaseMode() !== "supabase") {
  console.error("Cloud backup needs SUPABASE_URL and SUPABASE_SECRET_KEY in server/.env.");
  process.exit(1);
}
const db = await load();
const dir = path.join(root, "backups");
fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
const date = new Date().toISOString().replace(/:/g, "-");
const filename = path.join(dir, `store-backup-${date}.json`);
fs.writeFileSync(filename, JSON.stringify(db, null, 2), { mode: 0o600 });
console.log(`Backup created: ${filename}\nKeep it private; it contains real customer information.`);
