import { useEffect, useState } from "react";
import Icon, { Stars } from "./Icon";

const emptyForm = { token: "", name: "", rating: 5, comment: "", website: "" };

export default function Reviews({ slug }) {
  const [data, setData] = useState({ count: 0, average: 0, reviews: [] });
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadReviews = () => fetch(`/api/reviews/${encodeURIComponent(slug)}`).then((r) => r.json()).then(setData).catch(() => {});
  useEffect(() => { setForm(emptyForm); setMessage(null); loadReviews(); }, [slug]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true); setMessage(null);
    try {
      if (!form.token.trim()) { setMessage({ ok: false, text: "A purchase number is required to submit your review." }); setSaving(false); return; }
      const res = await fetch("/api/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, slug }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Review could not be saved.");
      setMessage({ ok: true, text: "Thank you! Your review is published." });
      setForm(emptyForm);
      await loadReviews();
      window.dispatchEvent(new Event("reviews-updated"));
    } catch (error) { setMessage({ ok: false, text: error.message || "Could not reach the server. Please try again." }); }
    finally { setSaving(false); }
  };

  return (
    <section className="glass p-6">
      <h2 className="text-xl font-bold">Ratings &amp; Reviews</h2>
      {data.count > 0 ? (
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-300"><Stars value={data.average} /> {data.average} out of 5 ({data.count} review{data.count === 1 ? "" : "s"})</p>
      ) : <p className="mt-2 text-sm text-slate-400">No reviews yet. Be the first to share your experience.</p>}
      <p className="mt-3 text-xs text-slate-400">Website reviews require a valid, unused purchase number. Feedback entered by the store is identified separately.</p>

      <form onSubmit={submit} className="mt-6 space-y-4 border-t border-[color:var(--border)] pt-5">
        <h3 className="text-lg font-bold">Write a review</h3>
        <label className="block text-sm">Your name<input name="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Enter your name" maxLength={60} className="field mt-1" required /></label>
        <fieldset>
          <legend className="text-sm">Your rating</legend>
          <div className="mt-2 flex gap-2 text-amber-400">
            {[1, 2, 3, 4, 5].map((n) => (
              <button type="button" key={n} aria-label={`${n} star${n > 1 ? "s" : ""}`} aria-pressed={form.rating === n} onClick={() => setForm({ ...form, rating: n })} className="rounded-md p-1 transition hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400">
                <Icon name="star" size={30} fill={n <= form.rating ? "currentColor" : "none"} />
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-400">Selected: {form.rating} out of 5</p>
        </fieldset>
        <label className="block text-sm">Your comment<textarea name="comment" minLength={5} maxLength={500} value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} rows={4} placeholder="Tell others about your experience with this product" className="field mt-1" required /></label>
        <label className="block text-sm">Purchase number (required)<input name="token" value={form.token} onChange={(e) => setForm({ ...form, token: e.target.value })} placeholder="Enter the purchase number provided by the store" maxLength={80} autoComplete="off" className="field mt-1" required /><span className="mt-1 block text-xs text-slate-400">Ask the store for your purchase number if you do not have one. Each number can be used once for its product.</span></label>
        <div className="hidden" aria-hidden="true"><label>Website<input tabIndex={-1} name="website" autoComplete="off" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></label></div>
        <button type="submit" disabled={saving} className="btn-primary">{saving ? "Submitting…" : "Submit Review"}</button>
        {message && <p role="status" className={`text-sm ${message.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>{message.text}</p>}
      </form>

      <h3 className="mt-8 text-lg font-bold">Customer feedback ({data.count})</h3>
      <ul className="mt-4 space-y-3">
        {data.reviews.map((r, i) => (
          <li key={r.id || i} className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-2)] p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2"><strong>{r.name}</strong><Stars value={r.rating} size={16} /></div>
            <p className="mt-1 text-xs text-slate-400">{r.date ? new Date(r.date).toLocaleDateString() : ""}{" · " + (r.source === "customer" || r.source === "website_admin" ? "Submitted on the website" : r.source === "whatsapp" ? "WhatsApp feedback (entered by store)" : r.source === "offline" ? "In-person feedback (entered by store)" : "Shared with the store")}{r.source === "website_admin" && <span className="ml-1 text-[11px] text-slate-500">(recorded by store)</span>}</p>
            {r.comment && <p className="mt-2 whitespace-pre-wrap break-words text-slate-300">{r.comment}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
