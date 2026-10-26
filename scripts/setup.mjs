// One-time setup: installs everything, asks for an admin password and (optionally) your domain.
import { execSync } from "node:child_process";
import fs from "node:fs";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const run = (command, cwd) => execSync(command, { cwd, stdio: "inherit" });
const rl = readline.createInterface({ input: process.stdin });
const queue = [];
let waiting = null;
let closed = false;
rl.on("line", (line) => (waiting ? (waiting(line), (waiting = null)) : queue.push(line)));
rl.on("close", () => { closed = true; waiting?.(""); });
const ask = (question) => {
  process.stdout.write(question);
  return queue.length ? Promise.resolve(queue.shift()) : new Promise((resolve) => (waiting = resolve));
};

console.log("\n[1/3] Installing the website. This can take a few minutes the first time...\n");
run("npm ci --no-audit --no-fund", root);
run("npm ci --no-audit --no-fund", root + "server");

console.log("\n[2/3] Admin password\n");
const envPath = root + "server/.env";
if (fs.existsSync(envPath)) {
  console.log("An admin password is already saved (server/.env), so this step is skipped.");
} else {
  let password = "";
  while (password.length < 12) {
    if (closed && !queue.length) { console.log("\nNo password was entered. Please run the setup again."); process.exit(1); }
    password = (await ask("Choose an admin password (at least 12 characters, write it down): ")).trim();
  }
  const example = fs.readFileSync(root + "server/.env.example", "utf8");
  fs.writeFileSync(envPath, example.replace(/^ADMIN_PASSWORD=.*$/m, () => `ADMIN_PASSWORD=${password}`));
  console.log("Saved. You will use this password to log in at /admin.");
}

console.log("\n[3/3] Your domain (optional)\n");
const configPath = root + "src/config.js";
const config = fs.readFileSync(configPath, "utf8");
if (!config.includes("YOUR-DOMAIN")) {
  console.log("A domain is already saved, so this step is skipped.");
} else {
  let domain = (await ask("If you already own a domain, type it (for example aitoolspak.com). Otherwise just press Enter: ")).trim().toLowerCase().replace(/\s+/g, "");
  if (domain) {
    if (!domain.startsWith("http")) domain = `https://${domain}`;
    domain = domain.replace(/\/+$/, "");
    fs.writeFileSync(configPath, config.replace(/export const siteUrl = ".*?";/, () => `export const siteUrl = "${domain}";`));
    console.log(`Saved: ${domain}`);
  } else {
    console.log("No problem. You can run this setup again later when you have one.");
  }
}
rl.close();

console.log("\nSetup complete! Start the website with: npm run dev\n");
