import { useEffect, useState } from "react";
import { usePageTitle } from "../utils/usePageTitle";

export default function CustomerFAQ() {
  usePageTitle("Customer FAQs");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/questions/public").then((res) => res.json())
      .then((result) => setItems(Array.isArray(result) ? result : []))
      .catch(() => {}).finally(() => setLoading(false));
  }, []);
  return (
    <section className="mx-auto max-w-3xl px-5 py-10">
      <p className="eyebrow">From our customers</p>
      <h1 className="section-title">Customer FAQs</h1>
      <p className="mt-3 text-sm text-slate-400">Answered questions shared by customers or added by the store. You can publish your own questions using your name or anonymously.</p>
      <div className="mt-6 space-y-3">
        {loading && <p className="text-sm text-slate-400">Loading questions...</p>}
        {!loading && !items.length && <p className="glass p-5 text-sm text-slate-400">No customer questions have been published yet.</p>}
        {items.map((item) => (
          <details key={item.id} className="glass p-5">
            <summary className="font-semibold">{item.question}</summary>
            <p className="mt-3 whitespace-pre-line text-sm text-slate-300">{item.answer}</p>
            <p className="mt-3 text-xs text-slate-400">{item.publishedBy === "store" ? "Added by the store" : "Shared by the customer"} · {item.name || "Anonymous"}</p>
          </details>
        ))}
      </div>
      <a href="/#faq" className="btn-primary mt-8 inline-flex">Ask a question</a>
    </section>
  );
}
