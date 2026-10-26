import { useEffect, useState } from "react";
import { allCategories } from "../data/categories";
import { formatPrice } from "../utils/formatPrice";

const headers = (password) => ({ "Content-Type": "application/json", "x-admin-csrf": password });
const clean = (value) => String(value ?? "");

export default function AdminImportedDetailEditor({ password, slug }) {
  const [draft, setDraft] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const read = async (signal) => {
    const res = await fetch(`/api/admin/catalog/${encodeURIComponent(slug)}`, {
      headers: headers(password), cache: "no-store", signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Could not load imported product.");
    if (!data.item) throw new Error("No imported product was returned.");
    return data.item;
  };

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setDraft(null);
    setMessage("");
    read(controller.signal)
      .then(setDraft)
      .catch((error) => { if (error.name !== "AbortError") setMessage(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [password, slug]);

  const change = (field, value) => setDraft((old) => ({ ...old, [field]: value }));
  const save = async (event) => {
    event.preventDefault();
    if (!draft || saving) return;
    setMessage("");
    const manual = clean(draft.manual_price_pkr).trim();
    const discount = Number(draft.discount_percent);
    if (manual && (!/^\d+$/.test(manual) || !Number.isSafeInteger(Number(manual)) || Number(manual) < 1)) {
      return setMessage("Enter a valid whole-PKR price, or leave override empty.");
    }
    if (!Number.isInteger(discount) || discount < 0 || discount > 90) {
      return setMessage("Discount must be a whole number from 0 to 90.");
    }
    if (draft.review_flags?.length && draft.status === "published" &&
        !confirm("This offer has account-access or authorization warnings. Have you independently verified the resale rights and delivery method?")) return;
    setSaving(true);
    try {
      const updates = {
        name: clean(draft.name).trim(), description: clean(draft.description),
        category: draft.category, variant: clean(draft.variant),
        product_type: clean(draft.product_type), status: draft.status,
        manual_price_pkr: manual ? Number(manual) : null,
        discount_percent: discount, featured: !!draft.featured,
        unavailable: !!draft.unavailable,
      };
      const res = await fetch(`/api/admin/catalog/${encodeURIComponent(slug)}`, {
        method: "PATCH", headers: headers(password), body: JSON.stringify(updates),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not save imported product.");
      const refreshed = await read();
      setDraft(refreshed);
      window.dispatchEvent(new Event("catalog-updated"));
      setMessage("Imported product saved successfully to Supabase.");
    } catch (error) {
      setMessage(error.message || "Save failed. No changes were confirmed.");
    } finally { setSaving(false); }
  };

  if (loading) return <div className="glass p-5" role="status">Loading imported product...</div>;
  if (!draft) return <div className="glass space-y-3 p-5" role="alert">
    <p className="font-bold">Could not open this imported product.</p>
    <p className="text-sm">{message || "Check your connection and admin session."}</p>
    <button type="button" className="btn-ghost" onClick={() => { setLoading(true);read().then(setDraft).catch(e=>setMessage(e.message)).finally(()=>setLoading(false)); }}>Try again</button>
  </div>;
  const effectivePrice = Number(draft.manual_price_pkr ?? draft.price_pkr);
  const finalPrice = Math.round(effectivePrice * (100 - Number(draft.discount_percent || 0)) / 100);
  return <form className="glass space-y-5 p-5" onSubmit={save}>
    <div className="space-y-1">
      <h2 className="text-xl font-bold">Edit imported subscription</h2>
      <p className="text-sm text-slate-400">Changes are saved to the imported Supabase catalogue. Supplier costs and internal IDs are not modified.</p>
      <p className="break-all text-xs text-slate-400">ID: {draft.slug} · Brand: {draft.brand}</p>
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-semibold">Product name
        <input className="field mt-2" required maxLength={230} value={clean(draft.name)} onChange={e=>change("name",e.target.value)}/>
      </label>
      <label className="text-sm font-semibold">Category
        <select className="field mt-2" value={draft.category} onChange={e=>change("category",e.target.value)}>
          {allCategories.filter(c=>c.slug!=="discounts").map(c=><option key={c.slug} value={c.slug}>{c.name}</option>)}
        </select>
      </label>
      <label className="text-sm font-semibold">Plan / duration
        <input className="field mt-2" maxLength={230} value={clean(draft.variant)} onChange={e=>change("variant",e.target.value)} placeholder="1 Month, 12 Months, 100M credits"/>
      </label>
      <label className="text-sm font-semibold">Subscription / delivery type
        <input className="field mt-2" maxLength={50} value={clean(draft.product_type)} onChange={e=>change("product_type",e.target.value)} placeholder="Subscription, license, API"/>
      </label>
    </div>
    <label className="block text-sm font-semibold">Description
      <textarea className="field mt-2" maxLength={540} rows={4} value={clean(draft.description)} onChange={e=>change("description",e.target.value)} />
      <span className="mt-1 block text-xs font-normal text-slate-400">Maximum 540 characters; do not include account passwords, OTPs, 2FA secrets, or unsupported claims.</span>
    </label>
    <div className="grid gap-4 sm:grid-cols-3">
      <label className="text-sm font-semibold">Override selling price (PKR)
        <input className="field mt-2" type="number" step="1" min="1" value={draft.manual_price_pkr ?? ""} placeholder="Use calculated price" onChange={e=>change("manual_price_pkr",e.target.value)}/>
      </label>
      <label className="text-sm font-semibold">Discount (%)
        <input className="field mt-2" type="number" min="0" max="90" step="1" value={draft.discount_percent ?? 0} onChange={e=>change("discount_percent",e.target.value)}/>
      </label>
      <label className="text-sm font-semibold">Visibility
        <select className="field mt-2" value={draft.status} onChange={e=>change("status",e.target.value)}>
          <option value="pending">Pending (unflagged products auto-list)</option>
          <option value="published">Published</option>
          <option value="hidden">Hidden</option>
          <option value="rejected">Rejected</option>
        </select>
      </label>
    </div>
    <div className="flex flex-wrap gap-4">
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!draft.featured} onChange={e=>change("featured",e.target.checked)} /> Featured product</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!draft.unavailable} onChange={e=>change("unavailable",e.target.checked)}/> Currently unavailable (disable checkout)</label>
    </div>
    {draft.review_flags?.length>0 && <p className="text-sm text-amber-600 dark:text-amber-400" role="note">This record is flagged for account-access or authorization concerns. Keep it hidden unless the offer is verified.</p>}
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-2)] p-3 text-sm">
      Calculated price: <strong>{formatPrice(Number(draft.price_pkr))}</strong> · Current selling price: <strong>{formatPrice(effectivePrice)}</strong> · After discount: <strong>{formatPrice(finalPrice)}</strong>
    </div>
    <div className="flex flex-wrap gap-3">
      <button type="submit" disabled={saving} className="btn-primary">{saving ? "Saving..." : "Save imported product"}</button>
      <a className="btn-ghost" href={`/product/${encodeURIComponent(slug)}`}>View product page</a>
    </div>
    {message && <p role="status" aria-live="polite" className="text-sm">{message}</p>}
  </form>;
}
