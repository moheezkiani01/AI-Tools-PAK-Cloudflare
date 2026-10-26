// Deterministic, private catalog preparation. No supplier prices go in src/ or public/.
import crypto from 'node:crypto';
import fs from 'node:fs';
import { parse as parsePath } from 'node:path';
export const USD_TO_PKR = 300;
export const MARKUP_PERCENT = 25;
const emojis = /[\p{Extended_Pictographic}\uFE0F\u200D]/gu;
export const normalize = (value) => String(value || '').normalize('NFKC').replace(emojis,' ').toLowerCase().replace(/\b(?:🔥|hot sale)\b/g, ' ').replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
export const slugify = (v) => normalize(v).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,95);
const words = (v) => String(v || '').replace(emojis,' ').replace(/\s+/g,' ').trim();
// Preserve meaningful plan symbols for deduplication. VIP+ and VIP, for
// example, are different tiers even though their plain slugs look alike.
// Keep normalize()/slugify() unchanged to avoid renaming existing records.
const variantName = name => normalize(String(name).replace(/([\p{L}\p{N}])\s*\+/gu, '$1 PLUS '));
// Money: use integer USD cents, then round half up to nearest PKR.
export function costCents(v) {
  const s = String(v ?? '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) throw new Error(`Invalid USD amount: ${s}`);
  const [whole, fraction=''] = s.split('.');
  const cents = Number(BigInt(whole)*100n + BigInt(fraction.padEnd(2,'0')));
  if (!Number.isSafeInteger(cents) || cents < 1 || cents > 1e9) throw new Error('USD cost out of range');
  return cents;
}
export function pricePkr(usdCents, rate = USD_TO_PKR) {
  if (!Number.isSafeInteger(rate) || rate < 1 || rate > 100000) throw new Error('Invalid exchange rate');
  return Number((BigInt(usdCents)*BigInt(100 + MARKUP_PERCENT)*BigInt(rate)+5000n)/10000n);
}
const categoryGroups = [
  [/chatgpt|openai|gpt go|gpt pro|codex/i, ['ChatGPT','ai-tools']],
  [/claude|anthropic/i,['Claude','ai-tools']],
  [/gemini|google ai|veo/i,['Gemini','ai-tools']],
  [/canva/i,['Canva','creative-tools']],
  [/\bwink\b/i,['Wink','creative-tools']],
  [/\bmeitu\b/i,['Meitu','creative-tools']],
  [/beautycam/i,['BeautyCam','creative-tools']],
  [/xingtu/i,['Xingtu','creative-tools']],
  [/elevenlabs|eleven labs|elevanlabs/i,['ElevenLabs','ai-tools']],
  [/figma/i,['Figma','creative-tools']],
  [/capcut/i,['CapCut','creative-tools']],
  [/adobe|photoshop|illustrator/i,['Adobe','creative-tools']],
  [/leonardo/i,['Leonardo AI','creative-tools']],
  [/kling/i,['Kling AI','creative-tools']],
  [/higgsfield|higgfield/i,['Higgsfield','creative-tools']],
  [/notion/i,['Notion','productivity']],
  [/cursor/i,['Cursor','developer-tools']],
  [/replit/i,['Replit','developer-tools']],
  [/lovable/i,['Lovable','developer-tools']],
  [/gamma/i,['Gamma','productivity']],
  [/runway/i,['Runway','creative-tools']],
  [/freepik/i,['Freepik','creative-tools']],
  [/midjourney/i,['Midjourney','creative-tools']],
  [/perplexity/i,['Perplexity','ai-tools']],
  [/grok/i,['Grok','ai-tools']],
  [/youtube/i,['YouTube','entertainment']],
  [/netflix/i,['Netflix','entertainment']],
  [/nordvpn/i,['NordVPN','vpn-security']],
  [/surfshark/i,['Surfshark','vpn-security']],
  [/grammarly/i,['Grammarly','productivity']],
  [/semrush/i,['Semrush','marketing-tools']],
  [/vidiq/i,['vidIQ','marketing-tools']],
  [/microsoft|office 365|windows/i,['Microsoft','professional']],
  [/gmail|google one|drive/i,['Google','productivity']],
  [/api|token|credit/i,['API tools','api-tools']],
  [/discord|telegram|facebook|tiktok/i,['Social tools','marketing-tools']],
  [/coursera|duolingo|kahoot|quizlet|udemy|turnitin/i,['Education tools','education-research']],
];
const risky = [/\b(?:password|pass\|2fa|2fa secret|otp|verification code|recovery code|credentials)\b/i,/\b(?:shared account|pre-provided account|account is pre|rent number|edu|k12)\b/i,/\b(?:bypass|crack|unofficial|no warranty|resell)\b/i];
function dimensions(text) {
  const t = normalize(text);
  return [...t.matchAll(/\b(?:\d+(?:\.\d+)?\s*(?:days?|months?|years?|hours?|credits?|tokens?|gb|tb|rpm|k|m|b)|(?:no|full|\d+\s*day)\s+warranty)\b/g)].map(m=>m[0]).join('|');
}
export function cleanDescription(source) {
  const raw = String(source||'').replace(/https?:\/\/\S+|(?:t\.me|bit\.ly|tinyurl\.com|2fa\.live|2fa\.page)\/\S+/gi,'');
  const lines = raw.split(/\n|(?<=\.)\s+(?=[A-Z])/).map(s => words(s)).filter(Boolean).filter(s => !/(?:send|share|paste|provide|enter|copy).{0,100}(?:password|2fa|otp|secret|login code|credential)/i.test(s)).filter(s => !/(?:telegram|whatsapp group|announcement channel|shop link|supplier|contact me|website:|visit the web|seller|http)/i.test(s));
  return lines.slice(0,5).join(' ').replace(/\s{2,}/g,' ').slice(0,540);
}
export function prepareCatalog(sources, existing = []) {
  const byId = new Map(); let processed = 0, repeatedSourceRows = 0;
  for (const {source, rows} of sources) {
    for (const row of rows) {
      processed++;
      const id = String(row.productId || row.ProductID || '').trim();
      if (!/^[a-f\d]{24}$/i.test(id)) continue;
      const name = words(row.name ?? row.Name).slice(0,230);
      const amount = row.price?.amount ?? row.Price;
      const currency = row.price?.currency ?? row.Currency;
      if (!name || currency !== 'USD') continue;
      let cents; try { cents = costCents(amount); } catch { continue; }
      const rec = { id, source, name, cents, description: String(row.description ?? row.Description ?? ''), type: String(row.productType || 'unspecified'), available: row.availability?.available ?? row.Available, emoji: String(row.emoji||'') };
      if (byId.has(id)) {
        repeatedSourceRows++;
        const was = byId.get(id);
        // For exact source IDs, prefer highest cost and richer details.
        if (cents > was.cents) was.cents = cents;
        if (rec.description.length > was.description.length) was.description = rec.description;
        if (rec.type !== 'unspecified') {was.type = rec.type; was.emoji = rec.emoji;}
        if (rec.available !== undefined && rec.available !== '') was.available=rec.available;
      } else byId.set(id, rec);
    }
  }
  const byVariant = new Map(); let nearDuplicates = 0;
  for (const rec of byId.values()) {
    const normalized = variantName(rec.name);
    const dim = dimensions(rec.name)+'|'+dimensions(rec.description); // Conservative: do not combine materially different plans/warranties.
    const key = [normalized, rec.type, dim].join('::');
    if (byVariant.has(key)) {
      nearDuplicates++;
      const old = byVariant.get(key);
      old.cost_cents = Math.max(old.cost_cents,rec.cents);
      // Keep the preview/audit selling price synchronized with the selected
      // highest supplier cost. Do not stack a second markup on prior prices.
      old.price_pkr = pricePkr(old.cost_cents);
      old.source_ids.push(rec.id);
      if (rec.available !== undefined && rec.available !== '' && Number(rec.available)>0) old.unavailable=false;
      if (cleanDescription(rec.description).length > old.description.length) old.description = cleanDescription(rec.description);
      old.flags = [...new Set([...old.flags,...risky.filter(r=>r.test(rec.name+' '+rec.description)).map(r=>r.source)])];
      continue;
    }
    const found = categoryGroups.find(([r])=>r.test(rec.name+' '+rec.emoji));
    const [brand,category] = found ? found[1] : [rec.emoji && rec.emoji !== 'none' ? words(rec.emoji.replaceAll('_',' ')) : words(rec.name.split(/[-|:(]/)[0]).split(' ').slice(0,3).join(' '), 'productivity'];
    const group_slug = slugify(brand) || 'other-tools';
    const hash = crypto.createHash('sha256').update(key).digest('hex').slice(0,12);
    const slug = `import-${slugify(rec.name).slice(0,72)}-${hash}`;
    const desc = cleanDescription(rec.description);
    byVariant.set(key, {slug,group_slug,brand,category,name:rec.name,description:desc || `${brand} digital product. Confirm the plan terms and eligibility before ordering.`,product_type:rec.type,variant:dimensions(rec.name).slice(0,100) || rec.name,cost_cents:rec.cents,price_pkr:pricePkr(rec.cents),source_ids:[rec.id],unavailable:rec.available !== null && rec.available !== undefined && rec.available !== '' && Number(rec.available)===0,flags:risky.filter(r=>r.test(rec.name+' '+rec.description)).map(r=>r.source),status:'pending'});
  }
  const variants = [...byVariant.values()].sort((a,b)=>a.slug.localeCompare(b.slug));
  const groups = new Set(variants.map(v=>v.group_slug));
  const legacyGroups = new Set(existing.map(p=>slugify(p.name.split(/\s+(?:pro|premium|max|plus|creator|ultra)\b/i)[0])));
  return {variants, stats: {sourceRows:processed, csvJsonDuplicates:repeatedSourceRows, nearDuplicates, totalDuplicates:repeatedSourceRows+nearDuplicates, uniqueSourceIds:byId.size, uniqueVariants:variants.length, groups:groups.size, flagged:variants.filter(p=>p.flags.length).length, pending:variants.length, possibleLegacyOverlaps:variants.filter(p=>legacyGroups.has(p.group_slug)).length}};
}
export function readSources(paths) {
  return paths.map(file=>{
    const text=fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'');
    const source=parsePath(file).name.replace(/\(.*\)/,'');
    if (file.endsWith('.json')) return {source,rows:JSON.parse(text).products};
    // The CSV exporter escapes paragraphs inside quoted fields; use Python to convert CSV to JSON beforehand.
    return {source,rows:parseCsv(text)};
  });
}
function parseCsv(text) {
  // RFC 4180 CSV tokenizer handles escaped quotes and multiline descriptions.
  const rows=[];let row=[],field='',quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){field+='"';i++;}else if(c==='"')quoted=false;else field+=c;}
    else if(c==='"')quoted=true;else if(c===','){row.push(field);field='';}else if(c==='\n'){row.push(field.replace(/\r$/,''));rows.push(row);row=[];field='';}else field+=c;
  }
  if(field||row.length){row.push(field);rows.push(row);}
  const headings=rows.shift();return rows.filter(r=>r.some(Boolean)).map(r=>Object.fromEntries(headings.map((k,i)=>[k,r[i]??''])));
}
