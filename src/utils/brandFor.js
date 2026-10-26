// Reuse existing verified assets for known tool collections; no random external image URLs.
const verifiedLogos = {
  chatgpt:'chatgpt-plus',
  claude:'claude-pro',
  gemini:'gemini-pro',
  canva:'canva-pro-edu',
  elevenlabs:'elevenlabs',
  figma:'figma-pro-private',
  capcut:'capcut-pro',
  adobe:'adobe-creative',
  notion:'notion-business',
  replit:'replit-core',
  lovable:'lovable-pro',
  gamma:'gamma-pro',
  leonardo:'leonardo-ai',
  runway:'runway-ml-pro',
  nordvpn:'nordvpn',
  surfshark:'surfshark-vpn',
  youtube:'youtube-premium',
  netflix:'netflix',
  grammarly:'grammarly-premium',
  microsoft:'windows-11-pro-key',
  coursera:'coursera-premium',
  semrush:'semrush-pro',
  'prime-video':'prime-video',
  n8n:'n8n-starter'
};

const normalizeSlug = (value = '') => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/\s+ai$/, '')
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const keywordAliases = [
  [/chatgpt|openai|slot gpt|\bgpt\b|gpt business/, 'chatgpt'],
  [/claude/, 'claude'],
  [/gemini|google ai/, 'gemini'],
  [/grok|supergrok|x premium|upgrade x premium|\bx\b/, 'grok'],
  [/perplexity/, 'perplexity'],
  [/manus/, 'manus'],
  [/canva/, 'canva'],
  [/capcut/, 'capcut'],
  [/figma/, 'figma'],
  [/notion/, 'notion'],
  [/adobe/, 'adobe'],
  [/elevenlabs/, 'elevenlabs'],
  [/gamma/, 'gamma'],
  [/lovable/, 'lovable'],
  [/cursor/, 'cursor'],
  [/replit/, 'replit'],
  [/runway/, 'runway'],
  [/leonardo/, 'leonardo-ai'],
  [/higgsfield/, 'higgsfield'],
  [/kling/, 'kling-ai'],
  [/meitu|beautycam|xingtu/, 'meitu'],
  [/youtube/, 'youtube'],
  [/netflix/, 'netflix'],
  [/prime video|amazon prime/, 'prime-video'],
  [/coursera/, 'coursera'],
  [/duolingo/, 'duolingo'],
  [/kahoot/, 'kahoot'],
  [/quizlet/, 'quizlet'],
  [/studocu/, 'studocu'],
  [/grammarly/, 'grammarly'],
  [/linkedin/, 'linkedin'],
  [/microsoft|windows/, 'microsoft'],
  [/express\s?vpn|expressvpn|^express$/, 'express-vpn'],
  [/nordvpn/, 'nordvpn'],
  [/surfshark/, 'surfshark'],
  [/proton/, 'proton'],
  [/purevpn/, 'purevpn'],
  [/pia vpn|private internet access/, 'pia-vpn'],
  [/hotspot shield/, 'hotspot-shield-vpn'],
  [/ipvanish/, 'ipvanish'],
  [/norton vpn/, 'norton-vpn'],
  [/telegram|\btele\b/, 'telegram'],
  [/tiktok/, 'tiktok'],
  [/discord/, 'discord'],
  [/onlyfan/, 'onlyfans'],
  [/flora/, 'flora'],
  [/minimax/, 'minimax'],
  [/deepseek/, 'deepseek'],
  [/tv360/, 'tv360'],
  [/vieon/, 'vieon'],
  [/gpm/, 'gpm-login'],
  [/icloud|apple music|\bapple\b/, 'apple'],
  [/kiro/, 'kiro'],
  [/dropshot/, 'dropshot'],
  [/photoroom/, 'photoroom'],
  [/pipit/, 'pipit'],
  [/n8n/, 'n8n'],
  [/roblox/, 'roblox'],
  [/spotify/, 'spotify'],
  [/suno/, 'suno'],
  [/mb bank|\bmb\b/, 'mb-bank'],
  [/fpt play/, 'fpt-play'],
  [/galaxy play/, 'galaxy-play'],
  [/genspark/, 'genspark'],
  [/freepik/, 'freepik'],
  [/autodesk/, 'autodesk'],
  [/heygen/, 'heygen'],
  [/akool/, 'akool'],
  [/iqiyi/, 'iqiyi'],
  [/scribd/, 'scribd'],
  [/youku/, 'youku'],
  [/jetbrains/, 'jetbrains'],
  [/openart/, 'openart'],
  [/railway/, 'railway'],
  [/quillbot/, 'quillbot'],
  [/udemy/, 'udemy'],
  [/skillshare/, 'skillshare'],
  [/wispr flow/, 'wispr-flow'],
  [/brain fm|brain-fm/, 'brain-fm'],
  [/domoai/, 'domoai'],
  [/seedance/, 'seedance'],
  [/api tools|\bapi\b/, 'api-tools'],
  [/education tools|education/, 'education-tools'],
  [/social tools|social/, 'social-tools']
];

export const brandIconSlug = (brand) => {
  const normalized = normalizeSlug(brand);
  return verifiedLogos[normalized] || normalized || null;
};

export const extractDomainFromText = (...values) => {
  const text = values.filter(Boolean).join(' ');
  const directUrl = text.match(/https?:\/\/([^\s/]+)/i)?.[1];
  if (directUrl) return directUrl.toLowerCase().replace(/^www\./, '');
  const bareDomain = text.match(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/i)?.[0];
  return bareDomain ? bareDomain.toLowerCase().replace(/^www\./, '') : null;
};

export const inferBrandKey = (...values) => {
  const direct = values.map(brandIconSlug).find(Boolean);
  const text = values.filter(Boolean).join(' ').toLowerCase();
  for (const [pattern, key] of keywordAliases) {
    if (pattern.test(text)) return key;
  }
  const domain = extractDomainFromText(...values);
  if (domain) {
    if (domain.includes('flora.ai')) return 'flora';
    if (domain.includes('openai.com')) return 'chatgpt';
    if (domain.includes('claude.ai')) return 'claude';
    if (domain.includes('canva.com')) return 'canva';
    if (domain.includes('notion.so')) return 'notion';
    return normalizeSlug(domain.split('.').slice(-2, -1)[0] || domain.split('.')[0]);
  }
  return direct;
};
