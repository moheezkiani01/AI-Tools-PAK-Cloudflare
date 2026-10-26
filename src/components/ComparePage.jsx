import { compareGroups } from "../data/compare";
import { posts } from "../data/blog";
import { useProducts } from "../context/ProductContext";
import { useStock } from "../context/StockContext";
import SalePrice from "./SalePrice";
import { useDiscounts } from "../context/DiscountContext";
import BrandIcon from "./BrandIcon";
import Breadcrumbs from "./Breadcrumbs";
import { usePageTitle } from "../utils/usePageTitle";
import { brandIdentity } from "../utils/catalogGroups";
import { formatPrice } from "../utils/formatPrice";

function Index() {
  usePageTitle("Compare AI Tool Plans and Prices in Pakistan");
  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <Breadcrumbs items={[["Home", "/"], ["Compare", "/compare"]]} />
      <h1 className="mt-4 text-4xl font-extrabold sm:text-5xl">Compare AI Tool Plans in Pakistan</h1>
      <p className="mt-3 max-w-2xl text-lg text-slate-300">Compare our original plans and discover the latest imported subscription options for each brand.</p>
      <div className="mt-7 grid gap-5 sm:grid-cols-2">
        {compareGroups.map((g) => (
          <a key={g.slug} href={`/compare/${g.slug}`} className="glass card-hover card-wash flex flex-col p-6">
            <h2 className="text-xl font-bold leading-snug">{g.title}</h2>
            <p className="mt-2 flex-1 text-sm text-slate-300">{g.description}</p>
            <span className="mt-4 text-sm font-semibold text-[color:var(--accent)]">Compare {g.products.length} original listings →</span>
          </a>
        ))}
      </div>
    </div>
  );
}

function Group({ group, catalogGroups = [], catalogReady = true }) {
  const products = useProducts();
  usePageTitle(group.title);
  const { isOut } = useStock();
  const { priceFor } = useDiscounts();
  const rows = group.products.map((s) => products.find((p) => p.slug === s)).filter(Boolean);
  const currentImported = (product) => {
    const slug = brandIdentity(product).slug;
    return catalogGroups.find(g => g.slug === slug && g.importedGroup);
  };
  const guides = posts.filter((p) => (p.compare || []).includes(group.slug));
  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <Breadcrumbs items={[["Home", "/"], ["Compare", "/compare"], [group.short, `/compare/${group.slug}`]]} />
      <h1 className="mt-4 text-3xl font-extrabold leading-tight sm:text-5xl">{group.title}</h1>
      <p className="mt-4 max-w-3xl text-lg text-slate-300">{group.intro}</p>
      <p className="mt-3 text-sm text-slate-400">The comparison table lists original products. Newer imported plans may have different durations, features and prices; check each brand's full collection before ordering.</p>

      <div className="glass mt-8 overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <caption className="sr-only">{group.title}</caption>
          <thead>
            <tr className="border-b border-[color:var(--border)] text-xs uppercase tracking-wide text-slate-400">
              <th scope="col" className="p-4">Product</th><th scope="col" className="p-4">Plan</th><th scope="col" className="p-4">Includes</th><th scope="col" className="p-4">Best for</th><th scope="col" className="p-4 text-right">Price</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.slug} className="border-b border-[color:var(--border)] last:border-0">
                <th scope="row" className="p-4 font-semibold">
                  <a href={`/product/${p.slug}`} className="flex items-center gap-3 hover:underline"><BrandIcon name={p.slug} category={p.category} size={36} /><span>{p.name}<span className="mt-0.5 block text-xs font-bold text-slate-300 md:hidden"><SalePrice from={!!p.options} {...priceFor(p)} /></span></span></a>
                </th>
                <td className="whitespace-nowrap p-4 text-slate-300">{p.options ? p.options.map((o) => o.label).join(" / ") : p.duration || "—"}</td>
                <td className="p-4 text-slate-300">{p.limit || p.type || "—"}</td>
                <td className="p-4 text-slate-300">{group.bestFor[p.slug]}</td>
                <td className="whitespace-nowrap p-4 text-right font-bold">
                  <SalePrice from={!!p.options} {...priceFor(p)} />
                  {catalogReady && currentImported(p) && <a className="mt-1 block text-xs font-medium text-[color:var(--accent)] underline" href={`/tool/${encodeURIComponent(currentImported(p).slug)}`}>Other current plans {currentImported(p).priceIsEnquiryOnly ? "listed from" : "from"} {formatPrice(currentImported(p).minPrice)}</a>}
                  {isOut(p.slug) && <span className="mt-1 block text-xs font-semibold text-amber-700 dark:text-amber-400">Out of stock</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-400">Original listing prices reflect the current original-product settings. Imported subscriptions are priced separately in each brand collection. Features and limits can change.</p>

      <h2 className="mt-10 text-2xl font-bold">How to choose</h2>
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-slate-300">{group.tips.map((t) => <li key={t}>{t}</li>)}</ul>

      {guides.length > 0 && (
        <div className="glass mt-10 p-6">
          <h2 className="text-lg font-bold">Related guides</h2>
          <ul className="mt-3 space-y-2 text-sm">{guides.map((g) => <li key={g.slug}><a href={`/blog/${g.slug}`} className="font-semibold text-[color:var(--accent)] hover:underline">{g.title} →</a></li>)}</ul>
        </div>
      )}
    </div>
  );
}

export default function ComparePage({ slug, catalogGroups = [], catalogReady = true }) {
  if (!slug) return <Index />;
  const group = compareGroups.find((g) => g.slug === slug);
  if (!group) return <p className="mx-auto max-w-xl px-5 py-12 text-center text-slate-300">Comparison not found. <a href="/compare" className="text-[color:var(--accent)] underline">See all comparisons</a></p>;
  return <Group group={group} catalogGroups={catalogGroups} catalogReady={catalogReady} />;
}
