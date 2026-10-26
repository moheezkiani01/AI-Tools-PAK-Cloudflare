// Lists the logo files you put in public/logos, so the website never has to guess (guessing = slow failed requests).
// Runs automatically before every build.
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const dir = root + "public/logos";
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /\.(png|svg|webp|jpg)$/i.test(f)) : [];
const map = Object.fromEntries(files.map((f) => [f.replace(/\.[^.]+$/, ""), f.split(".").pop().toLowerCase()]));
fs.writeFileSync(root + "src/data/logoFiles.js", `// Generated from the files in public/logos. Do not edit.\nexport const logoFiles = ${JSON.stringify(map, null, 1)};\n`);
console.log("Logo files found:", Object.keys(map).join(", ") || "none");
