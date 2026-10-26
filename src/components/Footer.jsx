import Logo from "./Logo";
import { categories } from "../data/categories";
import { brand } from "../config";

const resources = [["Compare plans", "/compare"], ["Blog & guides", "/blog"], ["Services", "/services"], ["Buyer Safety", "/buyer-safety"], ["About us", "/about"]];
const company = [["Contact", "/#contact"], ["FAQ", "/#faq"], ["Customer FAQs", "/customer-faq"], ["Terms", "/terms"], ["Privacy Policy", "/privacy-policy"]];

export default function Footer() {
  const linkClass = "text-sm text-slate-400 hover:text-[color:var(--text)]";
  return (
    <footer className="mt-10 border-t border-[color:var(--border)] bg-[color:var(--surface)]">
      <div className="mx-auto grid max-w-7xl gap-7 px-5 py-10 md:grid-cols-4">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm text-slate-400">Premium AI &amp; Digital Tools for creators, students, developers and businesses.</p>
        </div>
        <ul className="grid gap-3">
          <li><a href="/products" className={linkClass}>All products</a></li>
          {categories.map((c) => (
            <li key={c.slug}>
              <a href={`/${c.slug}`} className={linkClass}>{c.name}</a>
            </li>
          ))}
        </ul>
        <ul className="grid content-start gap-3">
          {resources.map(([label, href]) => <li key={label}><a href={href} className={linkClass}>{label}</a></li>)}
        </ul>
        <ul className="grid gap-3">
          {company.map(([label, href]) => <li key={label}><a href={href} className={linkClass}>{label}</a></li>)}
        </ul>
      </div>
      <div className="border-t border-[color:var(--border)] px-5 py-4 text-center text-xs text-slate-500">
        <p>© 2026 {brand.name}. All rights reserved.</p>
        <p className="mx-auto mt-2 max-w-2xl">
          {brand.name} is an independent business and is not affiliated with, endorsed by, or an official partner of any brand named on this site. All product names and trademarks belong to their respective owners.
        </p>
      </div>
    </footer>
  );
}
