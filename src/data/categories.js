// "title" and "tools" are shown on the homepage category cards.
export const categories = [
  { slug: "ai-tools", name: "AI Tools", title: "AI & Automation", emoji: "🤖", tools: "ChatGPT, Claude, Gemini, SuperGrok, ElevenLabs" },
  { slug: "creative-tools", name: "Creative Tools", title: "Creative Tools", emoji: "🎨", tools: "Veo, Runway, Leonardo AI, HeyGen, CapCut, Canva" },
  { slug: "developer-tools", name: "Developer Tools", title: "Developer Tools", emoji: "💻", tools: "Lovable, Replit, n8n" },
  { slug: "productivity", name: "Productivity", title: "Writing & Productivity", emoji: "📊", tools: "Grammarly, QuillBot, Jasper, Notion, Gamma" },
  { slug: "marketing-tools", name: "Marketing & SEO", title: "Marketing & SEO", emoji: "📈", tools: "SEMrush, vidIQ, Helium 10, Success.ai" },
  { slug: "vpn-security", name: "VPN & Security", title: "VPN & Security", emoji: "🔐", tools: "NordVPN, Surfshark" },
  { slug: "entertainment", name: "Entertainment", title: "Entertainment", emoji: "🎬", tools: "Netflix, Prime Video, YouTube Premium" },
  { slug: "education-research", name: "Education & Research", title: "Education & Research", emoji: "📚", tools: "Coursera, Duolingo, Kahoot, learning tools" },
  { slug: "professional", name: "Professional", title: "Business & Professional", emoji: "💼", tools: "LinkedIn, Microsoft, work tools" },
  { slug: "api-tools", name: "AI APIs", title: "AI APIs & Credits", emoji: "🔌", tools: "Muse AI, GPT, Claude, Gemini APIs and developer credits" },
  { slug: "discounts", name: "Discounts", title: "Special Offers", emoji: "🏷️", tools: "Products currently on sale" },
];

// Extra category that appears in the catalog filter but not on the homepage cards.
export const allCategories = categories;

// Each category gets its own color, used for cards and tiles across the site.
const colors = { discounts: "#dc2626", "ai-tools": "#3b82f6", "creative-tools": "#f59e0b", "developer-tools": "#14b8a6", productivity: "#6366f1", "marketing-tools": "#f97316", "vpn-security": "#10b981", entertainment: "#0ea5e9", professional: "#64748b", "education-research":"#0ea5e9", "api-tools":"#8b5cf6" };
allCategories.forEach((c) => { c.color = colors[c.slug]; });
