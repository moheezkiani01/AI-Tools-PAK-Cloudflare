import { useEffect, useMemo, useState } from "react";
import { useProducts } from "../context/ProductContext";

const headers = (password) => ({ "Content-Type": "application/json", "x-admin-csrf": password });

export default function AdminPurchaseNumbers({ password }) {
  const products = useProducts();
  const [productSearch, setProductSearch] = useState("");
  const filteredProducts = useMemo(() => products.filter(p => `${p.name} ${p.brand || ""}`.toLowerCase().includes(productSearch.toLowerCase())).slice(0, 150), [products, productSearch]);
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState({ slug: products[0]?.slug || "", orderReference: "" });
  const [newNumber, setNewNumber] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  // Imported products may arrive after the first render. Always keep a valid selection.
  useEffect(() => {
    if (products.length && !products.some(p => p.slug === form.slug))
      setForm(old => ({ ...old, slug: products[0].slug }));
  }, [products, form.slug]);
  const load = async () => {
    try {
      const res = await fetch("/api/admin/purchase-numbers", { headers: headers(password), cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load purchase numbers.");
      setEntries(data);
    } catch (err) { setMessage(err.message); }
  };
  useEffect(() => { load(); }, [password]);

  const create = async (event) => {
    event.preventDefault(); setBusy(true); setMessage(""); setNewNumber("");
    try {
      const res = await fetch("/api/admin/purchase-numbers", { method: "POST", headers: headers(password), body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create purchase number.");
      setNewNumber(data.entry.token);
      setForm((old) => ({ ...old, orderReference: "" }));
      setMessage("Purchase number created. Send it to the customer after confirming payment.");
      await load();
    } catch (err) { setMessage(err.message); }
    finally { setBusy(false); }
  };

  const revoke = async (entry) => {
    if (!confirm(`Revoke unused purchase number ${entry.token}?`)) return;
    try {
      const res = await fetch(`/api/admin/purchase-numbers/${encodeURIComponent(entry.token)}`, { method: "DELETE", headers: headers(password) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not revoke purchase number.");
      setMessage("Unused purchase number revoked.");
      await load();
    } catch (err) { setMessage(err.message); }
  };
  return (
    <div className="mt-6 space-y-6">
      <div><h2 className="text-xl font-bold">Purchase numbers for reviews</h2>
        <p className="mt-2 text-sm text-slate-400">After a product is sold and payment is confirmed, generate a purchase number and share it privately with that customer. It only works for the selected product and can be used for one review.</p></div>
      <form onSubmit={create} className="glass space-y-4 p-5">
        <label className="block text-sm">Search products<input className="field mt-1" type="search" placeholder="Search original or imported plans" value={productSearch} onChange={e=>setProductSearch(e.target.value)}/></label>
        <label className="block text-sm">Sold product
          <select className="field mt-1" required value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })}>
            {products.find(p => p.slug===form.slug && !filteredProducts.some(q=>q.slug===form.slug)) && <option value={form.slug}>{products.find(p=>p.slug===form.slug)?.name}</option>}
            {filteredProducts.map((product) => <option value={product.slug} key={product.slug}>{product.name}</option>)}
          </select>
        </label>
        <label className="block text-sm">Order reference (optional, admin only)
          <input className="field mt-1" maxLength={80} value={form.orderReference} onChange={(e) => setForm({ ...form, orderReference: e.target.value })} placeholder="Checkout order number or offline receipt" />
        </label>
        <button type="submit" disabled={busy} className="btn-primary">{busy ? "Generating..." : "Generate purchase number"}</button>
      </form>
      {newNumber && <div className="glass p-5"><p className="text-xs text-slate-400">New number — send to your customer</p>
        <p className="mt-2 select-all break-all text-lg font-bold">{newNumber}</p>
        <button type="button" className="btn-ghost mt-3 text-sm" onClick={() => navigator.clipboard?.writeText(newNumber).then(() => setMessage("Purchase number copied.")).catch(() => setMessage("Select and copy the number above."))}>Copy number</button>
      </div>}
      {message && <p role="status" className="text-sm text-[color:var(--text)]">{message}</p>}
      <h3 className="text-lg font-bold">Issued purchase numbers ({entries.length})</h3>
      {entries.length === 0 && <p className="text-sm text-slate-400">No purchase numbers issued yet.</p>}
      <ul className="space-y-2">{entries.map((entry) => (
        <li className="glass flex flex-wrap items-center justify-between gap-3 p-4" key={entry.token}>
          <div className="min-w-0"><strong className="break-all text-sm">{entry.token}</strong>
            <p className="mt-1 text-xs text-slate-400">{products.find((p) => p.slug === entry.slug)?.name || entry.slug || "Any product"} · {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : "Previously issued"}{entry.orderReference ? ` · ${entry.orderReference}` : ""}</p>
          </div>
          <div className="flex items-center gap-3"><span className={`text-xs font-semibold ${entry.used ? "text-slate-400" : "text-emerald-600 dark:text-emerald-400"}`}>{entry.used ? "Used" : "Unused"}</span>
            {!entry.used && <button type="button" className="text-xs text-red-600 hover:underline dark:text-red-400" onClick={() => revoke(entry)}>Revoke</button>}</div>
        </li>
      ))}</ul>
    </div>
  );
}
