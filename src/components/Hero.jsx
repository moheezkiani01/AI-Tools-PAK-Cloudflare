import Icon from "./Icon";
import BrandIcon from "./BrandIcon";
import { allCategories } from "../data/categories";
import { formatPrice } from "../utils/formatPrice";

const colorOf = (slug) => allCategories.find((c) => c.slug === slug)?.color;

export default function Hero({ onSelect, catalogGroups = [], catalogReady = true, catalogError = false }) {
  // Curated familiar tools, not unverified sales statistics.
  const popular = catalogGroups.slice(0, 4);
  const lowestPrice = Math.min(...catalogGroups.filter(g => !g.priceIsEnquiryOnly).map(g => g.minPrice).filter(Number.isFinite));
  // Keep the marketplace benefits beside the primary calls to action.
  // Short visible labels are paired with descriptive hover titles.
  const benefits = [
    { icon: "ai-tools", label: "AI Tools", description: "Explore AI subscriptions and services" },
    { icon: "box", label: "Premium Software", description: "Browse premium software plans" },
    { icon: "productivity", label: "Productivity", description: "Tools for productive work" },
    { icon: "bolt", label: "Digital Services", description: "Digital services in one marketplace" },
    ...(catalogReady && Number.isFinite(lowestPrice)
      ? [{ icon: "price", label: `From ${formatPrice(lowestPrice)}`, description: `Subscription plans starting from ${formatPrice(lowestPrice)}`, type: "price" }]
      : []),
    { icon: "truck", label: "Fast Delivery", description: "Fast delivery for eligible digital orders", type: "delivery" },
    { icon: "shopping-bag", label: "Easy Ordering", description: "Digital tools made easy to order" },
    { icon: "download", label: "Digital Delivery", description: "Digital products delivered electronically" },
  ];
  return (
    <section id="home" className="relative overflow-hidden">
      <div className="hero-glow depth-1" aria-hidden="true" />
      <div className="grid-bg depth-2" aria-hidden="true" />
      <div className="relative mx-auto grid max-w-7xl items-start gap-8 px-5 py-8 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:py-12">
        <div className="hero-intro">
          <h1 className="gradient-text mt-0 text-4xl font-extrabold leading-[1.05] sm:text-5xl lg:text-6xl">Premium AI Tools. One Powerful Marketplace.</h1>
          <p className="mt-4 max-w-xl text-lg text-slate-300">Get access to powerful AI, creative, developer, productivity and digital tools at affordable prices.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={() => onSelect("ai-tools")} className="btn-primary w-full px-7 py-3.5 sm:w-auto">Explore AI Tools</button>
            <button onClick={() => onSelect("all")} className="btn-ghost w-full px-7 py-3.5 sm:w-auto">View All Products</button>
          </div>
          <ul className="hero-benefit-tags" aria-label="Why choose AI Tools PAK">
            {benefits.map(({ icon, label, description, type }) => (
              <li key={label} className={`hero-benefit-tag${type ? ` hero-benefit-tag--${type}` : ""}`} title={description}>
                <Icon name={icon} size={15} />
                <span>{label}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative min-w-0">
          <div className="glass glow-border featured-tools-panel p-5 shadow-xl shadow-blue-900/10 dark:shadow-blue-900/30">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="featured-heading">
                <span className="featured-heading-icon"><Icon name="star" size={19} /></span>
                <span><span className="featured-heading-title">Featured tools</span><span className="featured-heading-note">Explore plans from well-known brands</span></span>
              </div>
              <a href="/#catalog" className="featured-view-all">View all <span aria-hidden="true">→</span></a>
            </div>
            {catalogError && <p role="alert" className="mb-3 text-sm text-amber-500">Current plan prices could not be loaded. <button type="button" className="underline" onClick={() => window.dispatchEvent(new Event('catalog-updated'))}>Retry</button></p>}
            <ul className="space-y-3" aria-busy={!catalogReady && !catalogError} aria-label="Featured tool collections">
              {!catalogReady && !catalogError && Array.from({ length: 4 }, (_, index) => (
                <li key={`loading-${index}`} className="flex items-center gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-2)] p-3" aria-hidden="true">
                  <span className="h-11 w-11 shrink-0 rounded-lg bg-[color:var(--border)]" />
                  <span className="flex-1 space-y-2"><span className="block h-3 w-24 rounded bg-[color:var(--border)]" /><span className="block h-2.5 w-36 max-w-full rounded bg-[color:var(--border)]" /></span>
                  <span className="h-3 w-20 rounded bg-[color:var(--border)]" />
                </li>
              ))}
              {catalogReady && popular.map((p) => (
                <li key={p.slug}>
                  <a href={`/tool/${p.slug}`} style={{ "--c": colorOf(p.category) }} className="card-hover flex flex-wrap items-center gap-3 min-[420px]:flex-nowrap rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-2)] p-3">
                    <BrandIcon name={p.legacyProducts[0]?.slug || p.slug} brandName={p.brand} category={p.category} size={44} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{p.brand}</span>
                      <span className="block truncate text-xs text-slate-400">{p.count} plan{p.count===1?"":"s"} · Compare options</span>
                    </span>
                    <span className="min-w-0 max-w-full text-right text-sm font-bold break-words sm:text-base">{p.priceIsEnquiryOnly ? "Listed" : "From"} {formatPrice(p.minPrice)}</span>
                  </a>
                </li>
              ))}
            </ul>
            {!catalogReady && !catalogError && <span className="sr-only" role="status">Loading current subscription prices and plan counts…</span>}
          </div>
        </div>
      </div>
    </section>
  );
}
