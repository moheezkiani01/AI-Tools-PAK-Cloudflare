import { useState } from "react";
import Logo from "./Logo";
import Icon from "./Icon";
import { useCart } from "../context/CartContext";
import { categories } from "../data/categories";
import { navigate } from "../utils/navigate";

const linkClass = "whitespace-nowrap text-sm font-medium text-slate-300 transition hover:text-[color:var(--text)]";
const resources = [
  ["Compare plans", "/compare", "Side-by-side prices and plans"],
  ["Blog & guides", "/blog", "How to choose and buy safely"],
  ["Services", "/services", "Everything we offer"],
  ["Buyer Safety", "/buyer-safety", "Checks before you pay"],
  ["About us", "/about", "Who we are"],
  ["Customer FAQs", "/customer-faq", "Community questions and answers"],
];
const iconProps = { width: 22, height: 22, fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" };

export default function Navbar({ onSelect }) {
  const { count, setIsOpen } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dark, setDark] = useState(() => typeof document !== "undefined" && document.documentElement.dataset.theme === "dark");

  const toggleTheme = () => {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch {}
    setDark(!dark);
  };
  const close = () => setMenuOpen(false);

  const focusSearch = () => {
    const catalog = document.getElementById("catalog");
    if (!catalog) navigate("/#catalog");
    else catalog.scrollIntoView({ behavior: "instant" });
    // Focus as soon as the React route is ready, rather than waiting half a second.
    const focus = (attempt = 0) => {
      const input = document.getElementById("product-search");
      if (input) input.focus({ preventScroll: true });
      else if (attempt < 18) requestAnimationFrame(() => focus(attempt + 1));
    };
    requestAnimationFrame(() => focus());
  };

  return (
    <header className="sticky top-0 z-50 border-b border-[color:var(--border)] bg-[color:var(--bg)]/95">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-5 sm:gap-6">
        <Logo />

        {/* Desktop: categories live in a dropdown so the bar never gets crowded */}
        <nav className="hidden items-center gap-8 xl:flex">
          <a href="/" className={linkClass}>Home</a>
          <div className="group relative">
            <button className={`${linkClass} flex items-center gap-1`} aria-haspopup="true">
              Categories
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m6 9 6 6 6-6" /></svg>
            </button>
            <div className="invisible absolute left-1/2 top-full w-72 -translate-x-1/2 pt-3 opacity-0 transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
              <div className="glass p-2 shadow-xl shadow-slate-900/10 dark:shadow-black/40">
                <a href="/products" onClick={(e) => e.currentTarget.blur()} className="block rounded-xl p-2.5 text-sm font-semibold hover:bg-[color:var(--hover)]">All products</a>
                {categories.map((c) => (
                  <a key={c.slug} href={`/${c.slug}`} style={{ "--c": c.color }} onClick={(e) => e.currentTarget.blur()} className="flex items-center gap-3 rounded-xl p-2.5 hover:bg-[color:var(--hover)]">
                    <span className="tile" style={{ width: 38, height: 38 }}><Icon name={c.slug} size={18} /></span>
                    <span><span className="block text-sm font-semibold">{c.name}</span><span className="block text-xs text-slate-400">{c.tools.split(", ").slice(0, 3).join(", ")}</span></span>
                  </a>
                ))}
              </div>
            </div>
          </div>
          <div className="group relative">
            <button className={`${linkClass} flex items-center gap-1`} aria-haspopup="true">
              Resources
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m6 9 6 6 6-6" /></svg>
            </button>
            <div className="invisible absolute left-1/2 top-full w-64 -translate-x-1/2 pt-3 opacity-0 transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
              <div className="glass p-2 shadow-xl shadow-slate-900/10 dark:shadow-black/40">
                {resources.map(([label, href, text]) => (
                  <a key={href} href={href} onClick={(e) => e.currentTarget.blur()} className="block rounded-xl p-2.5 hover:bg-[color:var(--hover)]">
                    <span className="block text-sm font-semibold">{label}</span>
                    <span className="block text-xs text-slate-400">{text}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
          <a href="/#how-it-works" className={linkClass}>How It Works</a>
          <a href="/#faq" className={linkClass}>FAQ</a>
          <a href="/#contact" className={linkClass}>Contact</a>
        </nav>

        <div className="flex items-center gap-1 sm:gap-2">
          <button onClick={toggleTheme} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} className="rounded-full p-2 text-slate-300 hover:bg-[color:var(--hover)] hover:text-[color:var(--text)]">
            <Icon name={dark ? "sun" : "moon"} size={22} />
          </button>
          <button onClick={focusSearch} aria-label="Search products" className="hidden rounded-full p-2 min-[360px]:block text-slate-300 hover:bg-[color:var(--hover)] hover:text-[color:var(--text)]">
            <svg viewBox="0 0 24 24" {...iconProps}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          </button>
          <button onClick={() => setIsOpen(true)} aria-label="Cart" className="relative rounded-full p-2 text-slate-300 hover:bg-[color:var(--hover)] hover:text-[color:var(--text)]">
            <svg viewBox="0 0 24 24" {...iconProps}><path d="M3 4h2l2.5 11h10L20 7H6" /><circle cx="9" cy="19.5" r="1" /><circle cx="17" cy="19.5" r="1" /></svg>
            {count > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-5 w-5 place-items-center rounded-full bg-[#3b82f6] text-[11px] font-bold text-white">{count}</span>}
          </button>
          <button onClick={() => onSelect("all")} className="btn-primary hidden whitespace-nowrap !py-2 sm:inline-block">Get Started</button>
          <button onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu" aria-expanded={menuOpen} className="rounded-full p-2 hover:bg-[color:var(--hover)] xl:hidden">
            <svg viewBox="0 0 24 24" {...iconProps}>{menuOpen ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}</svg>
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav aria-label="Mobile menu" className="max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain border-t border-[color:var(--border)] px-5 py-4 xl:hidden" onClick={(event) => { if (event.target.closest('a')) close(); }}>
          <div className="flex flex-col gap-3">
            <a href="/" className={linkClass}>Home</a>
            <a href="/products" className={linkClass}>All products</a>
            <details className="rounded-xl border border-[color:var(--border)] p-3">
              <summary className="cursor-pointer font-semibold">Browse categories</summary>
              <div className="mt-3 grid gap-3 pl-2">{categories.map((c) => <a key={c.slug} href={`/${c.slug}`} className={linkClass}>{c.name}</a>)}</div>
            </details>
            <details className="rounded-xl border border-[color:var(--border)] p-3">
              <summary className="cursor-pointer font-semibold">Help, guides &amp; resources</summary>
              <div className="mt-3 grid gap-3 pl-2">{resources.map(([label, href]) => <a key={href} href={href} className={linkClass}>{label}</a>)}</div>
            </details>
            <div className="flex flex-wrap gap-4 py-2">
              <a href="/#how-it-works" className={linkClass}>How It Works</a>
              <a href="/#faq" className={linkClass}>FAQ</a>
              <a href="/#contact" className={linkClass}>Contact</a>
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
