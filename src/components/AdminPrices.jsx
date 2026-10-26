import { useEffect, useState } from "react";
import { useProducts } from "../context/ProductContext";
import { formatPrice } from "../utils/formatPrice";
import { useDiscounts } from "../context/DiscountContext";
import { priceInfo, regularPrice } from "../utils/discounts";

const auth = (password) => ({ "Content-Type": "application/json", "x-admin-csrf": password });
export default function AdminPrices({ password, openImports, initialSlug = "", compact = false }) {
  const products = useProducts().filter(p => !p.imported);
  const { discounts } = useDiscounts();
  const [slug, setSlug] = useState(initialSlug || products[0]?.slug || "");
  const [savedPrices, setSavedPrices] = useState({});
  const [draft, setDraft] = useState({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const product = products.find((p) => p.slug === slug);
  useEffect(() => { if (initialSlug) setSlug(initialSlug); }, [initialSlug]);
  const hasEditedPrice = !!savedPrices[slug];

  const refresh = async () => {
    const res = await fetch("/api/admin/prices", { headers: auth(password), cache: "no-store" });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "Could not load saved prices.");
    setSavedPrices(body.prices || {});
  };
  useEffect(() => { refresh().catch((e) => setMessage(e.message)); }, [password]);
  useEffect(() => {
    if (!product) return;
    const saved = savedPrices[slug];
    setDraft(product.options?.length ? Object.fromEntries(product.options.map((o) =>
      [o.key || o.label, String(saved?.options?.[o.key || o.label] ?? o.price)])) : { price: String(saved?.price ?? product.price) });
  }, [slug, savedPrices]);

  const submit = async (reset = false) => {
    setBusy(true); setMessage("");
    try {
      const res = await fetch(reset ? `/api/admin/prices/${encodeURIComponent(slug)}` : "/api/admin/prices", {
        method: reset ? "DELETE" : "POST", headers: auth(password),
        ...(!reset && { body: JSON.stringify({ slug, ...(product.options?.length ?
          { options: Object.fromEntries(product.options.map((o) => [o.key || o.label, Number(draft[o.key || o.label])])) }
          : { price: Number(draft.price) }) }) }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not update product prices.");
      setSavedPrices(body.prices);
      window.dispatchEvent(new Event("pricing-updated"));
      setMessage(reset ? "Original catalog price restored." : "Regular price updated for the store and checkout.");
    } catch (e) { setMessage(e.message); }
    finally { setBusy(false); }
  };

  const valid = Object.values(draft).length > 0 && Object.values(draft).every((v) =>
    String(v).trim() !== "" && Number.isSafeInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 10000000);
  const previewPrice = valid && product && priceInfo(product, discounts,
    null, { [slug]: product.options?.length ? { options: Object.fromEntries(product.options.map((o) => [o.key || o.label, Number(draft[o.key || o.label])])) } : { price: Number(draft.price) } });

  return <div className={compact ? "space-y-3" : "mt-6 space-y-5"}>
    {!compact && <div className="glass flex flex-wrap items-center justify-between gap-3 p-4" role="note">
      <p className="max-w-2xl text-sm">Imported subscriptions have their own price overrides. Use Product details or Imported catalog to edit their PKR prices.</p>
      <button type="button" className="btn-ghost" onClick={openImports}>Manage imported products</button>
    </div>}
    <div className="glass space-y-4 p-5">
      <h2 className="text-xl font-bold">Edit regular product prices</h2>
      <p className="text-sm text-slate-400">Change the actual regular selling price, without changing the discount percentage or rupees-off offer. Prices update across product pages, cart and checkout. Existing paid orders keep their recorded totals.</p>
      <label className="block text-sm font-semibold">Choose product
        <select className="field mt-2" value={slug} onChange={(e) => { setSlug(e.target.value); setMessage(""); }}>
          {products.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
        </select>
      </label>
      {product?.options?.length ? <div className="grid gap-3 sm:grid-cols-2">
        {product.options.map((o) => <label key={o.key || o.label} className="text-sm font-semibold">{o.label} — regular price (Rs.)
          <input className="field mt-2" type="number" min="1" max="10000000" step="1" required value={draft[o.key || o.label] ?? ""} onChange={(e) => setDraft((d) => ({ ...d, [o.key || o.label]: e.target.value }))}/>
          <span className="mt-1 block text-xs font-normal text-slate-400">Catalog default: {formatPrice(o.price)}</span>
        </label>)}
      </div> : <label className="block text-sm font-semibold">Regular price (Rs.)
        <input className="field mt-2" type="number" min="1" max="10000000" step="1" required value={draft.price ?? ""} onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}/>
        <span className="mt-1 block text-xs font-normal text-slate-400">Catalog default: {formatPrice(product.price)}</span>
      </label>}
      {previewPrice && <p className="text-sm">Customer preview (lowest plan): <strong>{formatPrice(previewPrice.original)}</strong>
        {previewPrice.onSale && <> → <strong className="text-emerald-500">{formatPrice(previewPrice.price)} after discount</strong></>}
      </p>}
      {discounts[slug]?.type === "amount" && <p className="text-sm text-amber-500">This product has a fixed rupee discount. Each regular plan price must be higher than the discount amount.</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary disabled:opacity-50" disabled={!valid || busy} onClick={() => submit(false)}>Save prices</button>
        {hasEditedPrice && <button type="button" className="btn-ghost disabled:opacity-50" disabled={busy} onClick={() => submit(true)}>Restore catalog price</button>}
      </div>
      {message && <p role="status" className="text-sm" aria-live="polite">{message}</p>}
    </div>
    <div className="glass p-5">
      <h3 className="text-xl font-bold">Updated prices ({Object.keys(savedPrices).length})</h3>
      <div className="mt-3 space-y-3">{products.filter((p) => savedPrices[p.slug]).map((p) =>
        <button key={p.slug} type="button" className="block w-full border-b border-[color:var(--border)] py-2 text-left text-sm hover:underline" onClick={() => { setSlug(p.slug); setMessage(""); }}>
          <strong>{p.name}</strong> — {formatPrice(regularPrice(p, null, savedPrices))}
          {discounts[p.slug] && <span className="text-emerald-500"> (sale price {formatPrice(priceInfo(p, discounts, null, savedPrices).price)})</span>}
        </button>)}
      {!Object.keys(savedPrices).length && <p className="text-sm text-slate-400">All products currently use their catalog prices.</p>}</div>
    </div>
  </div>;
}
