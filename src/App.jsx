import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { CartProvider } from "./context/CartContext";
import { StockProvider } from "./context/StockContext";
import { DiscountProvider } from "./context/DiscountContext";
import { ProductProvider } from "./context/ProductContext";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import CategoryCard from "./components/CategoryCard";
import ProductGrid from "./components/ProductGrid";
import HowItWorks from "./components/HowItWorks";
import OrdersChart from "./components/OrdersChart";
import WhyChoose from "./components/WhyChoose";
import FAQ from "./components/FAQ";
import Contact from "./components/Contact";
import Footer from "./components/Footer";
import AnnouncementBar from "./components/AnnouncementBar";
import { infoPages } from "./data/infoPages";
import QuestionNotifier from "./components/QuestionNotifier";
import LogoStrip from "./components/LogoStrip";
import QuickToolSearch from "./components/QuickToolSearch";
import ToolFinder from "./components/ToolFinder";
import CtaBand from "./components/CtaBand";
import Icon from "./components/Icon";
import Cart from "./components/Cart";
import { categories, allCategories } from "./data/categories";
import { navigate } from "./utils/navigate";
import { whatsappLink } from "./utils/whatsapp";
import { useProducts } from "./context/ProductContext";
import { useDiscounts } from "./context/DiscountContext";
import { useStock } from "./context/StockContext";
import { buildCatalogGroups } from "./utils/catalogGroups";
import { readCachedCatalogGroups, writeCachedCatalogGroups, clearCachedCatalogGroups } from "./utils/catalogGroupCache";
import { prefetchCatalogRoute } from "./utils/catalogVariantCache";

// Pages other than the home page load only when they are opened, so the first visit stays small and fast
const ImportedGroupDetails = lazy(() => import("./components/ImportedGroupDetails"));
const ProductDetails = lazy(() => import("./components/ProductDetails"));
const ReviewPage = lazy(() => import("./components/ReviewPage"));
const CustomerFAQ = lazy(() => import("./components/CustomerFAQ"));
const Checkout = lazy(() => import("./components/Checkout"));
const CategoryPage = lazy(() => import("./components/CategoryPage"));
const LegalPage = lazy(() => import("./components/LegalPage"));
const AdminPage = lazy(() => import("./components/AdminPage"));
const BlogPage = lazy(() => import("./components/BlogPage"));
const ComparePage = lazy(() => import("./components/ComparePage"));
const InfoPage = lazy(() => import("./components/InfoPage"));

// "/product/gemini-pro" -> ["product", "gemini-pro"], home -> []
const readRoute = () => location.pathname.split("/").filter(Boolean);
const infoSlugs = Object.keys(infoPages);
const isCatalogRoute = (r) => r[0] === "products" || allCategories.some((c) => c.slug === r[0]);
const legalPages = ["terms", "privacy-policy"];

function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-5 py-12 text-center">
      <h1 className="text-4xl font-extrabold">Page not found</h1>
      <a href="/" className="btn-primary mt-6">Back to home</a>
    </div>
  );
}

function Shop() {
  const [route, setRoute] = useState(readRoute);
  const [category, setCategory] = useState("all");
  const [{ groups: importedGroups, ready: catalogReady, error: catalogError }, setCatalogSummary] = useState(() => {
    const cached = readCachedCatalogGroups(typeof sessionStorage === 'undefined' ? null : sessionStorage);
    return { groups: cached ?? [], ready: cached !== null, error: false };
  });
  const [ratings, setRatings] = useState({});
  const catalogProducts = useProducts();
  const { priceFor, hasDiscount } = useDiscounts();
  const { isOut } = useStock();
  const catalogGroups = useMemo(() => catalogReady
    ? buildCatalogGroups(catalogProducts, importedGroups, { priceFor, hasDiscount, isOut })
    : [], [catalogReady, catalogProducts, importedGroups, priceFor, hasDiscount, isOut]);
  const previousRoute = useRef(route);

  // One lightweight catalogue-summary request supports category cards and existing product grids.
  // No supplier data, full plan descriptions or costs are downloaded on the homepage.
  useEffect(() => {
    let alive = true;
    let requestId = 0;
    const refresh = async (bypassEdge = false) => {
      const current = ++requestId;
      try {
        // Only an explicit admin edit bypasses the short CDN cache.
        // Regular traffic stays on the shared, cacheable URL.
        const path = '/api/catalog/groups?limit=200' + (bypassEdge ? `&_updated=${Date.now()}` : '');
        const response = await fetch(path);
        if (!response.ok) throw Error('Catalogue unavailable');
        const data = await response.json();
        if (!Array.isArray(data.groups)) throw Error('Invalid catalogue response');
        if (!alive || current !== requestId) return;
        writeCachedCatalogGroups(typeof sessionStorage === 'undefined' ? null : sessionStorage, data.groups);
        setCatalogSummary(previous => ({
          groups: JSON.stringify(previous.groups) === JSON.stringify(data.groups) ? previous.groups : data.groups,
          ready: true,
          error: false,
        }));
      } catch {
        // Never advertise fixed original prices as CURRENT catalogue prices
        // if the Supabase summary cannot be verified.
        if (alive && current === requestId) setCatalogSummary(previous => ({ ...previous, ready: false, error: true }));
      }
    };
    const onUpdated = () => {
      clearCachedCatalogGroups(typeof sessionStorage === 'undefined' ? null : sessionStorage);
      refresh(true);
    };
    // A CLI import or Supabase edit happens outside this tab and cannot emit
    // our normal catalog-updated event. Refresh when the visitor returns.
    let checkedAt = Date.now();
    const onFocus = () => {
      if (Date.now() - checkedAt < 60_000) return;
      checkedAt = Date.now();
      // A returning visitor revalidates the shared summary via the CDN.
      refresh();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') onFocus();
    };
    refresh();
    window.addEventListener('catalog-updated', onUpdated);
    window.addEventListener('pricing-updated', onUpdated);
    window.addEventListener('discounts-updated', onUpdated);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      alive = false; requestId++;
      window.removeEventListener('catalog-updated', onUpdated);
      window.removeEventListener('pricing-updated', onUpdated);
      window.removeEventListener('discounts-updated', onUpdated);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    const refresh = () => fetch("/api/ratings").then((r) => r.json()).then(setRatings).catch(() => {});
    refresh();
    window.addEventListener("reviews-updated", refresh);
    return () => window.removeEventListener("reviews-updated", refresh);
  }, []);

  useEffect(() => {
    const onRouteChange = () => setRoute((prev) => {
      const next = readRoute();
      return prev.length === next.length && prev.every((part, i) => part === next[i]) ? prev : next;
    });
    // Links that start with "/" switch pages without reloading
    const onClick = (e) => {
      const link = e.target.closest("a[href]");
      const href = link?.getAttribute("href");
      if (!href?.startsWith("/") || href.startsWith("//") || link.target === "_blank" || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      navigate(href);
    };
    window.addEventListener("popstate", onRouteChange);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("popstate", onRouteChange);
      document.removeEventListener("click", onClick);
    };
  }, []);

  // Start loading a brand's plans before the user clicks it. This is shared
  // across search, category cards, featured tools, All Products and API pages.
  useEffect(() => {
    let pending = null;
    let lastHoveredHref = null;
    const start = (event) => {
      const link = event.target?.closest?.('a[href]');
      const href = link?.getAttribute('href');
      if (!href || !/^\/(?:tool|product|products)(?:\/|$|\?)/.test(href)) return;
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      const constrained = connection?.saveData || /(?:slow-2g|2g)/.test(connection?.effectiveType || '');
      // Do not use the visitor's bandwidth for speculative large downloads on
      // slow connections. The actual clicked page still loads normally.
      if (event.type === 'pointerover' && (constrained || lastHoveredHref === href)) return;
      if (event.type === 'pointerover') lastHoveredHref = href;
      if (pending) clearTimeout(pending);
      pending = setTimeout(() => {
        pending = null;
        prefetchCatalogRoute(href);
        if (href.startsWith('/tool/')) import('./components/ImportedGroupDetails');
        else if (href.startsWith('/product/')) import('./components/ProductDetails');
        else import('./components/CategoryPage');
      }, event.type === 'pointerover' ? 65 : 0);
    };
    document.addEventListener('pointerover', start, { passive: true });
    document.addEventListener('focusin', start);
    document.addEventListener('pointerdown', start, { passive: true });
    return () => {
      if (pending) clearTimeout(pending);
      document.removeEventListener('pointerover', start);
      document.removeEventListener('focusin', start);
      document.removeEventListener('pointerdown', start);
    };
  }, []);

  // New page -> top. Link with #section (like /#faq) -> scroll to that section.
  useEffect(() => {
    const id = location.hash.slice(1);
    // Moving between categories keeps your place on the screen. Any other new page starts at the top.
    const staysInPlace = isCatalogRoute(previousRoute.current) && isCatalogRoute(route);
    previousRoute.current = route;
    if (!id) { if (!staysInPlace) window.scrollTo({ top: 0, behavior: "instant" }); return; }
    const go = () => document.getElementById(id)?.scrollIntoView({ behavior: "instant" });
    const first = setTimeout(go, 80);
    // if images or lazy parts moved things, line the section up again
    const check = setTimeout(() => { const el = document.getElementById(id); if (el && Math.abs(el.getBoundingClientRect().top - 80) > 40) go(); }, 500);
    return () => { clearTimeout(first); clearTimeout(check); };
  }, [route]);

  // Keep SPA navigation canonical and social preview URLs in sync without page reloads.
  // This uses the actual browser origin, not a hard-coded domain.
  useEffect(() => {
    const canonicalURL = `${window.location.origin}${window.location.pathname}`;
    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.appendChild(canonical); }
    canonical.href = canonicalURL;
    let ogURL = document.head.querySelector('meta[property="og:url"]');
    if (!ogURL) { ogURL = document.createElement('meta'); ogURL.setAttribute('property','og:url'); document.head.appendChild(ogURL); }
    ogURL.setAttribute('content', canonicalURL);
  }, [route]);

  // Once the home page is up, quietly fetch the other pages so opening them feels instant
  useEffect(() => {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection?.saveData || /(?:slow-2g|2g)/.test(connection?.effectiveType || '')) return;
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1500));
    const handle = idle(() => {
      // Quietly preload code, never full subscription data, on fast networks.
      import("./components/ProductDetails"); import("./components/ImportedGroupDetails"); import("./components/CategoryPage"); import("./components/Checkout");
    });
    return () => (window.cancelIdleCallback || clearTimeout)(handle);
  }, []);

  const showCategory = (slug) => navigate(slug === "all" ? "/products" : `/${slug}`);

  const first = route[0];
  let page;
  if (first === "product" && route[2] === "reviews") page = <ReviewPage key={route[1]} slug={route[1]} />;
  else if (first === "product") page = <ProductDetails key={route[1]} slug={route[1]} />;
  else if (first === "tool" && route[1]) page = <ImportedGroupDetails slug={route[1]} group={catalogGroups.find(g => g.slug === route[1])} catalogReady={catalogReady} />;
  else if (first === "tools") page = <CategoryPage slug="all" ratings={ratings} importedGroups={importedGroups} catalogGroups={catalogGroups} catalogReady={catalogReady} catalogError={catalogError} />;
  else if (first === "checkout") page = <Checkout />;
  else if (first === "admin") page = <AdminPage />;
  else if (first === "customer-faq") page = <CustomerFAQ />;
  else if (first === "compare") page = <ComparePage key={route[1]} slug={route[1]} catalogGroups={catalogGroups} catalogReady={catalogReady} />;
  else if (first === "blog") page = <BlogPage key={route[1]} slug={route[1]} />;
  else if (infoSlugs.includes(first)) page = <InfoPage slug={first} />;
  else if (legalPages.includes(first)) page = <LegalPage slug={first} />;
  else if (isCatalogRoute(route)) page = <CategoryPage slug={first === "products" ? "all" : first} ratings={ratings} importedGroups={importedGroups} catalogGroups={catalogGroups} catalogReady={catalogReady} catalogError={catalogError} />;
  else if (first) page = <NotFound />;
  else
    page = (
      <>
        <Hero onSelect={showCategory} catalogGroups={catalogGroups} catalogReady={catalogReady} catalogError={catalogError} />
        <LogoStrip catalogGroups={catalogGroups} />
        <QuickToolSearch catalogGroups={catalogGroups} />
        <section id="categories" className="mx-auto max-w-7xl px-5 pt-7 pb-3 sm:pt-8 sm:pb-4">
          <p className="eyebrow">Categories</p>
<h2 className="section-title">Explore Our Tools</h2>
          <div className="mt-5 grid items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {categories.map((c) => <CategoryCard key={c.slug} category={c} catalogGroups={catalogGroups} />)}
          </div>
        </section>
        <ToolFinder catalogGroups={catalogGroups} />
        <ProductGrid category={category} setCategory={setCategory} importedGroups={importedGroups} catalogGroups={catalogGroups} catalogReady={catalogReady} catalogError={catalogError} />
        <HowItWorks />
        <OrdersChart />
        <WhyChoose />
        <FAQ />
        <Contact />
      </>
    );

  return (
    <>
      <AnnouncementBar />
      <Navbar onSelect={showCategory} />
      <main><Suspense fallback={<div className="grid min-h-[45vh] place-items-center" role="status" aria-live="polite"><span className="text-sm text-slate-400">Opening page…</span></div>}>{page}</Suspense></main>
      {first !== "checkout" && first !== "admin" && <CtaBand />}
      <Footer />
      <Cart />
      <QuestionNotifier />
      <a href={whatsappLink("Hello, I have a question about your products.")} target="_blank" rel="noreferrer" aria-label="Order on WhatsApp" title="Order on WhatsApp" className={`wa-fab ${first === "product" ? "max-lg:hidden" : first === "checkout" || first === "admin" ? "hidden" : ""}`}>
        <span className="wa-fab-handle"><Icon name="chat" size={21} /></span>
        <span className="wa-fab-label" aria-hidden="true">Order on WhatsApp</span>
      </a>
    </>
  );
}

export default function App() {
  return <ProductProvider><DiscountProvider><CartProvider><StockProvider><Shop /></StockProvider></CartProvider></DiscountProvider></ProductProvider>;
}
