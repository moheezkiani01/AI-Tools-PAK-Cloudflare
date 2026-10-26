import { useEffect, useMemo, useState } from "react";
import { useProducts } from "../context/ProductContext";
import { salePrice, regularPrice } from "../utils/discounts";
import { useDiscounts } from "../context/DiscountContext";
import { formatPrice } from "../utils/formatPrice";

export default function AdminDiscounts({ password, openImports, initialSlug = "", compact = false }) {
  const products = useProducts().filter(p => !p.imported);
  const [discounts, setDiscounts] = useState({});
  const { prices } = useDiscounts();
  const [slug, setSlug] = useState(initialSlug || products[0]?.slug || "");
  const [type, setType] = useState("percent");
  const [value, setValue] = useState("");
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);
  const product = products.find((p) => p.slug === slug);
  useEffect(() => { if (initialSlug) setSlug(initialSlug); }, [initialSlug]);
  const selected = discounts[slug];
  const min = product ? regularPrice(product, null, prices) : 0;
  const active = useMemo(() => products.filter((p) => discounts[p.slug]), [discounts, products]);

  useEffect(() => { fetch("/api/admin/discounts", { headers: { "x-admin-csrf": password }, cache: "no-store" })
    .then((r) => { if (!r.ok) throw new Error("Could not load discounts."); return r.json(); })
    .then((data) => setDiscounts(data.discounts || {})).catch((e) => setMessage(e.message)); }, [password]);
  useEffect(() => { setType(selected?.type || "percent"); setValue(selected ? String(selected.value) : ""); }, [slug, selected?.type, selected?.value]);

  const update = async (targetSlug, remove = false) => {
    setWorking(true); setMessage("");
    try {
      const response = await fetch(remove ? `/api/admin/discounts/${encodeURIComponent(targetSlug)}` : "/api/admin/discounts", {
        method: remove ? "DELETE" : "POST", headers: { "Content-Type": "application/json", "x-admin-csrf": password },
        ...(!remove && { body: JSON.stringify({ slug: targetSlug, type, value: Number(value) }) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save discount.");
      setDiscounts(data.discounts);
      window.dispatchEvent(new Event("discounts-updated"));
      setMessage(remove ? "Discount removed. The original price is restored." : "Discount saved. Sale prices are now live.");
    } catch (err) { setMessage(err.message); }
    finally { setWorking(false); }
  };

  return <div className={compact ? "space-y-3" : "mt-6 space-y-5"}>
    {!compact && <div className="glass flex flex-wrap items-center justify-between gap-3 p-4" role="note">
      <p className="max-w-2xl text-sm">Imported subscriptions use percentage discounts in Supabase. Edit those offers under Imported catalog or Product details.</p>
      <button type="button" className="btn-ghost" onClick={openImports}>Manage imported products</button>
    </div>}
    <div className="glass space-y-4 p-5">
      <h2 className="text-xl font-bold">Set a product discount</h2>
      <p className="text-sm text-slate-400">Choose a product, then enter a percentage off or rupees off. For products with multiple plans, the discount applies to every plan. The original prices stay saved.</p>
      <label className="block text-sm font-semibold">Product
        <select className="field mt-2" value={slug} onChange={(e) => setSlug(e.target.value)}>{products.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}</select>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold">Discount type
          <select className="field mt-2" value={type} onChange={(e) => { setType(e.target.value); setValue(""); }}>
            <option value="percent">Percentage (%) off</option><option value="amount">Fixed amount (Rs.) off</option>
          </select>
        </label>
        <label className="text-sm font-semibold">Amount to reduce
          <input type="number" min="1" max={type === "percent" ? "99" : Math.max(1, min - 1)} step="1" className="field mt-2" value={value} onChange={(e) => setValue(e.target.value)} placeholder={type === "percent" ? "e.g. 20" : "e.g. 500"} />
        </label>
      </div>
      {Number(value) > 0 && <p className="text-sm">Price preview: <del className="text-slate-400">{formatPrice(min)}</del> <strong className="text-emerald-500">{formatPrice(salePrice(min, { type, value: Number(value) }))}</strong></p>}
      <div className="flex flex-wrap gap-2">
        <button disabled={working || !value} className="btn-primary disabled:opacity-50" onClick={() => update(slug)}>Save discount</button>
        {selected && <button disabled={working} className="btn-ghost" onClick={() => update(slug, true)}>Remove discount</button>}
      </div>
      {message && <p role="status" className="text-sm text-[color:var(--text)]">{message}</p>}
    </div>
    {!compact && <div className="glass p-5">
      <h3 className="text-xl font-bold">Products on sale ({active.length})</h3>
      {!active.length ? <p className="mt-3 text-sm text-slate-400">No active discounts. Add one above to show products in Discounts.</p> :
        <ul className="mt-4 space-y-2">{active.map((p) => <li key={p.slug} className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--border)] pb-3">
          <span><strong>{p.name}</strong><span className="block text-xs text-slate-400">{discounts[p.slug].type === "percent" ? `${discounts[p.slug].value}% off` : `${formatPrice(discounts[p.slug].value)} off`} · <del>{formatPrice(regularPrice(p, null, prices))}</del> → {formatPrice(salePrice(regularPrice(p, null, prices), discounts[p.slug]))}</span></span>
          <div className="flex gap-2"><button className="btn-ghost text-xs" onClick={() => setSlug(p.slug)}>Edit</button><button disabled={working} className="btn-ghost text-xs" onClick={() => update(p.slug, true)}>Remove</button></div>
        </li>)}</ul>}
    </div>}
  </div>;
}
