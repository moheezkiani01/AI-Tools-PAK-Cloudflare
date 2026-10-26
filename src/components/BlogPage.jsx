import { posts } from "../data/blog";
import { compareGroups } from "../data/compare";
import { useProducts } from "../context/ProductContext";
import { brand } from "../config";
import ProductMini from "./ProductMini";
import Breadcrumbs from "./Breadcrumbs";
import { usePageTitle } from "../utils/usePageTitle";

const dateText = (iso) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

function Index() {
  usePageTitle("AI Tools Guides for Pakistan");
  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <Breadcrumbs items={[["Home", "/"], ["Blog", "/blog"]]} />
      <h1 className="mt-4 text-4xl font-extrabold sm:text-5xl">AI Tools Guides for Pakistan</h1>
      <p className="mt-3 max-w-2xl text-lg text-slate-300">Plain-language guides to choosing, comparing and safely buying AI tools and subscriptions.</p>
      <div className="mt-7 grid gap-5 sm:grid-cols-2">
        {posts.map((post) => (
          <a key={post.slug} href={`/blog/${post.slug}`} className="glass card-hover card-wash flex flex-col p-6">
            <span className="text-xs text-slate-400">{dateText(post.date)}</span>
            <h2 className="mt-2 text-xl font-bold leading-snug">{post.title}</h2>
            <p className="mt-2 flex-1 text-sm text-slate-300">{post.description}</p>
            <span className="mt-4 text-sm font-semibold text-[color:var(--accent)]">Read guide →</span>
          </a>
        ))}
      </div>
    </div>
  );
}

function Post({ post }) {
  const products = useProducts();
  usePageTitle(post.title);
  const related = post.products.map((s) => products.find((p) => p.slug === s)).filter(Boolean);
  const groups = (post.compare || []).map((s) => compareGroups.find((g) => g.slug === s)).filter(Boolean);
  const reads = (post.reads || []).map((s) => posts.find((p) => p.slug === s)).filter(Boolean);
  const links = [...groups.map((g) => [`Compare: ${g.short}`, `/compare/${g.slug}`]), ...(post.links || []), ...reads.map((r) => [r.title, `/blog/${r.slug}`])];

  return (
    <article className="mx-auto max-w-3xl px-5 py-10">
      <Breadcrumbs items={[["Home", "/"], ["Blog", "/blog"], [post.title, `/blog/${post.slug}`]]} />
      <h1 className="mt-4 text-3xl font-extrabold leading-tight sm:text-5xl">{post.title}</h1>
      <p className="mt-3 text-sm text-slate-400">By {brand.name} · {dateText(post.date)}</p>
      <p className="mt-6 text-lg text-slate-300">{post.intro}</p>
      {post.sections.map((s) => (
        <div key={s.h} className="mt-8">
          <h2 className="text-2xl font-bold">{s.h}</h2>
          {s.p?.map((t) => <p key={t} className="mt-3 text-slate-300">{t}</p>)}
          {s.list && <ul className="mt-3 list-disc space-y-1.5 pl-5 text-slate-300">{s.list.map((t) => <li key={t}>{t}</li>)}</ul>}
        </div>
      ))}
      <div className="mt-12">
        <h2 className="text-2xl font-bold">Plans mentioned in this guide</h2>
        <p className="mt-1 text-sm text-slate-400">Prices and stock are live from our catalog.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">{related.map((p) => <ProductMini key={p.slug} product={p} />)}</div>
      </div>
      <div className="glass mt-10 p-6">
        <h2 className="text-lg font-bold">Keep reading</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {links.map(([label, href]) => <li key={href}><a href={href} className="font-semibold text-[color:var(--accent)] hover:underline">{label} →</a></li>)}
        </ul>
      </div>
    </article>
  );
}

export default function BlogPage({ slug }) {
  if (!slug) return <Index />;
  const post = posts.find((p) => p.slug === slug);
  if (!post) return <p className="mx-auto max-w-xl px-5 py-12 text-center text-slate-300">Guide not found. <a href="/blog" className="text-[color:var(--accent)] underline">See all guides</a></p>;
  return <Post post={post} />;
}
