import { useRef, useState } from "react";
import Icon from "./Icon";
import BrandIcon from "./BrandIcon";
import { useCart } from "../context/CartContext";
import { useProducts } from "../context/ProductContext";
import { formatPrice } from "../utils/formatPrice";
import { orderOnWhatsApp, whatsappLink } from "../utils/whatsapp";
import { paymentAccounts } from "../config";
import { useDiscounts } from "../context/DiscountContext";

const modes = [
  { id: "here", icon: "box", title: "Order here", text: "Fill in your details and we will message you on WhatsApp." },
  { id: "whatsapp", icon: "chat", title: "Order on WhatsApp", text: "Open WhatsApp with your order ready to send." },
];

const Field = ({ label, hint, ...props }) => (
  <label className="block text-sm font-medium text-slate-300">
    {label}
    <input className="field mt-1 font-normal" {...props} />
    {hint && <span className="mt-1 block text-xs font-normal text-slate-500">{hint}</span>}
  </label>
);

// "active" = how many steps are highlighted (Cart, Your details, Confirmation)
function Stepper({ active }) {
  const steps = ["Cart", "Your details", "Confirmation"];
  return (
    <ol className="flex items-center gap-1 text-[10px] min-[400px]:gap-2 min-[400px]:text-xs sm:text-sm">
      {steps.map((step, i) => (
        <li key={step} className="flex items-center gap-1 min-[400px]:gap-2">
          <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${i < active ? "bg-[#2563eb] text-white" : "bg-[color:var(--surface-2)] text-slate-400"}`}>{i + 1}</span>
          <span className={i < active ? "font-semibold" : "text-slate-400"}>{step}</span>
          {i < steps.length - 1 && <span className="mx-0.5 h-px w-3 bg-[color:var(--border-strong)] sm:mx-1 sm:w-10" />}
        </li>
      ))}
    </ol>
  );
}

export default function Checkout() {
  const products = useProducts();
  const { items, total, clearCart, changeQty, removeItem } = useCart();
  const { ready: pricesReady } = useDiscounts();
  const [mode, setMode] = useState("here");
  const [form, setForm] = useState({ name: "", email: "", whatsapp: "", notes: "" });
  const [order, setOrder] = useState(null);
  const requestId = useRef(crypto.randomUUID());
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedValue, setCopiedValue] = useState("");
  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const itemsText = items.map((i) => `${i.name}${i.label ? ` (${i.label})` : ""} x${i.qty}`).join(", ");
  const whatsappMessage = `Hello, I want to purchase ${itemsText} for ${formatPrice(total)}.${form.name ? ` My name is ${form.name}.` : ""}${form.notes ? ` Notes: ${form.notes}` : ""}`;

  const submit = async (e) => {
    e.preventDefault();
    if (!pricesReady) { setError("Could not confirm current prices. Please wait, then try again."); return; }
    if (mode === "whatsapp") { orderOnWhatsApp(whatsappMessage, itemsText); return; }

    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json", "x-idempotency-key": requestId.current }, body: JSON.stringify({ customer: form, items: items.map(({ key, qty }) => ({ key, qty })) }) });
      const body = await res.json().catch(() => null); // an empty reply means our order system is not running
      if (!res.ok || !body?.order) throw Object.assign(new Error(body?.error), { fromServer: !!body?.error });
      setOrder(body.order);
      clearCart();
    } catch (err) {
      setError(err.fromServer ? err.message : "We could not reach our order system right now. Please order on WhatsApp instead, it only takes a moment.");
    }
    setSending(false);
  };

  const copy = (value) => {
    navigator.clipboard?.writeText(value);
    setCopiedValue(value);
    setTimeout(() => setCopiedValue(""), 2000);
  };

  const copyNumber = () => {
    navigator.clipboard?.writeText(order.number);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (order) {
    const message = `Hello, my order number is ${order.number}. Please share the payment details.`;
    const next = ["Order received", "You pay using the details above (or the ones we send on WhatsApp)", "You pay and we confirm it", "We share your access details"];
    return (
      <div className="mx-auto max-w-2xl px-5 py-9 text-center">
        <div className="flex justify-center"><Stepper active={3} /></div>
        <span className="pop-in mx-auto mt-10 grid h-20 w-20 place-items-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
          <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path className="check-draw" d="M5 13l4 4L19 7" /></svg>
        </span>
        <h1 className="mt-6 text-4xl font-extrabold">Order Received Successfully</h1>
        <p className="mt-3 text-slate-300">Thank you{form.name ? `, ${form.name.split(" ")[0]}` : ""}! Your order number is</p>
        <div className="mt-3 inline-flex items-center gap-3 rounded-2xl border border-dashed border-[color:var(--border-strong)] px-5 py-3">
          <span className="text-3xl font-extrabold tracking-wider text-[color:var(--accent)]">{order.number}</span>
          <button onClick={copyNumber} className="chip cursor-pointer text-xs">{copied ? "Copied" : "Copy"}</button>
        </div>
        <p className="mt-3 text-sm text-slate-400">Total: {formatPrice(order.total)}</p>
        <div className="glass mx-auto mt-8 max-w-md space-y-3 p-5 text-left text-sm">
          <p className="text-base font-bold">Payment details</p>
          {paymentAccounts.map((a) => (
            <div key={a.method} className="rounded-xl bg-[color:var(--surface-2)] p-3">
              <p className="font-semibold">{a.method}</p>
              <p className="text-slate-400">Account name: {a.name}</p>
              <p className="mt-1 text-xs text-slate-400">{a.label}</p>
              <div className="flex items-center justify-between gap-2">
                <span className="break-all font-bold">{a.value}</span>
                <button type="button" onClick={() => copy(a.value)} className="chip shrink-0 cursor-pointer text-xs">{copiedValue === a.value ? "Copied" : "Copy"}</button>
              </div>
            </div>
          ))}
          <p className="text-slate-400">Binance: we share the details on WhatsApp. After paying, send the proof on WhatsApp with your order number.</p>
        </div>
        <ol className="glass mx-auto mt-8 max-w-md space-y-3 p-5 text-left text-sm">
          {next.map((text, i) => (
            <li key={text} className="flex items-start gap-3">
              <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${i === 0 ? "bg-emerald-500 text-white" : "bg-[color:var(--surface-2)] text-slate-400"}`}>{i === 0 ? "✓" : i + 1}</span>
              <span className={i === 0 ? "font-semibold" : "text-slate-300"}>{text}</span>
            </li>
          ))}
        </ol>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a href={whatsappLink(message)} target="_blank" rel="noreferrer" className="btn-primary">Message us on WhatsApp</a>
          <a href="/" className="btn-ghost">Back to Shop</a>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return <p className="mx-auto max-w-xl px-5 py-12 text-center text-slate-300">Your cart is empty. <a href="/" className="text-[color:var(--accent)] underline">Browse products</a></p>;
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <h1 className="text-4xl font-extrabold">Checkout</h1>
      <div className="mt-5"><Stepper active={2} /></div>

      <form onSubmit={submit} className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label="How would you like to order?">
            {modes.map((m) => (
              <button type="button" key={m.id} onClick={() => setMode(m.id)} aria-pressed={mode === m.id}
                className={`glass flex items-start gap-3 p-4 text-left transition ${mode === m.id ? "ring-2 ring-[#2563eb]" : "opacity-80 hover:opacity-100"}`}>
                <span className="tile" style={m.id === "whatsapp" ? { "--c": "#22c55e" } : undefined}><Icon name={m.icon} /></span>
                <span>
                  <span className="block font-bold">{m.title}</span>
                  <span className="mt-0.5 block text-sm text-slate-400">{m.text}</span>
                </span>
              </button>
            ))}
          </div>

          <div className="glass space-y-4 p-6">
            <Field label="Full Name" name="name" autoComplete="name" value={form.name} onChange={update} required={mode === "here"} placeholder={mode === "whatsapp" ? "Optional" : ""} />
            {mode === "here" && (
              <>
                <Field label="Email" name="email" type="email" autoComplete="email" value={form.email} onChange={update} required />
                <Field label="WhatsApp Number" name="whatsapp" type="tel" inputMode="tel" autoComplete="tel" value={form.whatsapp} onChange={update} required placeholder="e.g. 0300 1234567" hint="We will message you on this number with the payment details." />
              </>
            )}
            <label className="block text-sm font-medium text-slate-300">Order Notes (optional)
              <textarea name="notes" value={form.notes} onChange={update} rows={3} className="field mt-1 font-normal" />
            </label>
            {mode === "whatsapp" && (
              <p className="rounded-xl bg-[color:var(--surface-2)] p-3 text-sm text-slate-400">WhatsApp will open with your order already typed. Just press send, and we will reply with the payment details.</p>
            )}
          </div>
        </div>

        <aside className="glass card-wash h-fit space-y-4 p-6 lg:sticky lg:top-24">
          <h2 className="text-xl font-bold">Your order</h2>
          <ul className="space-y-4">
            {items.map((i) => {
              const product = products.find((p) => p.slug === i.key.split("|")[0]);
              return (
                <li key={i.key} className="flex items-center gap-3">
                  <BrandIcon name={product?.slug} category={product?.category} size={42} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{i.name}</span>
                    {i.label && <span className="block text-xs text-slate-400">{i.label}</span>}
                    <span className="mt-1 flex items-center gap-2 text-xs">
                      <button type="button" onClick={() => changeQty(i.key, -1)} aria-label="Decrease quantity" className="chip h-6 w-6 !p-0">−</button>
                      {i.qty}
                      <button type="button" onClick={() => changeQty(i.key, 1)} aria-label="Increase quantity" className="chip h-6 w-6 !p-0">+</button>
                      <button type="button" onClick={() => removeItem(i.key)} className="ml-2 text-red-600 hover:underline dark:text-red-400">Remove</button>
                    </span>
                  </span>
                  <span className="text-right text-sm font-bold">{i.originalPrice > i.price && <del className="block text-xs text-slate-400">{formatPrice(i.originalPrice * i.qty)}</del>}{formatPrice(i.price * i.qty)}</span>
                </li>
              );
            })}
          </ul>
          <p className="flex justify-between border-t border-[color:var(--border)] pt-4 text-lg font-extrabold"><span>Total</span><span>{formatPrice(total)}</span></p>

          <ol className="space-y-2 rounded-xl bg-[color:var(--surface-2)] p-4 text-sm text-slate-300">
            <li><strong>1.</strong> Place your order, or message us on WhatsApp.</li>
            <li><strong>2.</strong> We reply on WhatsApp with the payment details.</li>
            <li><strong>3.</strong> Once payment is confirmed, we share your access details.</li>
          </ol>

          {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button type="submit" disabled={sending || !pricesReady} className="btn-primary w-full disabled:opacity-60" style={mode === "whatsapp" ? { background: "#22c55e", color: "#052e16" } : undefined}>
            {sending ? "Placing order..." : mode === "whatsapp" ? "Continue on WhatsApp" : "Place Order"}
          </button>
          {error && mode === "here" && <button type="button" onClick={() => setMode("whatsapp")} className="btn-ghost w-full">Switch to Order on WhatsApp</button>}

          <ul className="space-y-2 border-t border-[color:var(--border)] pt-4 text-sm text-slate-400">
            {[["lock", "Secure ordering"], ["chat", "WhatsApp support, 24 hours"], ["box", "Digital delivery after payment is confirmed"]].map(([icon, text]) => (
              <li key={text} className="flex items-center gap-2"><span className="text-[color:var(--accent)]"><Icon name={icon} size={16} /></span>{text}</li>
            ))}
          </ul>
        </aside>
      </form>
    </div>
  );
}
