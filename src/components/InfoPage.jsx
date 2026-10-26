import { infoPages } from "../data/infoPages";
import { categories } from "../data/categories";
import { useProducts } from "../context/ProductContext";
import { formatPrice } from "../utils/formatPrice";
import Icon from "./Icon";
import Breadcrumbs from "./Breadcrumbs";
import { usePageTitle } from "../utils/usePageTitle";
import { useDiscounts } from "../context/DiscountContext";

// About, Buyer Safety and Services pages (text lives in src/data/infoPages.js)
export default function InfoPage({ slug }) {
  const products = useProducts();
  const page = infoPages[slug];
  const { priceFor } = useDiscounts();
  usePageTitle(page.title);

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <Breadcrumbs items={[["Home", "/"], [page.short, `/${slug}`]]} />
      <h1 className="mt-4 text-3xl font-extrabold leading-tight sm:text-5xl">{page.title}</h1>
      <p className="mt-4 text-lg text-slate-300">{page.intro}</p>

      {slug === "services" && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {categories.map((c) => {
            const items = products.filter((p) => p.category === c.slug);
            return (
              <a key={c.slug} href={`/${c.slug}`} style={{ "--c": c.color }} className="glass card-hover card-wash flex items-center gap-4 p-5">
                <span className="tile"><Icon name={c.slug} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{c.title}</span>
                  <span className="block text-xs text-slate-400">{items.length} plans{items.length ? `, from ${formatPrice(Math.min(...items.map((p) => priceFor(p).price)))}` : ""}</span>
                </span>
              </a>
            );
          })}
        </div>
      )}

      {page.sections.map((s) => (
        <div key={s.h} className="mt-8">
          <h2 className="text-2xl font-bold">{s.h}</h2>
          {s.p?.map((t) => <p key={t} className="mt-3 text-slate-300">{t}</p>)}
          {s.list && <ul className="mt-3 list-disc space-y-1.5 pl-5 text-slate-300">{s.list.map((t) => <li key={t}>{t}</li>)}</ul>}
        </div>
      ))}

      <div className="glass mt-8 p-6">
        <h2 className="text-lg font-bold">Related pages</h2>
        <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-[color:var(--accent)]">
          <li><a href="/buyer-safety" className="hover:underline">Buyer Safety</a></li>
          <li><a href="/compare" className="hover:underline">Compare plans</a></li>
          <li><a href="/blog" className="hover:underline">Guides</a></li>
          <li><a href="/#faq" className="hover:underline">FAQ</a></li>
        </ul>
      </div>
    </div>
  );
}
