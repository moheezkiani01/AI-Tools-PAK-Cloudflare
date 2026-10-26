import { useEffect, useState } from "react";
import { products as originals } from "../data/products";
import { allCategories } from "../data/categories";
import { editableProductDetails } from "../utils/productDetails";
import { useProducts } from "../context/ProductContext";
import BrandIcon from "./BrandIcon";
import AdminImportedDetailEditor from "./AdminImportedDetailEditor";

const headers = (password) => ({ "Content-Type": "application/json", "x-admin-csrf": password });
const defaultsFor = (slug) => {
  const product = originals.find((p) => p.slug === slug);
  return product ? editableProductDetails(product) : {};
};

function TextField({ field, title, max = 250, rows = 0, hint = "", draft, change }) {
  return (
    <label className="block text-sm font-semibold">{title}
      {rows ? <textarea className="field mt-2" rows={rows} maxLength={max} value={draft[field] || ""} onChange={(e) => change(field, e.target.value)} /> :
        <input className="field mt-2" type="text" maxLength={max} value={draft[field] || ""} onChange={(e) => change(field, e.target.value)} />}
      {hint && <span className="mt-1 block text-xs font-normal text-slate-400">{hint}</span>}
    </label>
  );
}

export default function AdminEditDetails({ password, initialSlug = "" }) {
  const products = useProducts();
  const [slug, setSlug] = useState(originals[0].slug);
  const [saved, setSaved] = useState({});
  const [draft, setDraft] = useState(defaultsFor(originals[0].slug));
  const [monthsText, setMonthsText] = useState("");
  const [featuresText, setFeaturesText] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const product = products.find((p) => p.slug === slug);
  const isImported = slug.startsWith("import-") || !!product?.imported;
  const original = originals.find((p) => p.slug === slug);

  const read = async () => {
    const response = await fetch("/api/admin/product-details", { headers: headers(password), cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load saved product details.");
    setSaved(data.details || {});
  };
  useEffect(() => { read().catch((e) => setMessage(e.message)); }, [password]);
  useEffect(() => { if (initialSlug) setSlug(initialSlug); }, [initialSlug]);
  useEffect(() => {
    const next = { ...defaultsFor(slug), ...(saved[slug] || {}) };
    setDraft(next);
    setMonthsText((Array.isArray(next.months) ? next.months : []).join(", "));
    setFeaturesText((Array.isArray(next.features) ? next.features : []).join("\n"));
  }, [slug, saved]);
  const change = (key, value) => setDraft((before) => ({ ...before, [key]: value }));
  const submit = async (reset = false) => {
    setBusy(true); setMessage("");
    try {
      const months = monthsText.trim() ? monthsText.split(",").map((m) => Number(m.trim())) : [];
      const features = featuresText.split(/\r?\n/).map((t) => t.trim()).filter(Boolean);
      if (!reset && (months.some((m) => !Number.isInteger(m) || m < 1 || m > 120) || months.length > 12))
        throw new Error("Duration filter months must be numbers from 1–120, separated by commas.");
      const endpoint = reset ? `/api/admin/product-details/${encodeURIComponent(slug)}` : "/api/admin/product-details";
      const response = await fetch(endpoint, {
        method: reset ? "DELETE" : "POST", headers: headers(password),
        ...(!reset && { body: JSON.stringify({ slug, details: { ...draft, months, features } }) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save product details.");
      setSaved(result.details || {});
      window.dispatchEvent(new Event("product-details-updated"));
      setMessage(reset ? "Original product information restored. Price edits and discounts remain unchanged." : "Product details saved. They now appear on the website.");
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  };
  const picker = <label className="block text-sm font-semibold">Choose a product
    <select aria-label="Choose a product to edit" className="field mt-2" value={slug} onChange={(event) => {setSlug(event.target.value);setMessage("");}}>
      {isImported && !products.some((p) => p.slug === slug) && <option value={slug}>Imported product · {slug}</option>}
      {products.map((p) => <option key={p.slug} value={p.slug}>{p.imported ? "Imported · " : ""}{p.name}</option>)}
    </select>
  </label>;
  // Imported rows are stored in ai_tools_catalog, not in the original product-details JSON.
  // Rendering the original editor for an import caused a crash at original.name/options.
  if (isImported) return <div className="mt-6 space-y-5">
    <div className="glass p-5">{picker}</div>
    <AdminImportedDetailEditor key={slug} password={password} slug={slug} />
  </div>;
  if (!original) return <div className="glass mt-6 p-5" role="alert">
    <p className="font-bold">The selected product cannot be edited here.</p>
    <p className="mt-2 text-sm">Choose another product. Existing records were not changed.</p>
    {picker}
  </div>;
  return <div className="mt-6 space-y-5">
    <div className="glass space-y-5 p-5">
      <h2 className="text-xl font-bold">Edit product information</h2>
      <p className="text-sm text-slate-400">Change the details customers see in the catalogue and product page. Slug, product identity, logo and purchase numbers remain linked. Edit regular prices in the separate Edit prices tab.</p>
      {picker}
      <div className="flex items-center gap-3 rounded-xl border border-[color:var(--border)] p-3">
        <BrandIcon name={slug} category={product?.category} size={44}/>
        <div><p className="font-bold">{original.name}</p><p className="text-xs text-slate-400">Product ID: {slug} (permanent)</p></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField field="name" title="Product name" max={100} draft={draft} change={change}/>
        <label className="block text-sm font-semibold">Category
          <select className="field mt-2" value={draft.category} onChange={(e) => change("category", e.target.value)}>
            {allCategories.filter((c) => c.slug !== "discounts").map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
        </label>
        <TextField field="type" title="Plan / account type" max={160} hint="For example: Private account, shared access, license key, or subscription." draft={draft} change={change}/>
        <TextField field="duration" title="Displayed duration" max={160} hint="For example: 1 Month, 18 Months, Lifetime or Credit-based." draft={draft} change={change}/>
        <label className="block text-sm font-semibold">Months for duration filters
          <input className="field mt-2" value={monthsText} onChange={(e) => setMonthsText(e.target.value)} placeholder="1, 3, 12"/>
          <span className="mt-1 block text-xs font-normal text-slate-400">Numbers separated by commas. Leave empty if there is no fixed monthly duration.</span>
        </label>
        <TextField field="limit" title="Credits, screens, usage limits or included access" max={250} draft={draft} change={change}/>
      </div>
      <TextField field="description" title="Full product description" max={1500} rows={4} draft={draft} change={change}/>
      <label className="block text-sm font-semibold">Features and inclusions (one per line)
        <textarea className="field mt-2" rows={5} value={featuresText} onChange={(e) => setFeaturesText(e.target.value)} placeholder="AI chat access\nPriority support\n..." />
        <span className="mt-1 block text-xs font-normal text-slate-400">Up to 12 feature lines, 250 characters each.</span>
      </label>
      <TextField field="delivery" title="Product-specific delivery information" max={1200} rows={3} hint="When empty, the standard delivery message is shown." draft={draft} change={change}/>
      <TextField field="terms" title="Extra product-specific terms / eligibility" max={1200} rows={3} hint="Shown alongside the store's existing Terms & Conditions." draft={draft} change={change}/>
      {original.options?.length > 0 && <div className="rounded-xl border border-[color:var(--border)] p-4">
        <h3 className="font-bold">Edit plan names</h3>
        <p className="mt-1 text-xs text-slate-400">You can rename every plan. Its original internal ID and price settings remain linked. Use Edit prices to adjust costs.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">{original.options.map((o, index) => <label key={o.label} className="text-sm font-semibold">Plan {index + 1} (original: {o.label})
          <input className="field mt-1" maxLength={80} value={draft.optionLabels?.[index] || ""} onChange={(e) => change("optionLabels", draft.optionLabels.map((v, i) => index === i ? e.target.value : v))}/>
        </label>)}</div>
      </div>}
      <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={!!draft.popular} onChange={(e) => change("popular", e.target.checked)}/> Show Popular badge / homepage highlight</label>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => submit()} disabled={busy} className="btn-primary disabled:opacity-50">{busy ? "Saving..." : "Save product details"}</button>
        {saved[slug] && <button type="button" onClick={() => { if (confirm("Restore this product's original title, description, plans and other details? Prices and discounts will not be changed.")) submit(true); }} disabled={busy} className="btn-ghost disabled:opacity-50">Restore original details</button>}
        <a href={`/product/${slug}`} className="btn-ghost">View product page</a>
      </div>
      {message && <p role="status" className="text-sm" aria-live="polite">{message}</p>}
    </div>
    <div className="glass p-5"><h3 className="text-xl font-bold">Products with edited details ({Object.keys(saved).length})</h3>
      <div className="mt-3 space-y-2">{products.filter((p) => saved[p.slug]).map((p) => <button key={p.slug} type="button" onClick={() => setSlug(p.slug)} className="block w-full border-b border-[color:var(--border)] py-2 text-left text-sm hover:underline">{p.name} — {p.category}</button>)}
      {!Object.keys(saved).length && <p className="text-sm text-slate-400">All products currently use their original descriptions and details.</p>}</div>
    </div>
  </div>;
}
