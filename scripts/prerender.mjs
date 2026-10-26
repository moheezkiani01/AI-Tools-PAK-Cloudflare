// Runs after "vite build". Writes a separate HTML file for every URL with its own
// title, description, canonical link and structured data, plus sitemap.xml and robots.txt.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { products } from "../src/data/products.js";
import { allCategories } from "../src/data/categories.js";
import { posts } from "../src/data/blog.js";
import { compareGroups } from "../src/data/compare.js";
import { infoPages } from "../src/data/infoPages.js";
import { brand, siteUrl } from "../src/config.js";
import { buildCatalogGroups } from "../src/utils/catalogGroups.js";
import { approvedSeoProducts } from "./public-catalog-seo.mjs";

// Vercel supplies its production URL automatically. SITE_URL overrides it for a custom domain.
const resolvedUrl = process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "")
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") || siteUrl;
const SITE = resolvedUrl.replace(/\/$/, "");
if (SITE.includes("YOUR-DOMAIN")) console.warn("\n!! Set your real domain before the final build, e.g. SITE_URL=https://yourdomain.com npm run build\n");

const dist = fileURLToPath(new URL("../dist/", import.meta.url));
const template = fs.readFileSync(path.join(dist, "index.html"), "utf8");
const fontFile = fs.readdirSync(path.join(dist, "assets")).find((f) => /^inter-latin-wght-normal.*\.woff2$/.test(f));
const fontPreload = fontFile ? `<link rel="preload" as="font" type="font/woff2" crossorigin href="/assets/${fontFile}" />` : "";
const esc = (text) => String(text ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

// Build static semantic collection pages from established storefront products.
// Dynamic Supabase-only brands are deliberately not invented during the build.
const brandGroups = buildCatalogGroups(products);
const collectionQuestions = (name) => [
  { "@type": "Question", name: `How do I compare ${name} subscription plans?`, acceptedAnswer: { "@type": "Answer", text: "Compare the duration, price, limits and access conditions of each package. Open its product page before ordering." } },
  { "@type": "Question", name: `Are ${name} subscriptions officially endorsed by the brand?`, acceptedAnswer: { "@type": "Answer", text: 'AI Tools PAK is an independent seller. Brand names and logos identify the tools and do not imply partnership or endorsement.' } },
];
const crumbs = (items) => ({ "@type": "BreadcrumbList", itemListElement: items.map(([name, url], i) => ({ "@type": "ListItem", position: i + 1, name, item: SITE + url })) });

const articleSchema = (post) => ({
  "@type": "Article", headline: post.title, description: post.description, datePublished: post.date, dateModified: post.date,
  mainEntityOfPage: `${SITE}/blog/${post.slug}`, image: [`${SITE}/og-image.png`],
  author: { "@type": "Organization", name: brand.name },
  publisher: { "@type": "Organization", name: brand.name, logo: { "@type": "ImageObject", url: `${SITE}/icon-512.png` } },
});

const productSchema = (p) => {
  // Sale prices/availability can be changed from the admin dashboard after a build.
  // Do not freeze an Offer value into SEO JSON-LD that may disagree with live checkout.
  return { "@type": "Product", name: p.name, description: p.description,
    url: `${SITE}/product/${p.slug}` };
};

const importedSeoProducts = await approvedSeoProducts();
if (!process.env.SUPABASE_SECRET_KEY) console.warn('Dynamic product SEO skipped: build-time Supabase credentials unavailable.');
const pages = [
  { url: "/", title: `Buy AI Tools & Subscriptions in Pakistan | ${brand.name}`, description: "Explore AI tools, creative software, developer tools, productivity subscriptions and digital services at affordable prices in Pakistan.",
    schema: [{ "@type": "Organization", name: brand.name, url: SITE, email: brand.email, logo: `${SITE}/icon-512.png` }, { "@type": "WebSite", name: brand.name, url: SITE }] },
  ...allCategories.map((c) => ({ url: `/${c.slug}`, title: `${c.name} in Pakistan | ${brand.name}`, description: `${c.tools ? c.tools + ". " : ""}Affordable ${c.name.toLowerCase()} subscriptions in Pakistan with ordering support on WhatsApp.`, schema: [crumbs([["Home", "/"], [c.name, `/${c.slug}`]])] })),
  ...brandGroups.map(g => ({
    url: `/tool/${g.slug}`,
    title: `${g.brand} Plans & Prices in Pakistan | ${brand.name}`,
    description: `Compare ${g.brand} subscription packages and current prices in Pakistani rupees. Explore available plans and review provider eligibility before ordering.`,
    schema: [
      { "@type": "CollectionPage", name: `${g.brand} plans in Pakistan`, url: `${SITE}/tool/${g.slug}`,
        about: { "@type": "Brand", name: g.brand },
        mainEntity: { "@type": "ItemList", itemListElement: g.legacyProducts.map((p,i) => ({ "@type": "ListItem", position: i+1, name: p.name, url: `${SITE}/product/${p.slug}` })) } },
      { "@type": "FAQPage", mainEntity: collectionQuestions(g.brand) },
      crumbs([["Home", "/"], ["All tools", "/products"], [g.brand, `/tool/${g.slug}`]])
    ],
  })),
  // Only published, non-flagged, in-stock imported plans get crawlable pages.
  // Pending or restricted plans remain browseable in the app, not in the sitemap.
  ...importedSeoProducts.map(p=>({url:`/product/${p.slug}`,
    title:`${p.name} Subscription in Pakistan | ${brand.name}`,
    description:`${p.description || `Compare ${p.name} subscription details.`} View current terms, prices and availability before ordering.`,
    schema:[{ '@type':'Product',name:p.name,description:p.description,url:`${SITE}/product/${p.slug}`},
      crumbs([['Home','/'],['All products','/products'],[p.name,`/product/${p.slug}`]])]
  })),
  ...products.map((p) => ({ url: `/product/${p.slug}`, title: `Buy ${p.name} in Pakistan | ${brand.name}`, description: `${p.description} View current plan prices and availability before ordering online with WhatsApp support.`, schema: [productSchema(p), crumbs([["Home", "/"], [allCategories.find((c) => c.slug === p.category).name, `/${p.category}`], [p.name, `/product/${p.slug}`]])] })),
  ...products.map((p) => ({ url: `/product/${p.slug}/reviews`, title: `${p.name} Reviews | ${brand.name}`, description: `Read customer feedback and leave a star rating for ${p.name}.`, schema: [crumbs([["Home", "/"], [p.name, `/product/${p.slug}`], ["Reviews", `/product/${p.slug}/reviews`]])] })),
  { url: "/terms", title: `Terms & Conditions | ${brand.name}`, description: `Terms for ordering from ${brand.name}.` },
  { url: "/privacy-policy", title: `Privacy Policy | ${brand.name}`, description: `How ${brand.name} handles your information.` },
  { url: "/tools", title: `Browse AI Tool Collections | ${brand.name}`, description: "Browse approved AI tools and related subscription plans, grouped by brand and priced in PKR." },
  { url: "/products", title: `All AI Tools & Subscriptions in Pakistan | ${brand.name}`, description: "Browse every AI tool, software subscription and digital service we offer, with PKR prices, plans and stock status.", schema: [crumbs([["Home", "/"], ["All products", "/products"]])] },
  { url: "/compare", title: `Compare AI Tool Plans and Prices in Pakistan | ${brand.name}`, description: "Compare AI assistant, video, voice, writing, SEO, design, VPN and streaming plans side by side, with live PKR prices.", schema: [crumbs([["Home", "/"], ["Compare", "/compare"]])] },
  ...compareGroups.map((g) => ({ url: `/compare/${g.slug}`, title: `${g.title} | ${brand.name}`, description: g.description, schema: [crumbs([["Home", "/"], ["Compare", "/compare"], [g.short, `/compare/${g.slug}`]])] })),
  { url: "/blog", title: `AI Tools Guides for Pakistan | ${brand.name}`, description: "Plain-language guides to choosing, comparing and safely buying AI tools and subscriptions in Pakistan.", schema: [crumbs([["Home", "/"], ["Blog", "/blog"]])] },
  ...posts.map((post) => ({ url: `/blog/${post.slug}`, title: `${post.title} | ${brand.name}`, description: post.description, schema: [articleSchema(post), crumbs([["Home", "/"], ["Blog", "/blog"], [post.title, `/blog/${post.slug}`]])] })),
  ...Object.entries(infoPages).map(([slug, page]) => ({ url: `/${slug}`, title: `${page.title} | ${brand.name}`, description: page.description, schema: [crumbs([["Home", "/"], [page.short, `/${slug}`]])] })),
  { url: "/customer-faq", title: `Customer FAQs | ${brand.name}`, description: "Browse questions and answers that customers chose to share, under their names or anonymously." },
  { url: "/checkout", title: `Checkout | ${brand.name}`, description: "Complete your order.", noindex: true },
  { url: "/admin", title: `Admin | ${brand.name}`, description: "Admin.", noindex: true },
];

for (const page of pages) {
  const pageUrl = SITE + (page.url === "/" ? "" : page.url);
  const extra = [
    fontPreload,
    `<link rel="canonical" href="${pageUrl}" />`,
    `<meta property="og:url" content="${pageUrl}" />`,
    `<meta property="og:image" content="${SITE}/og-image.png" />`,
    `<meta property="og:locale" content="en_PK" />`,
    `<meta name="twitter:image" content="${SITE}/og-image.png" />`,
    page.noindex ? `<meta name="robots" content="noindex" />` : "",
    page.schema ? `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@graph": page.schema }).replace(/</g, "\\u003c")}</script>` : "",
  ].join("\n    ");

  const html = template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(page.title)}</title>`)
    .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${esc(page.description)}" />`)
    .replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${esc(page.title)}" />`)
    .replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${esc(page.description)}" />`)
    .replace('<meta name="twitter:card" content="summary" />', '<meta name="twitter:card" content="summary_large_image" />')
    .replace("</head>", `    ${extra}\n  </head>`);

  const file = page.url === "/" ? path.join(dist, "index.html") : path.join(dist, page.url, "index.html");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}

const today = new Date().toISOString().slice(0, 10);
const urls = pages.filter((p) => !p.noindex).map((p) => `  <url><loc>${SITE}${p.url === "/" ? "" : p.url}</loc><lastmod>${today}</lastmod></url>`);
fs.writeFileSync(path.join(dist, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`);
fs.writeFileSync(path.join(dist, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /checkout\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${SITE}/sitemap.xml\n`);
console.log(`Pre-rendered ${pages.length} pages (${importedSeoProducts.length} verified imported products) + sitemap.xml + robots.txt`);
