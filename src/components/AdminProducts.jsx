import { useEffect, useState } from "react";
import BrandIcon from "./BrandIcon";
import { useProducts } from "../context/ProductContext";
import { formatPrice } from "../utils/formatPrice";
import SalePrice from "./SalePrice";
import { useDiscounts } from "../context/DiscountContext";

// Admin: mark each product Available or Out of stock
export default function AdminProducts({ password, openImports }) {
  const products = useProducts().filter(p => !p.imported);
  const { priceFor } = useDiscounts();
  const [outOfStock, setOutOfStock] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/stock").then((r) => r.json()).then((d) => setOutOfStock(d.outOfStock)).catch(() => setError("Could not load stock."));
  }, []);

  const setAvailable = async (slug, available) => {
    setError("");
    const res = await fetch("/api/admin/stock", { method: "POST", headers: { "Content-Type": "application/json", "x-admin-csrf": password }, body: JSON.stringify({ slug, available }) });
    const body = await res.json().catch(() => null);
    if (!res.ok) return setError(body?.error || "Could not save.");
    setOutOfStock(body.outOfStock);
  };

  return (
    <div className="mt-6">
    <div className="glass flex flex-wrap items-center justify-between gap-3 p-4" role="note">
      <p className="max-w-2xl text-sm">Imported subscriptions are managed separately: use Product details or Imported catalog to mark them available or unavailable.</p>
      <button type="button" className="btn-ghost" onClick={openImports}>Manage imported products</button>
    </div>
      <p className="text-sm text-slate-400">Out-of-stock products cannot be ordered on the website. Changes apply straight away.</p>
      {error && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
      <ul className="mt-4 space-y-2">
        {products.map((p) => {
          const out = outOfStock.includes(p.slug);
          return (
            <li key={p.slug} className="glass flex items-center gap-3 p-3">
              <BrandIcon name={p.slug} category={p.category} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{p.name}</span>
                <span className="block text-xs text-slate-400"><SalePrice from={!!p.options} {...priceFor(p)} /></span>
              </span>
              <span className={`hidden rounded-full px-2.5 py-0.5 text-xs font-bold sm:inline ${out ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"}`}>{out ? "Out of stock" : "Available"}</span>
              <button onClick={() => setAvailable(p.slug, out)} className="btn-ghost whitespace-nowrap text-xs">{out ? "Mark available" : "Mark out of stock"}</button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
