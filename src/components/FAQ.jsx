import { useEffect, useState } from "react";
import { addMine, getMine, refreshMine, removeMine, updateMine } from "../utils/myQuestions";

const faqs = [
  ["What happens after I place an order?", "You get an order number and we message you on WhatsApp with the payment details. Once payment is confirmed, delivery starts."],
  ["How will I receive my product?", "Access details are shared through WhatsApp or email once payment is confirmed."],
  ["How long does delivery take?", "Within 10 minutes after your payment is confirmed."],
  ["What payment methods do you accept?", "JazzCash, UBL bank transfer and Binance. We share the payment details when you order."],
  ["Can I order multiple products?", "Yes. Add as many products as you like to the cart and check out once."],
  ["What happens if I have a problem with my subscription?", "Message us on WhatsApp with your order number and we will help. Availability, account eligibility, features and terms can depend on the underlying provider."],
  ["Can I change my plan?", "Contact us on WhatsApp. Plan changes depend on availability and the provider's terms."],
];

const emptyForm = { name: "", email: "", whatsapp: "", question: "" };

export default function FAQ() {
  const [mine, setMine] = useState(getMine);
  const [form, setForm] = useState(emptyForm);
  const [sending, setSending] = useState(false);
  const [actions, setActions] = useState({});
  const [names, setNames] = useState({});
  const [message, setMessage] = useState(null); // { ok, text }

  useEffect(() => {
    const sync = () => setMine(getMine());
    window.addEventListener("my-questions", sync);
    refreshMine();
    return () => window.removeEventListener("my-questions", sync);
  }, []);

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setSending(true);
    setMessage(null);
    try {
      const res = await fetch("/api/questions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.id) throw Object.assign(new Error(body?.error), { fromServer: !!body?.error });
      addMine({ id: body.id, manageKey: body.manageKey, question: form.question.trim(), date: new Date().toISOString(), answer: "", seen: true, published: false });
      const emailNote = body.emailEnabled && form.email ? " We will email you the answer too." : "";
      setMessage({ ok: true, text: `Thank you! We will answer soon. You will see a notification on this site when it is answered.${emailNote}` });
      setForm(emptyForm);
    } catch (err) {
      setMessage({ ok: false, text: err.fromServer ? err.message : "We could not send your question right now. Please try again, or ask us on WhatsApp." });
    }
    setSending(false);
  };

  const publish = async (q) => {
    setActions((old) => ({ ...old, [q.id]: "Saving..." }));
    try {
      let manageKey = q.manageKey;
      // Older questions already stored in this browser have a random legacy ID.
      // Claim that ID once and upgrade to modern private-key management.
      if (!manageKey) {
        const claim = await fetch(`/api/questions/${encodeURIComponent(q.id)}/claim`, { method: "POST" });
        const claimed = await claim.json();
        if (!claim.ok) throw new Error(claimed.error || "Could not unlock this older question.");
        manageKey = claimed.manageKey;
        updateMine(q.id, { manageKey, legacy: false });
      }
      const mode = names[q.id] || (q.published && q.displayName !== "Anonymous" ? "named" : "anonymous");
      const res = await fetch(`/api/questions/${encodeURIComponent(q.id)}/publish`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manageKey, mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not publish this question.");
      updateMine(q.id, { manageKey, published: true, displayName: data.displayName, publishedBy: "customer", legacy: false });
      setActions((old) => ({ ...old, [q.id]: "Saved in Customer FAQs." }));
    } catch (err) { setActions((old) => ({ ...old, [q.id]: err.message })); }
  };

  const remove = async (q) => {
    const confirmText = q.published
      ? "Remove this question from Your questions? Its published question and answer will REMAIN visible in Customer FAQs."
      : "Delete this private question and its answer permanently?";
    if (!confirm(confirmText)) return;
    if (!q.manageKey) {
      removeMine(q.id);
      return;
    }
    setActions((old) => ({ ...old, [q.id]: "Deleting..." }));
    try {
      const res = await fetch(`/api/questions/${q.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ manageKey: q.manageKey }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not delete this question.");
      removeMine(q.id);
    } catch (err) { setActions((old) => ({ ...old, [q.id]: err.message })); }
  };

  return (
    <section id="faq" className="mx-auto max-w-3xl px-5 py-8 lg:py-10">
      <p className="eyebrow">FAQ</p>
      <h2 className="section-title">Frequently Asked Questions</h2>

      <div className="mt-6 space-y-3">
        {faqs.map(([question, answer]) => (
          <details key={question} className="glass p-5">
            <summary>{question}</summary>
            <p className="mt-3 text-sm text-slate-300">{answer}</p>
          </details>
        ))}

      </div>

      <div className="glass mt-5 flex flex-wrap items-center justify-between gap-3 p-5">
        <div><h3 className="text-lg font-bold">Customer FAQs</h3><p className="mt-1 text-sm text-slate-400">Real customer questions shared by choice, with names or anonymously.</p></div>
        <a href="/customer-faq" className="btn-ghost text-sm">Read Customer FAQs →</a>
      </div>

      <div className="glass card-wash mt-6 p-6">
        <h3 className="text-xl font-bold">Ask your own question</h3>
        <p className="mt-1 text-sm text-slate-400">Cannot find your answer? Ask us. We will reply here and you will get a notification when it is answered.</p>
        <form onSubmit={submit} className="mt-5 space-y-3">
          <input name="name" value={form.name} onChange={update} placeholder="Your name" className="field" required maxLength={60} autoComplete="name" />
          <div className="grid gap-3 sm:grid-cols-2">
            <input name="email" type="email" value={form.email} onChange={update} placeholder="Email (optional)" className="field" autoComplete="email" />
            <input name="whatsapp" type="tel" value={form.whatsapp} onChange={update} placeholder="WhatsApp (optional)" className="field" autoComplete="tel" />
          </div>
          <textarea name="question" value={form.question} onChange={update} rows={3} placeholder="Type your question" className="field" required minLength={5} maxLength={500} />
          <button type="submit" disabled={sending} className="btn-primary disabled:opacity-60">{sending ? "Sending..." : "Send Question"}</button>
          {message && <p role="status" className={`text-sm ${message.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>{message.text}</p>}
        </form>
      </div>

      {mine.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-bold">Your questions</h3>
          <p className="mt-1 text-xs text-slate-400">Answers stay private unless you choose to publish them. Keep using this browser to manage your questions. Do not include personal, payment or account details in questions you publish.</p>
          <ul className="mt-3 space-y-3">
            {mine.map((q) => (
              <li key={q.id} className="glass p-4 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold">{q.question}</p>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${q.answer ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-amber-500/15 text-amber-700 dark:text-amber-400"}`}>{q.answer ? "Answered" : "Waiting"}</span>
                </div>
                {q.answer && <p className="mt-2 whitespace-pre-line text-slate-300">{q.answer}</p>}
                {q.answer && (
                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[color:var(--border)] pt-3">
                    <label className="text-xs">Show in Customer FAQs as
                      <select className="field mt-1" value={names[q.id] || (q.published && q.displayName !== "Anonymous" ? "named" : "anonymous")} onChange={(e) => setNames((old) => ({ ...old, [q.id]: e.target.value }))}>
                        <option value="anonymous">Anonymous</option><option value="named">My name</option>
                      </select>
                    </label>
                    <button type="button" className="btn-primary text-xs" disabled={actions[q.id] === "Saving..."} onClick={() => publish(q)}>{q.published ? "Update Customer FAQ" : "Publish in Customer FAQs"}</button>
                    {q.published && <span className="text-xs text-emerald-600 dark:text-emerald-400">Public as {q.displayName}{q.publishedBy === "store" ? " (published by store)" : ""}</span>}
                  </div>
                )}
                {q.answer && !q.manageKey && <p className="mt-2 text-xs text-slate-400">Older question: publishing will securely upgrade it to the new question management system in this browser.</p>}
                <div className="mt-3 flex items-center justify-between gap-3">
                  <button type="button" className="text-xs text-red-600 hover:underline dark:text-red-400" onClick={() => remove(q)}>{q.published ? "Remove from Your questions (keep public FAQ)" : q.manageKey ? "Delete private question" : "Remove from this browser"}</button>
                  {actions[q.id] && <span role="status" className="text-xs text-slate-400">{actions[q.id]}</span>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
