// Usage: npm run add-token -- AIT-483920 gemini-pro
// The product slug is optional. With it, the token only works for that product.
import fs from "node:fs";

const DB_FILE = new URL("./db.json", import.meta.url);
const db = fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE, "utf8")) : { clicks: [], tokens: [], reviews: [] };

const [token, slug] = process.argv.slice(2);
if (!token) {
  console.log("Usage: npm run add-token -- <PURCHASE-NUMBER> [product-slug]\n\nTokens so far:");
  db.tokens.forEach((t) => console.log(`${t.token}  ${t.slug || "(any product)"}  ${t.used ? "USED" : "unused"}`));
} else if (db.tokens.some((t) => t.token === token.toUpperCase())) {
  console.log("That purchase number already exists.");
} else {
  db.tokens.push({ token: token.toUpperCase(), slug: slug || null, used: false, createdAt: new Date().toISOString() });
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  console.log(`Added ${token.toUpperCase()} ${slug ? `for ${slug}` : "(any product)"}`);
}
