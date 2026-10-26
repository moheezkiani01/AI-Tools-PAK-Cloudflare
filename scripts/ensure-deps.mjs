// Repair missing or incomplete npm packages before starting or building the site.
// node_modules is deliberately excluded from the downloadable ZIP because
// native dependencies installed on one operating system may not work on another.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const installs = [
  {
    label: "website frontend",
    directory: root,
    requiredFiles: [
      "node_modules/vite/dist/node/cli.js",
      "node_modules/@vitejs/plugin-react/package.json",
      "node_modules/@tailwindcss/vite/package.json",
      "node_modules/react/package.json",
      "node_modules/react-dom/package.json",
    ],
  },
  {
    label: "website backend",
    directory: path.join(root, "server"),
    requiredFiles: [
      "node_modules/express/package.json",
      "node_modules/compression/package.json",
      "node_modules/nodemailer/package.json",
    ],
  },
];

for (const install of installs) {
  const missing = install.requiredFiles.some((file) => !fs.existsSync(path.join(install.directory, file)));
  if (!missing) continue;

  console.log(`\nInstalling/repairing ${install.label} dependencies (internet connection required on first install)...\n`);
  const hasLockfile = fs.existsSync(path.join(install.directory, "package-lock.json"));
  const args = [hasLockfile ? "ci" : "install", "--no-audit", "--no-fund"];
  const result = spawnSync("npm", args, {
    cwd: install.directory,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.error || result.status !== 0) {
    console.error(`\nUnable to install ${install.label} packages. Check your internet connection, then run: npm run setup`);
    if (result.error) console.error(result.error.message);
    process.exit(1);
  }
  const stillMissing = install.requiredFiles.filter((file) => !fs.existsSync(path.join(install.directory, file)));
  if (stillMissing.length) {
    console.error(`Installation finished but required files are still missing: ${stillMissing.join(", ")}`);
    process.exit(1);
  }
}
