// Starts the website. Normal mode serves the finished, fast version at http://localhost:5000
// (it prepares that version first if anything changed). "--dev" starts the slower editing mode instead.
import "./ensure-deps.mjs";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const dev = process.argv.includes("--dev");

const newest = (target) => {
  const stat = fs.statSync(target);
  if (!stat.isDirectory()) return stat.mtimeMs;
  return Math.max(0, ...fs.readdirSync(target).map((name) => newest(path.join(target, name))));
};
const open = (url) => {
  if (process.env.NO_OPEN) return;
  const [cmd, args] = process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : [process.platform === "darwin" ? "open" : "xdg-open", [url]];
  spawn(cmd, args, { stdio: "ignore", detached: true }).unref();
};

const children = [];
const startServer = () => children.push(spawn(process.execPath, ["index.js"], { cwd: root + "server", stdio: "inherit" }));

if (dev) {
  startServer();
  children.push(spawn(process.execPath, ["node_modules/vite/bin/vite.js", ...(process.env.NO_OPEN ? [] : ["--open"])], { cwd: root, stdio: "inherit" }));
} else {
  const built = path.join(root, "dist/index.html");
  const sources = ["src", "public", "scripts", "index.html", "package.json"].map((f) => newest(path.join(root, f)));
  if (!fs.existsSync(built) || fs.statSync(built).mtimeMs < Math.max(...sources)) {
    console.log("\nPreparing the fast version of the website (this takes about a minute and only happens after changes)...\n");
    const result = spawnSync("npm run build", { cwd: root, stdio: "inherit", shell: true });
    if (result.status !== 0) { console.log("\nSomething went wrong while preparing the website. Please send a screenshot of this window."); process.exit(1); }
  }
  startServer(); // only after the new version is ready, so nobody sees a half-finished site
  setTimeout(() => open("http://localhost:5000"), 1500);
  console.log("\nYour website: http://localhost:5000   (admin: http://localhost:5000/admin)");
}

const stop = () => { children.forEach((child) => child.kill()); process.exit(); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
console.log("Keep this window open while you use the website. Close it (or press Ctrl+C) to stop.\n");
