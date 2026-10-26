import { useEffect, useMemo, useState } from "react";

const today = () => new Date(Date.now() + 5 * 3600000).toISOString().slice(0, 10);
const headers = (password) => ({ "Content-Type": "application/json", "x-admin-csrf": password });
const format = (n) => Number(n || 0).toLocaleString("en-US");

export default function AdminOrders({ password }) {
  const [entries, setEntries] = useState([]);
  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatus, setOrderStatus] = useState("All");
  const [websiteOrders, setWebsiteOrders] = useState([]);
  const visibleOrders = useMemo(() => websiteOrders.filter(o => (orderStatus==="All" || (o.status||"Pending")===orderStatus) && `${o.number} ${o.customer?.name||""} ${o.customer?.email||""} ${(o.items||[]).map(i=>i.name).join(" ")}`.toLowerCase().includes(orderSearch.toLowerCase())), [websiteOrders,orderSearch,orderStatus]);
  const [stats, setStats] = useState(null);
  const [form, setForm] = useState({ date: today(), count: 1, source: "WhatsApp", note: "" });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const res = await fetch("/api/admin/manual-orders", { headers: headers(password), cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load orders.");
      setEntries(data.entries);
      const websiteRes = await fetch("/api/admin/website-orders", { headers: headers(password), cache: "no-store" });
      const websiteData = await websiteRes.json();
      if (!websiteRes.ok) throw new Error(websiteData.error || "Could not load website checkouts.");
      setWebsiteOrders(websiteData.orders || []);
      setStats(data.stats);
    } catch (err) { setMessage(err.message); }
  };
  useEffect(() => { load(); }, [password]);

  const add = async (e) => {
    e.preventDefault();
    setBusy(true); setMessage("");
    try {
      const res = await fetch("/api/admin/manual-orders", { method: "POST", headers: headers(password), body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save orders.");
      setForm({ ...form, count: 1, note: "" });
      setMessage("Orders added successfully. The public Total Orders chart has been updated.");
      await load();
    } catch (err) { setMessage(err.message); }
    finally { setBusy(false); }
  };

  const remove = async (entry) => {
    if (!confirm(`Remove ${entry.count} manually entered orders for ${entry.date}?`)) return;
    try {
      const res = await fetch(`/api/admin/manual-orders/${entry.id}`, { method: "DELETE", headers: headers(password) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not remove entry.");
      setMessage("Entry removed.");
      await load();
    } catch (err) { setMessage(err.message); }
  };

  const updateOrder = async (number, status) => {
    setMessage("");
    try {
      const res = await fetch(`/api/admin/website-orders/${encodeURIComponent(number)}`, {
        method: "PATCH", headers: headers(password), body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update order.");
      setMessage(`${number} marked as ${status}.`);
      await load();
    } catch (err) { setMessage(err.message); }
  };

  return (
    <div className="mt-6 space-y-6">
      <section className="space-y-3">
        <h2 className="text-xl font-bold">Website checkout orders</h2>
        <p className="text-sm text-slate-400">Latest 200 orders saved by customers at checkout. These records stay in the cloud database, not GitHub.</p>
        <div className="mb-4 grid gap-3 sm:grid-cols-2"><label className="text-sm">Search orders<input className="field mt-1" value={orderSearch} onChange={e=>setOrderSearch(e.target.value)} placeholder="Order number, customer, item" /></label><label className="text-sm">Status<select className="field mt-1" value={orderStatus} onChange={e=>setOrderStatus(e.target.value)}>{["All","Pending","Completed","Cancelled"].map(s=><option key={s}>{s}</option>)}</select></label></div>
        {visibleOrders.length === 0 ? <p className="text-sm text-slate-400">No website orders match these filters.</p> : (
          <div className="space-y-3">{visibleOrders.map((order) => (
            <div key={order.number} className="glass p-4 space-y-2">
              <div className="flex flex-wrap justify-between gap-2">
                <strong>{order.number}</strong>
                <span className="text-sm">{order.status || "Pending"} · {format(order.total)} PKR</span>
              </div>
              <p className="text-sm">{order.customer?.name} · {order.customer?.email} · {order.customer?.whatsapp}</p>
              <p className="text-xs text-slate-400">{order.date ? new Date(order.date).toLocaleString("en-PK") : ""}</p>
              <p className="text-sm text-slate-300">{(order.items || []).map((item) => `${item.name} ${item.label || ""} ×${item.qty}`).join(", ")}</p>
              {order.customer?.notes && <p className="text-sm">Note: {order.customer.notes}</p>}
              <div className="flex flex-wrap gap-2">
                {order.status !== "Completed" && <button className="btn-primary text-sm" type="button" onClick={() => updateOrder(order.number, "Completed")}>Mark completed</button>}
                {order.status !== "Pending" && <button className="text-sm underline" type="button" onClick={() => updateOrder(order.number, "Pending")}>Set pending</button>}
                {order.status !== "Cancelled" && <button className="text-sm underline" type="button" onClick={() => updateOrder(order.number, "Cancelled")}>Cancel order</button>}
              </div>
            </div>
          ))}</div>
        )}
      </section>
      <p className="text-sm text-slate-400">Record actual orders received through WhatsApp, in person, or elsewhere. Use the original order date, including older dates. Choose Website for a completed sale placed through the website but missing from your automatic checkout records. These entries appear as Website in the public chart. Do not record the same website checkout twice. WhatsApp button taps alone are not considered confirmed orders.</p>
      <div className="grid grid-cols-3 gap-3">
        {[["Total", stats?.total], ["Website", stats?.website], ["Other sources", stats?.other]].map(([label, value]) => (
          <div key={label} className="glass p-4"><p className="text-xs text-slate-400">{label}</p><p className="mt-1 text-2xl font-extrabold">{value == null ? "—" : format(value)}</p></div>
        ))}
      </div>
      <form onSubmit={add} className="glass space-y-4 p-5">
        <h2 className="text-xl font-bold">Add past or current orders</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">Order date<input type="date" className="field mt-1" value={form.date} max={today()} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></label>
          <label className="text-sm">Number of orders<input type="number" min="1" max="10000" step="1" className="field mt-1" value={form.count} onChange={(e) => setForm({ ...form, count: e.target.value })} required /></label>
          <label className="text-sm">Source<select className="field mt-1" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}><option>WhatsApp</option><option>Offline</option><option>Other</option><option value="Website">Website</option></select></label>
        </div>
        {form.source === "Website" && <p className="text-xs text-amber-700 dark:text-amber-400">Only add website orders that were not already recorded at checkout, to avoid counting orders twice.</p>}
        <label className="block text-sm">Internal note (optional)<input className="field mt-1" maxLength={160} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="e.g. Orders recorded from October sales" /></label>
        <button type="submit" disabled={busy} className="btn-primary">{busy ? "Saving…" : "Add Orders"}</button>
      </form>
      {message && <p role="status" className="text-sm text-[color:var(--text)]">{message}</p>}
      <h2 className="text-lg font-bold">Manual order history</h2>
      {entries.length === 0 ? <p className="text-sm text-slate-400">No manual order entries yet.</p> : (
        <ul className="space-y-2">{entries.map((entry) => (
          <li key={entry.id} className="glass flex items-center justify-between gap-3 p-4">
            <div><strong>{format(entry.count)} order{entry.count === 1 ? "" : "s"}</strong><p className="text-xs text-slate-400">{entry.date} · {entry.source}{entry.note ? ` · ${entry.note}` : ""}</p></div>
            <button type="button" onClick={() => remove(entry)} className="text-sm text-red-600 dark:text-red-400 hover:underline">Remove</button>
          </li>
        ))}</ul>
      )}
    </div>
  );
}
