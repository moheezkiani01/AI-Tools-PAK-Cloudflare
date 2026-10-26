import { useEffect, useMemo, useState } from "react";
import { useProducts } from "../context/ProductContext";
import { Stars } from "./Icon";

const headers = (password) => ({ "Content-Type": "application/json", "x-admin-csrf": password });
const pakistanToday = () => new Date(Date.now() + 5 * 3600000).toISOString().slice(0, 10);
const empty = { slug: "", name: "", rating: 5, comment: "", date: pakistanToday(), source: "imported" };
const sourceOptions = [
  { value: "imported", label: "Shared with the store" },
  { value: "website_admin", label: "Submitted on the website (entered by store)" },
  { value: "whatsapp", label: "Received via WhatsApp" },
  { value: "offline", label: "Received in person / offline" },
];

export default function AdminReviews({ password }) {
  const products = useProducts();
  const [productSearch, setProductSearch] = useState("");
  const [form, setForm] = useState({ ...empty, slug: products[0]?.slug || "" });
  const filteredProducts = useMemo(() => products.filter(p => `${p.name} ${p.brand || ""}`.toLowerCase().includes(productSearch.toLowerCase())).slice(0, 150), [products, productSearch]);
  const choices = products.find(p => p.slug === form.slug && !filteredProducts.some(f => f.slug === form.slug)) ? [products.find(p => p.slug === form.slug), ...filteredProducts] : filteredProducts;
  const [reviews, setReviews] = useState([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sourceDrafts, setSourceDrafts] = useState({});
  const [updatingId, setUpdatingId] = useState(null);
  // Imported products may arrive after the first render. Always keep a valid selection.
  useEffect(() => {
    if (products.length && !products.some(p => p.slug === form.slug))
      setForm(old => ({ ...old, slug: products[0].slug }));
  }, [products, form.slug]);

  const load = async () => {
    try {
      const res = await fetch("/api/admin/reviews", { headers: headers(password), cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load reviews.");
      setReviews(data);
      setSourceDrafts(Object.fromEntries(data.filter((r) => r.id && r.source !== "customer" && r.verified !== true).map((r) => [r.id, r.source || "imported"])));
    } catch (err) { setMessage(err.message); }
  };
  useEffect(() => { load(); }, [password]);

  const add = async (e) => {
    e.preventDefault();
    setBusy(true); setMessage("");
    try {
      const res = await fetch("/api/admin/reviews", { method: "POST", headers: headers(password), body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save review.");
      setForm({ ...form, name: "", comment: "", rating: 5 });
      setMessage("Customer feedback added to the selected product.");
      await load();
    } catch (err) { setMessage(err.message); }
    finally { setBusy(false); }
  };

  const saveSource = async (item) => {
    setUpdatingId(item.id);
    setMessage("");
    try {
      const res = await fetch(`/api/admin/reviews/${encodeURIComponent(item.id)}/source`, {
        method: "PATCH", headers: headers(password),
        body: JSON.stringify({ source: sourceDrafts[item.id] || "imported" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update review source.");
      setMessage("Review source updated. Customers will see the new source label after refreshing the page.");
      await load();
    } catch (err) { setMessage(err.message); }
    finally { setUpdatingId(null); }
  };

  const remove = async (item) => {
    if (!confirm(`Delete the review from ${item.name}?`)) return;
    try {
      const res = await fetch(`/api/admin/reviews/${item.id}`, { method: "DELETE", headers: headers(password) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not delete review.");
      setMessage("Review deleted."); await load();
    } catch (err) { setMessage(err.message); }
  };

  return (
    <div className="mt-6 space-y-6">
      <p className="text-sm text-slate-400">Record genuine customer feedback from WhatsApp, offline, or website records. Choose the real feedback source. Admin-entered reviews are visibly identified on product pages; they are never displayed as independently posted by a visitor.</p>
      <form className="glass space-y-4 p-5" onSubmit={add}>
        <h2 className="text-xl font-bold">Add customer feedback</h2>
        <label className="block text-sm">Find a product (including imported plans)<input className="field mt-1" type="search" placeholder="Search product name" value={productSearch} onChange={e=>setProductSearch(e.target.value)} /></label>
        <label className="block text-sm">Product<select className="field mt-1" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })}>{choices.map((p) => <option value={p.slug} key={p.slug}>{p.name}</option>)}</select></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Customer name<input className="field mt-1" value={form.name} maxLength={60} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
          <label className="text-sm">Original feedback date<input type="date" className="field mt-1" max={pakistanToday()} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">Review source
            <select className="field mt-1" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
              {sourceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="block text-sm">Star rating<select className="field mt-1" value={form.rating} onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} star{n === 1 ? "" : "s"}</option>)}</select></label>
        </div>
        <p className="text-xs text-slate-400">Admin-recorded feedback needs no purchase number, including feedback received from the website. Visitors must still use a valid purchase number to post their own reviews.</p>
        <label className="block text-sm">Customer's comment<textarea className="field mt-1" rows={3} minLength={5} maxLength={500} required placeholder="Enter feedback the customer actually provided" value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} /></label>
        <button type="submit" disabled={busy} className="btn-primary">{busy ? "Saving…" : "Publish feedback"}</button>
      </form>
      {message && <p role="status" className="text-sm">{message}</p>}
      <h2 className="text-lg font-bold">Recent reviews ({reviews.length})</h2>
      {reviews.length === 0 ? <p className="text-sm text-slate-400">No reviews yet.</p> : (
        <ul className="space-y-2">{reviews.slice(0, 40).map((r, i) => (
          <li key={r.id || i} className="glass flex flex-wrap items-start justify-between gap-3 p-4">
            <div className="min-w-0 flex-1"><strong>{r.name}</strong><span className="ml-2 text-xs text-slate-400">{r.source === "customer" ? "Website visitor" : r.source === "website_admin" ? "Website feedback (admin-recorded)" : r.source === "whatsapp" ? "WhatsApp feedback" : r.source === "offline" ? "Offline feedback" : "Shared with store"}</span><p className="text-xs text-slate-400">{products.find((p) => p.slug === r.slug)?.name || r.slug} · {String(r.date).slice(0, 10)}</p><Stars value={r.rating} size={14} /><p className="mt-1 text-sm break-words">{r.comment}</p></div>
            <div className="flex w-full flex-wrap items-end gap-2 sm:w-auto">
              {r.id && r.source !== "customer" && r.verified !== true && (
                <>
                  <label className="text-xs">Display source
                    <select
                      className="field mt-1 max-w-full text-sm"
                      aria-label={`Review source for ${r.name}`}
                      value={sourceDrafts[r.id] || "imported"}
                      onChange={(e) => setSourceDrafts((old) => ({ ...old, [r.id]: e.target.value }))}
                    >
                      {sourceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                  <button type="button" className="btn-ghost text-xs" disabled={updatingId === r.id || (sourceDrafts[r.id] || "imported") === (r.source || "imported")} onClick={() => saveSource(r)}>
                    {updatingId === r.id ? "Saving..." : "Save source"}
                  </button>
                </>
              )}
              {r.source === "customer" && <span className="text-xs text-slate-400">Verified website submission — source locked</span>}
              {r.id && <button onClick={() => remove(r)} className="text-sm text-red-600 dark:text-red-400 hover:underline">Delete</button>}
            </div>
          </li>
        ))}</ul>
      )}
    </div>
  );
}
