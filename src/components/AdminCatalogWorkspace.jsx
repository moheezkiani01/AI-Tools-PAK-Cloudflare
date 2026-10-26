import { useEffect, useMemo, useRef, useState } from "react";
import { useAllProducts, useDeletedOriginalProducts } from "../context/ProductContext";
import { allCategories } from "../data/categories";
import { formatPrice } from "../utils/formatPrice";
import BrandIcon from "./BrandIcon";
import AdminPrices from "./AdminPrices";
import AdminDiscounts from "./AdminDiscounts";
import { unifiedPage, unifiedPageCount } from "../utils/adminPagination";

const headers = (password) => ({ "Content-Type": "application/json", "x-admin-csrf": password });
const types = [{ value: "all", label: "All products" }, { value: "original", label: "Original catalogue" }, { value: "imported", label: "Imported plans" }];
const statuses = ["all", "deleted", "pending", "published", "hidden", "rejected"];
const PAGE_SIZE = 36;
const searchFields = [
  { value: "all", label: "Name, brand, plan or ID" },
  { value: "name", label: "Product name" },
  { value: "brand", label: "Brand" },
  { value: "variant", label: "Plan / variant" },
  { value: "slug", label: "Product ID" },
];
const pageSizes = [12, 24, 36, 60];

// The same search semantics are used for original catalogue entries and API rows.
const originalMatches = (product, term, field) => {
  if (!term) return true;
  const values = {
    name: product.name || "",
    brand: product.brand || product.name || "",
    variant: `${product.duration || ""} ${(product.options || []).map(option => option.label).join(" ")}`,
    slug: product.slug || "",
  };
  return (field === "all" ? Object.values(values) : [values[field] || ""])
    .some(value => String(value).toLowerCase().includes(term));
};

const productLabel = (row) => row.brand ? `${row.brand} · ${row.name}` : row.name;
const manualPrice = (row) => row.manual_price_pkr == null ? "" : String(row.manual_price_pkr);
const visibleState = (row) => String(row.status || "").startsWith("deleted-") ? `Deleted (was ${String(row.status).slice(8)})` : row.review_flags?.length && row.status === "pending" ? "Needs verification" : row.status === "pending" ? "Auto-listed" : row.status;

/** Both original and imported products belong to this one workspace. */
export default function AdminCatalogWorkspace({ password, mode = "catalog", onEdit, onNavigate }) {
  const allProducts = useAllProducts();
  const originals = useMemo(() => allProducts.filter(p => !p.imported), [allProducts]);
  const topRef = useRef(null);
  const deletedOriginalProducts = useDeletedOriginalProducts();
  const [search, setSearch] = useState("");
  const [searchField, setSearchField] = useState("all");
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [source, setSource] = useState("all");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState(() => mode === "trash" ? "deleted" : "all");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [importedTotal, setImportedTotal] = useState(null);
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState("");
  const [drafts, setDrafts] = useState({});
  const [stock, setStock] = useState([]);
  const [stockReady, setStockReady] = useState(false);
  const [rate, setRate] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loadedQuery, setLoadedQuery] = useState("");

  const scrollToProducts = () => {
    // Auto scroll is reliable even with reduced-motion preferences and nested navigation.
    topRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
  };
  const changePage = (next) => {
    const target = Math.max(1, next);
    if (target === page) return;
    setPage(target);
    setSelected("");
    scrollToProducts();
  };
  const clearFilters = () => {
    setSearch(""); setSearchField("all"); setSource("all");
    setCategory("all"); setStatus(mode === "trash" ? "deleted" : "all"); setPage(1);
    setSelected(""); scrollToProducts();
  };

  const refresh = () => setRefreshKey(value => value + 1);
  useEffect(() => { setPage(1); setSelected(""); setImportedTotal(null); }, [search, searchField, source, category, status, pageSize, mode]);
  useEffect(() => {
    let live = true;
    fetch("/api/stock", { cache: "no-store" }).then(r => r.json()).then(data => {
      if (live) { setStock(Array.isArray(data.outOfStock) ? data.outOfStock : []); setStockReady(Array.isArray(data.outOfStock)); }
    }).catch(() => { if (live) { setStockReady(false); setError("Stock state could not be loaded. Availability changes are disabled until it loads."); } });
    return () => { live = false; };
  }, [refreshKey]);
  const existing = useMemo(() => originals.filter(p => {
    if (source === "imported" || (category !== "all" && p.category !== category)) return false;
    const deleted = deletedOriginalProducts.includes(p.slug);
    if (status === "deleted") return deleted && originalMatches(p, search.trim().toLowerCase(), searchField);
    if (deleted) return false; // Deleted items only belong in the Trash filter.
    if (status === "hidden" && !stock.includes(p.slug)) return false;
    if (!["all", "hidden"].includes(status)) return false;
    return originalMatches(p, search.trim().toLowerCase(), searchField);
  }), [originals, search, searchField, source, category, status, stock, deletedOriginalProducts]);

  // One genuine page across BOTH sources. Original rows are shown once, not
  // repeated on every imported page. Fetch only the imported rows needed to
  // fill the current page (never download 791 records into admin at once).
  const { first, originalStart, originalEnd, importOffset, importLimit } = unifiedPage(existing.length, page, pageSize, source);
  const originalPage = existing.slice(originalStart, originalEnd);
  const queryKey = [search.trim(), searchField, source, category, status, importOffset, importLimit, refreshKey].join("|");
  const importedReady = source === "original" || loadedQuery === queryKey;
  const shownRows = source === "original" ? [] : importedReady ? rows : [];
  const activeImportedTotal = importedReady ? importedTotal : null;
  const total = activeImportedTotal === null && source !== "original" ? null : existing.length + (source === "original" ? 0 : activeImportedTotal);
  const pageCount = unifiedPageCount(existing.length, activeImportedTotal, pageSize, source);
  const nextEnabled = pageCount !== null ? page < pageCount : first + pageSize < existing.length || hasMore;

  useEffect(() => { setSelected(""); }, [page]);
  useEffect(() => {
    if (source === "original") {
      setRows([]); setImportedTotal(0); setHasMore(false); setLoadedQuery(queryKey); setLoading(false); setError("");
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true); setError("");
      try {
        // Request one row even on pages filled by originals; the exact total
        // is still required for working Previous / Next pagination.
        const query = new URLSearchParams({ offset: String(importOffset), limit: String(Math.max(importLimit, 1)), search: search.trim(), searchField, status, category });
        const response = await fetch(`/api/admin/catalog?${query}`, { headers: headers(password), cache: "no-store", signal: controller.signal });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Could not load the catalogue.");
        if (!controller.signal.aborted) {
          const list = Array.isArray(data.rows) ? data.rows : [];
          setRows(importLimit ? list : []);
          setImportedTotal(Number.isSafeInteger(data.total) ? data.total : null);
          setHasMore(Boolean(data.hasMore));
          setRate(data.exchangeRate ?? null);
          setLoadedQuery(queryKey);
        }
      } catch (err) {
        if (err.name !== "AbortError" && !controller.signal.aborted) {
          setRows([]); setImportedTotal(null); setHasMore(false); setLoadedQuery(queryKey); setError(err.message);
        }
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }, 160);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [search, searchField, status, category, source, password, refreshKey, importOffset, importLimit, queryKey]);
  useEffect(() => {
    if (pageCount !== null && page > pageCount && !loading) changePage(pageCount);
  }, [pageCount, page, loading]);

  const updateImported = async (row, changes, success = "Product updated") => {
    setBusy(row.slug); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/admin/catalog/${encodeURIComponent(row.slug)}`, {
        method: "PATCH", headers: headers(password), body: JSON.stringify(changes),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw Error(data.error || "Could not save imported product.");
      setMessage(`${success}: ${row.name}`); refresh();
      window.dispatchEvent(new Event("catalog-updated"));
      return true;
    } catch (err) { setError(err.message); return false; }
    finally { setBusy(""); }
  };
  const softDelete = async (row, deleted) => {
    if (!deleted && !confirm(`Remove ${row.name} from the public website? You can restore it from Deleted items. Existing orders and reviews will stay.`)) return;
    setBusy(row.slug); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/admin/products/${encodeURIComponent(row.slug)}/${deleted ? "restore" : "delete"}`, {
        method: "POST", headers: headers(password), body: JSON.stringify({}),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok !== true || data.slug !== row.slug || data.deleted !== !deleted) {
        throw Error(data.error || "Delete/Restore did not finish. Check the server files and apply supabase/catalog_delete_restore.sql if you have not run it.");
      }
      setMessage(`${row.name} ${deleted ? "restored" : "moved to Deleted items"}.`);
      // Clear cached public variants before requesting the next admin page.
      window.dispatchEvent(new Event("catalog-updated"));
      refresh();
    } catch (err) { setError(err.message); }
    finally { setBusy(""); }
  };
  const updateStock = async (row, available) => {
    setBusy(row.slug); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/stock", { method: "POST", headers: headers(password), body: JSON.stringify({ slug: row.slug, available }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw Error(data.error || "Could not update stock.");
      setStock(data.outOfStock || []);
      setMessage(`${row.name} ${available ? "made available" : "marked unavailable"}.`);
      window.dispatchEvent(new Event("stock-updated"));
    } catch (err) { setError(err.message); }
    finally { setBusy(""); }
  };
  const draftFor = (r) => ({ price: manualPrice(r), discount: String(r.discount_percent ?? 0), ...(drafts[r.slug] || {}) });
  const changeDraft = (slug, change) => setDrafts(old => ({ ...old, [slug]: { ...(old[slug] || {}), ...change } }));
  const savePricing = async (row) => {
    const draft = draftFor(row);
    const entered = String(draft.price).trim();
    const discount = Number(draft.discount);
    if ((entered && (!/^\d+$/.test(entered) || Number(entered) < 1 || !Number.isSafeInteger(Number(entered)))) || !Number.isInteger(discount) || discount < 0 || discount > 90) {
      setError("Enter a whole-PKR price (or leave blank) and a discount from 0 to 90%."); return;
    }
    const saved = await updateImported(row, { manual_price_pkr: entered ? Number(entered) : null, discount_percent: discount }, "Price and discount saved");
    if (saved) setDrafts(d => { const next = { ...d }; delete next[row.slug]; return next; });
  };
  const saveRate = async () => {
    if (!Number.isSafeInteger(Number(rate)) || Number(rate) < 1 || !confirm("Change the USD-to-PKR rate for imported products? All calculated prices will change immediately in Supabase; historical orders and manual overrides are preserved.")) return;
    setBusy("rate"); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/catalog/exchange-rate", { method: "POST", headers: headers(password), body: JSON.stringify({ usd_to_pkr: Number(rate) }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw Error(data.error || "Could not save exchange rate.");
      setMessage("Exchange rate saved. Imported product prices recalculated."); refresh(); window.dispatchEvent(new Event("catalog-updated"));
    } catch (err) { setError(err.message); } finally { setBusy(""); }
  };
  const sectionTitle = ({ catalog: "All store products", trash: "Deleted items — restore products", stock: "Availability across all products", prices: "Prices across all products", discounts: "Discounts across all products" })[mode] || "Store products";
  return <div className="mt-5 space-y-5">
    <div ref={topRef} className="admin-catalog-top glass space-y-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-xl font-extrabold">{sectionTitle}</h2><p className="mt-1 text-sm text-[color:var(--text-3)]">{mode === "trash" ? "Products here are hidden from customers. Restore a product to its previous status, keeping its details and orders." : "Manage original and imported listings together. Delete moves a listing to Deleted items without erasing its details or orders."}</p></div>

      </div>
      <div className="admin-catalog-views" role="group" aria-label="Product management views">
        <button type="button" className={`admin-catalog-view-button ${mode !== "trash" ? "is-active" : ""}`} aria-pressed={mode !== "trash"} onClick={() => onNavigate?.("catalog")}>All products</button>
        <button type="button" className={`admin-catalog-view-button ${mode === "trash" ? "is-active" : ""}`} aria-pressed={mode === "trash"} onClick={() => onNavigate?.("trash")}>Deleted items / Restore</button>
      </div>
      <div className="admin-catalog-search-grid">
        <label className="text-xs font-semibold">Search products
          <input className="field mt-1" type="search" aria-label="Search all products" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Type a product, brand, plan or ID..." autoComplete="off" />
        </label>
        <label className="text-xs font-semibold">Search by
          <select className="field mt-1" aria-label="Choose what to search" value={searchField} onChange={e=>setSearchField(e.target.value)}>
            {searchFields.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold">Product source
          <select className="field mt-1" value={source} onChange={e=>setSource(e.target.value)}>{types.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select>
        </label>
        <label className="text-xs font-semibold">Category
          <select className="field mt-1" value={category} onChange={e=>setCategory(e.target.value)}><option value="all">All categories</option>{allCategories.filter(c=>c.slug!=="discounts").map(c=><option key={c.slug} value={c.slug}>{c.name}</option>)}</select>
        </label>
        {mode === "trash" ? <label className="text-xs font-semibold">Product status
          <input className="field mt-1" value="Deleted items — ready to restore" disabled readOnly aria-label="Showing deleted items" />
        </label> : <label className="text-xs font-semibold">Product status
          <select className="field mt-1" value={status} onChange={e=>setStatus(e.target.value)}>{statuses.map(s=><option key={s} value={s}>{s==='all'?'All active statuses':s==='deleted'?'Deleted items':s==='hidden'?'Hidden / unavailable':s.charAt(0).toUpperCase()+s.slice(1)}</option>)}</select>
        </label>}
        <label className="text-xs font-semibold">Products per page
          <select className="field mt-1" aria-label="Products per page" value={pageSize} onChange={e=>setPageSize(Number(e.target.value))}>{pageSizes.map(n=><option key={n} value={n}>{n} products</option>)}</select>
        </label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-[color:var(--text-3)]" aria-live="polite">{total === null ? "Counting matching products…" : `${total.toLocaleString("en-PK")} matching products`} · Page {page}{pageCount === null ? "" : ` of ${pageCount}`}</p>
        <div className="flex flex-wrap items-center gap-2">
          {(search || searchField !== "all" || source !== "all" || category !== "all" || (mode !== "trash" && status !== "all")) && <button type="button" className="admin-outline-button" onClick={clearFilters}>Clear filters</button>}
          <button type="button" className="admin-outline-button" onClick={refresh} disabled={loading || !!busy}>Refresh results</button>
        </div>
      </div>
      <div className="admin-page-tools" aria-label="Jump to a product page">
        <button type="button" className="admin-outline-button" disabled={page<=1||!importedReady||loading||!!error} onClick={()=>changePage(page-1)}>Previous</button>
        <label className="text-xs font-semibold flex items-center gap-2">Go to page
          <select className="field admin-page-select" value={page} aria-label="Jump to product page" disabled={pageCount === null || loading || !!error} onChange={e=>changePage(Number(e.target.value))}>
            {Array.from({length: Math.min(pageCount || 1, 1000)}, (_,i) => <option value={i+1} key={i+1}>Page {i+1}</option>)}
          </select>
        </label>
        <button type="button" className="admin-outline-button" disabled={!nextEnabled||!importedReady||loading||!!error} onClick={()=>changePage(page+1)}>Next</button>
      </div>
    </div>
    {mode==="prices" && rate != null && <div className="glass flex flex-wrap items-end gap-3 p-4"><label className="text-sm">USD → PKR (imported only)<input type="number" className="field mt-1 w-36" min="1" max="100000" value={rate} onChange={e=>setRate(e.target.value)} /></label><button type="button" className="btn-ghost" disabled={!!busy} onClick={saveRate}>Update exchange rate</button><span className="text-xs text-[color:var(--text-3)]">25% default markup. Manual overrides are not recalculated.</span></div>}
    {error && <p className="admin-notice-error" role="alert">{error}</p>}
    {message && <p className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm" role="status">{message}</p>}
    {(!importedReady || loading) && source !== "original" && <p className="admin-catalog-loading" role="status">Loading matching products…</p>}
    <div className="space-y-2">
      {originalPage.map(p => {
        const isOut = stock.includes(p.slug);
        const isDeleted = deletedOriginalProducts.includes(p.slug);
        return <article key={p.slug} className="glass flex flex-wrap items-center gap-3 p-3 sm:p-4">
          <BrandIcon name={p.slug} category={p.category} size={42}/>
          <div className="min-w-0 flex-1"><h3 className="truncate text-sm font-bold">{p.name}</h3><p className="text-xs text-[color:var(--text-3)]">Original · {p.options?.length ? `${p.options.length} plans` : formatPrice(p.price)} · {isDeleted ? "Deleted" : isOut ? "Unavailable" : "Available"}</p></div>
          <div className="admin-product-actions flex flex-wrap gap-2">
            <button type="button" className={isDeleted ? "admin-restore-button" : "admin-danger-button"} disabled={!!busy} aria-label={`${isDeleted ? "Restore" : "Delete"} ${p.name}`} onClick={()=>softDelete(p,isDeleted)}>{busy === p.slug ? "Saving…" : isDeleted ? "Restore product" : "Delete"}</button>
            <button type="button" className="admin-outline-button" disabled={isDeleted || !!busy} onClick={()=>onEdit(p.slug)}>Edit details</button>
            <button type="button" className="admin-outline-button" disabled={isDeleted || !!busy} onClick={()=>setSelected(selected===p.slug?"":p.slug)}>{selected===p.slug?"Close tools":"Price & offers"}</button>
            <button type="button" className="admin-outline-button" disabled={isDeleted || !!busy||!stockReady} onClick={()=>updateStock(p,isOut)}>{isOut?"Make available":"Mark unavailable"}</button>
          </div>
          {selected===p.slug && !isDeleted && <div className="w-full border-t border-[color:var(--border)] pt-3"><p className="mb-2 text-sm">Edit regular prices or discounts using the existing plan-aware editors.</p><div className="grid gap-4 lg:grid-cols-2"><div className="min-w-0"><AdminPrices password={password} initialSlug={p.slug} compact/></div><div className="min-w-0"><AdminDiscounts password={password} initialSlug={p.slug} compact/></div></div></div>}
        </article>;
      })}
      {shownRows.map(row=>{
        const d=draftFor(row);
        const isDeleted = String(row.status).startsWith("deleted-");
        const flagged=!!row.review_flags?.length;
        const effective=Number(row.manual_price_pkr ?? row.price_pkr);
        return <article key={row.slug} className="glass space-y-3 p-3 sm:p-4">
          <div className="flex flex-wrap items-start gap-3">
            <BrandIcon name={row.group_slug || row.slug} brandName={row.brand} category={row.category} size={42}/>
            <div className="min-w-0 flex-1"><h3 className="break-words text-sm font-bold">{productLabel(row)}</h3><p className="text-xs text-[color:var(--text-3)]">Imported · {row.variant||"Plan"} · {formatPrice(effective)} · {visibleState(row)}{row.unavailable?" · Unavailable":""}</p>{flagged && <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">Requires resale/access verification before publishing</p>}</div>
            <div className="admin-product-actions flex flex-wrap gap-2">
              <button type="button" className={isDeleted ? "admin-restore-button" : "admin-danger-button"} disabled={!!busy} aria-label={`${isDeleted ? "Restore" : "Delete"} ${row.name}`} onClick={()=>softDelete(row,isDeleted)}>{busy === row.slug ? "Saving…" : isDeleted ? "Restore product" : "Delete"}</button>
              <button type="button" className="admin-outline-button" disabled={isDeleted || !!busy} onClick={()=>onEdit(row.slug)}>Edit details</button>
              <button type="button" className="admin-outline-button" disabled={isDeleted || !!busy} onClick={()=>setSelected(selected===row.slug?"":row.slug)}>{selected===row.slug?"Close tools":"Quick edit"}</button>
              <button type="button" className="admin-outline-button" disabled={isDeleted || !!busy} onClick={()=>updateImported(row,{unavailable:!row.unavailable},row.unavailable?"Made available":"Marked unavailable")}>{row.unavailable?"Make available":"Mark unavailable"}</button>
            </div>
          </div>
          {selected===row.slug && !isDeleted && <div className="space-y-3 border-t border-[color:var(--border)] pt-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-xs font-semibold">Selling price override (Rs.)<input className="field mt-1" type="number" min="1" step="1" value={d.price} placeholder="Use calculated price" onChange={e=>changeDraft(row.slug,{price:e.target.value})}/></label>
              <label className="text-xs font-semibold">Discount %<input className="field mt-1" type="number" min="0" max="90" step="1" value={d.discount} onChange={e=>changeDraft(row.slug,{discount:e.target.value})}/></label>
              <label className="text-xs font-semibold">Category<select className="field mt-1" value={row.category} onChange={e=>updateImported(row,{category:e.target.value},"Category updated")} disabled={!!busy}>{allCategories.filter(c=>c.slug!=="discounts").map(c=><option value={c.slug} key={c.slug}>{c.name}</option>)}</select></label>
              <label className="text-xs font-semibold">Publishing status<select className="field mt-1" value={row.status} onChange={e=>{const next=e.target.value;if(flagged&&next==="published"&&!confirm("Verify legitimate resale and delivery methods before publishing. Continue?"))return;updateImported(row,{status:next},"Visibility updated")}} disabled={!!busy}>{["pending","published","hidden","rejected"].map(t=><option key={t} value={t}>{t}</option>)}</select></label>
            </div>
            <div className="flex flex-wrap items-center gap-2"><button className="btn-primary" type="button" disabled={!!busy} onClick={()=>savePricing(row)}>Save price & discount</button><button type="button" className="admin-outline-button" disabled={!!busy} onClick={()=>updateImported(row,{featured:!row.featured},"Featured selection updated")}>{row.featured?"Remove featured":"Set featured"}</button><a className="admin-outline-button" href={`/product/${encodeURIComponent(row.slug)}`} target="_blank" rel="noreferrer">Preview product</a><span className="text-xs text-[color:var(--text-3)]">Base {formatPrice(row.price_pkr)} · After discount {formatPrice(Math.round(effective*(100-(row.discount_percent||0))/100))}</span></div>
          </div>}
        </article>;
      })}
      {!loading && importedReady && !shownRows.length && !originalPage.length && !error && <p className="admin-empty">{mode === "trash" ? "No deleted products match your filters. Deleted items will appear here when you use Delete in All products." : "No products found on this page. Try another search or filter."}</p>}
    </div>
    <nav aria-label="Product pages" className="admin-page-tools py-3">
      <button type="button" className="btn-ghost" disabled={page<=1||!importedReady||loading||!!error} onClick={()=>changePage(page-1)}>Previous</button>
      <span className="text-sm" role="status">Page {page}{pageCount!==null?` of ${pageCount}`:""}{total!==null?` · ${total.toLocaleString("en-PK")} products`:""}</span>
      <button type="button" className="btn-ghost" disabled={!nextEnabled||!importedReady||loading||!!error} onClick={()=>changePage(page+1)}>Next</button>
      <button type="button" className="admin-outline-button" onClick={scrollToProducts}>Back to filters ↑</button>
    </nav>
  </div>;
}
