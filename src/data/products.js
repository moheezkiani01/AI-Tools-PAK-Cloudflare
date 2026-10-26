// Central product list. Later this can come from MongoDB (GET /api/products).
// - price: lowest price in PKR. Products with "options" show "From Rs. ..."
// - months: durations in months (used by the Duration filter)
// - popular: your own "Popular" badge, change it any time
// - Newest sort: products lower in this list count as newer
// Stock (Available / Out of stock) is set in the admin page, not here.
export const products = [
  // AI assistants and voice
  { slug: "gemini-pro", name: "Gemini Pro", category: "ai-tools", description: "Access powerful AI capabilities for research, writing, coding, analysis and everyday productivity.", duration: "18 Months", months: [18], price: 900, popular: true },
  { slug: "chatgpt-plus", name: "ChatGPT Plus", category: "ai-tools", description: "Conversational AI for writing, analysis, coding and daily tasks.", duration: "1 Month", months: [1], price: 2200, popular: true },
  { slug: "chatgpt-plus-apple-account", name: "ChatGPT Plus (Apple Paid Account)", category: "ai-tools", description: "ChatGPT Plus on an Apple paid account. Details are confirmed before you pay.", duration: "", months: [], limit: "Apple paid account", price: 2300 },
  { slug: "claude-pro", name: "Claude Pro", category: "ai-tools", description: "AI assistant for long writing, research and code help.", duration: "1 Month", months: [1], price: 5500, popular: true },
  { slug: "claude-20x-max", name: "Claude 20X Max Plan", category: "ai-tools", description: "The highest Claude plan, for heavy daily use.", duration: "1 Month", months: [1], limit: "20x usage limit", price: 45000 },
  { slug: "supergrok", name: "SuperGrok", category: "ai-tools", description: "Advanced Grok AI assistant plan.", duration: "1–3 Months", months: [1, 3], price: 2500 },
  { slug: "google-ai-ultra", name: "Google AI Ultra Plan", category: "ai-tools", description: "Google's higher AI tier, above the standard Gemini Pro plan.", duration: "1 Month", months: [1], price: 1764 },
  { slug: "manus-ai-pro", name: "Manus AI Pro", category: "ai-tools", description: "AI agent platform subscription.", duration: "1 Year", months: [12], price: 13000 },
  { slug: "elevenlabs", name: "ElevenLabs Creator", category: "ai-tools", description: "AI voice for narration, dubbing and speech.", duration: "1 Month", months: [1], limit: "300K+ credits", price: 3300 },
  { slug: "playht", name: "PlayHT", category: "ai-tools", description: "Text-to-speech and AI voice generation.", duration: "1 Month", months: [1], price: 3960 },

  // Creative: video, images, design
  { slug: "veo-3-ultra", name: "Veo 3 Ultra", category: "creative-tools", description: "AI video generation plan.", duration: "", months: [], limit: "Unlimited video generation", price: 2100, popular: true },
  { slug: "veo-3-ultra-invite", name: "Veo 3 Ultra Invite", category: "creative-tools", description: "Veo 3 Ultra access with credit-based tiers.", duration: "Credit-based", months: [], limit: "200–1000 credits", price: 8500 },
  { slug: "veo-3-extension", name: "Veo 3 Extension", category: "creative-tools", description: "Google Veo 3 text-to-video through a browser extension.", duration: "1 Month", months: [1], price: 3000 },
  { slug: "runway-ml-pro", name: "Runway ML Pro", category: "creative-tools", description: "AI video generation and editing.", duration: "1 Month", months: [1], limit: "2,250 credits", price: 5500 },
  { slug: "runway-ml-max", name: "Runway ML Max", category: "creative-tools", description: "Runway with the largest monthly credit allowance.", duration: "1 Month", months: [1], limit: "9,500 credits", price: 14000 },
  { slug: "leonardo-ai", name: "Leonardo AI", category: "creative-tools", description: "AI image generation for design and creative work.", duration: "1 Month", months: [1], price: 2200 },
  { slug: "ideogram-ai-plus", name: "Ideogram AI Plus", category: "creative-tools", description: "AI images with strong text-in-image results.", duration: "1 Month", months: [1], price: 1500 },
  { slug: "dzine-master", name: "Dzine Master", category: "creative-tools", description: "AI design suite for graphics and image editing.", duration: "1 Month", months: [1], limit: "Full design suite", price: 5000 },
  { slug: "heygen-ai", name: "HeyGen AI", category: "creative-tools", description: "AI avatars and text-to-video for creators.", duration: "1 Month", months: [1], limit: "600–2000 credits", price: 7400 },
  { slug: "hailuo-ai", name: "Hailuo AI", category: "creative-tools", description: "AI video generation from prompts.", duration: "1 Month", months: [1], price: 2040 },
  { slug: "capcut-pro", name: "CapCut Pro", category: "creative-tools", description: "Video editing subscription with the full editing suite.", duration: "1 Month", months: [1], price: 900 },
  { slug: "storyblocks-unlimited", name: "Storyblocks Unlimited", category: "creative-tools", description: "Stock video, audio and templates (a media library, not an AI generator).", duration: "1 Month", months: [1], limit: "Unlimited downloads", price: 4000 },
  { slug: "canva-pro-edu", name: "Canva Pro Edu", category: "creative-tools", description: "Design subscription on an education plan. Educational eligibility applies.", duration: "1 Year", months: [12], price: 900, popular: true },
  { slug: "figma-pro-private", name: "Figma Pro Private", category: "creative-tools", description: "Interface and collaborative design tool.", duration: "2 Years", months: [24], price: 3000 },
  { slug: "adobe-creative", name: "Adobe Creative", category: "creative-tools", description: "Adobe creative software subscription.", months: [2, 12], options: [{ label: "2 Months", price: 1700 }, { label: "1 Year", price: 25000 }], price: 1700 },

  // Developer tools
  { slug: "lovable-pro", name: "Lovable Pro", category: "developer-tools", description: "AI app builder subscription.", duration: "1 Month", months: [1], limit: "100–300 credits", price: 1500 },
  { slug: "replit-core", name: "Replit Core", category: "developer-tools", description: "Online coding environment.", months: [12], options: [{ label: "$40 Credits", price: 3200 }, { label: "1 Year", price: 12000 }], price: 3200 },
  { slug: "n8n-starter", name: "n8n Starter", category: "developer-tools", description: "Workflow automation platform plan.", duration: "1 Year", months: [12], price: 7000 },

  // Writing and productivity
  { slug: "grammarly-premium", name: "Grammarly Premium", category: "productivity", description: "Grammar, clarity and proofreading help.", duration: "1 Month", months: [1], price: 1000 },
  { slug: "quillbot", name: "QuillBot", category: "productivity", description: "Paraphrasing, summaries and grammar help.", duration: "1 Month", months: [1], price: 479 },
  { slug: "wordai", name: "WordAI", category: "productivity", description: "Article rewriting for content workflows.", duration: "1 Month", months: [1], price: 600 },
  { slug: "jasper-ai", name: "Jasper AI", category: "productivity", description: "AI copywriting for marketing content.", duration: "1 Month", months: [1], price: 600 },
  { slug: "notion-business", name: "Notion Business", category: "productivity", description: "Workspace for notes, docs and team projects.", duration: "3 Months", months: [3], price: 2200 },
  { slug: "gamma-pro", name: "Gamma Pro", category: "productivity", description: "AI tool for presentations and documents.", duration: "1 Year", months: [12], price: 23000 },

  // Marketing and SEO
  { slug: "semrush-pro", name: "SEMrush Pro", category: "marketing-tools", description: "SEO and marketing toolkit.", duration: "1 Month", months: [1], price: 1500 },
  { slug: "vidiq", name: "vidIQ", category: "marketing-tools", description: "YouTube SEO and channel growth tools.", duration: "1 Month", months: [1], price: 2159 },
  { slug: "helium-10-platinum", name: "Helium 10 Platinum", category: "marketing-tools", description: "Amazon seller research and listing tools.", duration: "1 Month", months: [1], price: 2500 },
  { slug: "helium-10-diamond", name: "Helium 10 Diamond", category: "marketing-tools", description: "Advanced Amazon seller suite with expanded analytics.", duration: "1 Month", months: [1], price: 4500 },
  { slug: "success-ai-starter", name: "Success.ai Starter Leads", category: "marketing-tools", description: "Lead generation for outreach and sales.", duration: "1 Month", months: [1], limit: "2,000 contacts", price: 2400 },

  // VPN and security
  { slug: "nordvpn", name: "NordVPN", category: "vpn-security", description: "VPN subscription for online privacy.", duration: "3 Months", months: [3], price: 1800 },
  { slug: "surfshark-vpn", name: "Surfshark VPN", category: "vpn-security", description: "VPN subscription for online privacy.", duration: "2 Months", months: [2], price: 800 },

  // Entertainment
  { slug: "netflix", name: "Netflix", category: "entertainment", description: "Netflix streaming plan.", duration: "1 Month", months: [1], limit: "1 screen", price: 500, popular: true },
  { slug: "prime-video", name: "Prime Video", category: "entertainment", description: "Amazon Prime Video streaming plan.", duration: "1 Month", months: [1], limit: "1 screen", price: 400 },
  { slug: "youtube-premium", name: "YouTube Premium", category: "entertainment", description: "YouTube Premium subscription.", duration: "3 Months", months: [3], price: 1200 },

  // Professional
  { slug: "coursera-premium", name: "Coursera Premium", category: "professional", description: "Online courses and certificates.", duration: "1 Month", months: [1], limit: "Full course access", price: 1000 },
  { slug: "linkedin-premium", name: "LinkedIn Premium", category: "professional", description: "Professional networking subscription.", duration: "2 Months", months: [2], price: 1500 },
  { slug: "windows-11-pro-key", name: "Windows 11 Pro License Key", category: "professional", description: "Windows 11 Pro license key.", duration: "License Key", months: [], price: 1900 },
];
