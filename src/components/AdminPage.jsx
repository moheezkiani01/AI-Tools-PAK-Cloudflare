import { useEffect, useState } from "react";
import AdminGlyph from "./AdminGlyph";
import { useProducts, useAllProducts } from "../context/ProductContext";
import AdminProducts from "./AdminProducts";
import AdminDiscounts from "./AdminDiscounts";
import AdminPrices from "./AdminPrices";
import AdminEditDetails from "./AdminEditDetails";
import AdminOrders from "./AdminOrders";
import AdminCatalogWorkspace from "./AdminCatalogWorkspace";
import AdminErrorBoundary from "./AdminErrorBoundary";
import AdminReviews from "./AdminReviews";
import AdminPurchaseNumbers from "./AdminPurchaseNumbers";

const navigation = [
  { title: "Workspace", items: [
    { id: "overview", name: "Overview", icon: "grid", caption: "Store at a glance" },
    { id: "orders", name: "Manual orders", icon: "receipt", caption: "Record sales" },
    { id: "questions", name: "Customer questions", icon: "chat", caption: "Answer & publish FAQs" },
    { id: "reviews", name: "Reviews", icon: "star", caption: "Customer feedback" },
  ] },
  { title: "Catalogue", items: [
    { id: "catalog", name: "All products", icon: "box", caption: "Manage original products and imported subscriptions together" },
    { id: "trash", name: "Deleted items / Restore", icon: "refresh", caption: "Restore products removed from the public catalogue" },
    { id: "products", name: "Stock & availability", icon: "box", caption: "Availability for every product" },
    { id: "details", name: "Product details", icon: "edit", caption: "Content & plans across your catalogue" },
    { id: "prices", name: "Edit prices", icon: "price", caption: "Legacy and imported prices" },
    { id: "discounts", name: "Discounts", icon: "tag", caption: "Offers across the entire store" },
    { id: "purchases", name: "Purchase numbers", icon: "key", caption: "Review verification" },
  ] },
];
const navItems = navigation.flatMap((group) => group.items);
const headers = (password) => ({ "Content-Type": "application/json", "x-admin-csrf": password });

// Turns 0300 1234567 into 923001234567 so the WhatsApp link works
const whatsappNumber = (value) => {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("0") ? `92${digits.slice(1)}` : digits;
};

export default function AdminPage() {
  // `password` is now a short-lived CSRF token, not the administrator's password.
  // The actual password only lives in this local sign-in input until submission.
  const [password, setPassword] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [checkingSession, setCheckingSession] = useState(true);
  const [questions, setQuestions] = useState(null); // null = not logged in
  const [error, setError] = useState("");
  const [tab, setTab] = useState("waiting");
  const [questionSearch, setQuestionSearch] = useState("");
  const [stats, setStats] = useState(null);
  const [catalogStats, setCatalogStats] = useState(null);
  const products = useProducts();
  const allProducts = useAllProducts();
  const [view, setView] = useState("overview"); // all admin sections
  const [detailSlug, setDetailSlug] = useState("");
  const [drafts, setDrafts] = useState({});
  const [faqModes, setFaqModes] = useState({});
  const [faqBusy, setFaqBusy] = useState(null);
  const [notes, setNotes] = useState({}); // error messages per question
  const [flash, setFlash] = useState(""); // "saved" message (the card moves to the Answered tab)

  const load = async (csrf = password) => {
    setError('');
    try {
      const res = await fetch('/api/admin/questions', { headers: headers(csrf), cache: 'no-store' });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || 'Could not load customer questions.');
      setQuestions(body);
    } catch (err) {
      setError(err.message);
      if (/session expired|sign in again/i.test(err.message)) {setPassword('');setQuestions(null);}
    }
  };
  const login = async () => {
    setError('');
    try {
      const response = await fetch('/api/admin/login', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({password:loginPassword}) });
      const result = await response.json().catch(() => ({}));
      if(!response.ok || !result.csrfToken) throw new Error(result.error || 'Sign in failed.');
      setLoginPassword('');
      setPassword(result.csrfToken);
      await load(result.csrfToken);
    } catch(err) {setError(err.message);}
  };
  useEffect(() => {
    // Clean up any raw password left in sessionStorage by the previous admin UI.
    try { sessionStorage.removeItem('adminPassword'); } catch {}
    let active=true;
    fetch('/api/admin/session',{cache:'no-store'})
      .then(async r => {if(!r.ok)return null;return r.json()})
      .then(session => {if(active && session?.csrfToken){setPassword(session.csrfToken);load(session.csrfToken);}})
      .catch(() => {})
      .finally(() => {if(active)setCheckingSession(false)});
    return () => {active=false};
  }, []);
  useEffect(() => {
    if (view !== "overview" || !questions) return;
    let active = true;
    fetch("/api/stats", { cache: "no-store" }).then((r) => {
      if (!r.ok) throw new Error("Statistics unavailable");
      return r.json();
    }).then((data) => { if (active) setStats(data); })
      .catch(() => { if (active) setStats(null); });
    return () => { active = false; };
  }, [view, questions]);

  useEffect(() => {
    if (view !== "overview" || !questions) return;
    let active = true;
    // The paginated catalogue query returns an exact count without loading
    // every imported product or building a separate catalogue-health panel.
    fetch("/api/admin/catalog?limit=1", { headers: headers(password), cache: "no-store" })
      .then(r => { if (!r.ok) throw new Error("Catalog count unavailable"); return r.json(); })
      .then(data => { if (active) setCatalogStats(Number.isSafeInteger(data.total) ? {total:data.total} : null); })
      .catch(() => { if (active) setCatalogStats(null); });
    return () => { active = false; };
  }, [view, questions, password]);

  const send = async (q) => {
    const answer = (drafts[q.id] ?? q.answer ?? "").trim();
    if (!answer) { setNotes((old) => ({ ...old, [q.id]: "Write an answer before saving." })); return; }
    setNotes((old) => ({ ...old, [q.id]: "" }));
    try {
      const res = await fetch(`/api/admin/questions/${encodeURIComponent(q.id)}/answer`, {
        method: "POST", headers: headers(password), body: JSON.stringify({ answer }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Could not save the answer.");
      setFlash(body.emailed ? "Answer saved and emailed to the customer." : "Answer saved privately. You can add it to Customer FAQs, or the customer can publish it themselves.");
      await load();
    } catch (err) { setNotes((old) => ({ ...old, [q.id]: err.message })); }
  };

  const publishFaq = async (q, unpublish = false) => {
    const mode = unpublish ? "unpublish" : (faqModes[q.id] || "anonymous");
    if (mode === "named" && !confirm("Has this customer agreed to show their name publicly? Only continue with their permission.")) return;
    if (!unpublish && !confirm("Publish this question and answer to Customer FAQs? Check that they contain no private information.")) return;
    setFaqBusy(q.id); setNotes((old) => ({ ...old, [q.id]: "" }));
    try {
      const res = await fetch(`/api/admin/questions/${encodeURIComponent(q.id)}/publish`, {
        method: "POST", headers: headers(password),
        body: JSON.stringify({ mode, customerConsented: mode === "named" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update Customer FAQs.");
      setFlash(unpublish ? "Removed from Customer FAQs." : "Question and answer added to Customer FAQs.");
      await load();
    } catch (err) { setNotes((old) => ({ ...old, [q.id]: err.message })); }
    finally { setFaqBusy(null); }
  };

  const remove = async (q) => {
    if (!confirm("Delete this question?")) return;
    try {
      const response = await fetch(`/api/admin/questions/${encodeURIComponent(q.id)}`, { method: "DELETE", headers: headers(password) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || "Could not delete this question.");
      setFlash("Question deleted.");
      await load();
    } catch (err) { setNotes((old) => ({ ...old, [q.id]: err.message })); }
  };

  const logout = async () => {
    try {await fetch('/api/admin/logout', {method:'POST',headers:headers(password)});} catch {}
    setPassword(''); setLoginPassword(''); setQuestions(null); setStats(null); setCatalogStats(null);
  };
  const openView = (next) => { setView(next); window.scrollTo({ top: 0, behavior: "instant" }); };

  if (checkingSession) return <main className="admin-login-shell" role="status" aria-live="polite"><div className="admin-login-card"><p>Checking your secure admin session…</p></div></main>;
  if (!questions) {
    return (
      <main className="admin-login-shell">
        <div className="admin-login-intro">
          <span className="admin-login-brand"><AdminGlyph name="grid" size={24} /> AI Tools PAK</span>
          <p className="admin-eyebrow mt-8">SECURE WORKSPACE</p>
          <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">Manage your store with confidence.</h1>
          <p className="mt-4 max-w-md text-sm text-[color:var(--text-3)]">Products, prices, discounts, orders and customer conversations, all in one place.</p>
          <div className="admin-login-benefits mt-7">
            <span><AdminGlyph name="box" /> Product catalogue</span>
            <span><AdminGlyph name="receipt" /> Sales & orders</span>
            <span><AdminGlyph name="chat" /> Customer care</span>
          </div>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); login(); }} className="admin-login-card">
          <span className="admin-icon-tile"><AdminGlyph name="key" size={23} /></span>
          <h2 className="mt-5 text-2xl font-extrabold">Admin sign in</h2>
          <p className="mt-2 text-sm text-[color:var(--text-3)]">Enter your store administrator password to continue.</p>
          <label className="mt-6 block text-sm font-semibold" htmlFor="admin-password">Admin password</label>
          <input id="admin-password" type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="Enter password" className="field mt-2" autoComplete="current-password" required />
          <button type="submit" className="btn-primary mt-5 w-full">Open dashboard <AdminGlyph name="arrow" /></button>
          {error && <p role="alert" className="admin-notice-error mt-4">{error}</p>}
          <p className="mt-5 text-xs text-[color:var(--text-3)]">Your password is not saved in browser storage. The secure session expires automatically.</p>
        </form>
      </main>
    );
  }

  const waiting = questions.filter((q) => !q.answer);
  const answered = questions.filter((q) => q.answer);
  const list = (tab === "waiting" ? waiting : answered).filter((q) =>
    [q.name, q.question, q.answer, q.email].some((value) => String(value || "").toLowerCase().includes(questionSearch.trim().toLowerCase()))
  );
  const published = answered.filter((q) => q.published).length;
  const activeItem = navItems.find((item) => item.id === view) || navItems[0];

  return (
    <main className="admin-workspace">
      <div className="admin-topline">
        <div className="flex min-w-0 items-center gap-3">
          <span className="admin-brand-icon"><AdminGlyph name="grid" size={20} /></span>
          <div className="min-w-0">
            <p className="font-extrabold tracking-tight">AI Tools PAK <span className="admin-brand-subtitle">/ Admin</span></p>
            <p className="text-xs text-[color:var(--text-3)]">Store management workspace</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <a className="admin-outline-button" href="/" target="_blank" rel="noreferrer"><AdminGlyph name="external" /> <span className="hidden sm:inline">View store</span></a>
          <button onClick={logout} className="admin-outline-button" title="Log out" type="button"><AdminGlyph name="logout" /><span className="hidden sm:inline">Log out</span></button>
        </div>
      </div>
      <div className="admin-frame">
        <aside className="admin-sidebar" aria-label="Admin sections" tabIndex={0}>
          <p className="admin-sidebar-title">WORKSPACE</p>
          {navigation.map((group) => (
            <div key={group.title} className="admin-nav-group">
              <p className="admin-nav-heading">{group.title}</p>
              {group.items.map((item) => (
                <button key={item.id} type="button" onClick={() => openView(item.id)} aria-current={view === item.id ? "page" : undefined} className={`admin-nav-link ${view === item.id ? "admin-nav-active" : ""}`}>
                  <AdminGlyph name={item.icon} size={19} />
                  <span className="flex-1 text-left">{item.name}</span>
                  {item.id === "questions" && waiting.length > 0 && <span className="admin-nav-count">{waiting.length}</span>}
                </button>
              ))}
            </div>
          ))}
          <div className="admin-sidebar-tip"><AdminGlyph name="lock" /><span>Changes are saved to your existing store database.</span></div>
        </aside>
        <div className="admin-content min-w-0">
          <div className="admin-mobile-nav">
            <label htmlFor="admin-section-picker">Manage section</label>
            <select id="admin-section-picker" className="field mt-2" value={view} onChange={(e) => openView(e.target.value)}>
              {navigation.map((group) => (
                <optgroup label={group.title} key={group.title}>
                  {group.items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          <header className="admin-section-header">
            <div>
              <p className="admin-eyebrow">ADMIN / {view === "overview" ? "DASHBOARD" : activeItem.name.toUpperCase()}</p>
              <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">{view === "overview" ? "Dashboard overview" : activeItem.name}</h1>
              <p className="mt-2 text-sm text-[color:var(--text-3)]">{view === "overview" ? "Your store performance and shortcuts, at a glance." : activeItem.caption}</p>
            </div>
            {view === "questions" && <button type="button" className="admin-outline-button" onClick={() => load()}><AdminGlyph name="refresh" /> Refresh</button>}
          </header>

          {error && <p role="alert" className="admin-notice-error mb-4">{error}</p>}
          {view === "overview" && (
            <div className="admin-overview space-y-6">
              <div className="admin-stat-grid">
                {[
                  { name: "Total orders", number: stats?.total, icon: "receipt", note: "Recorded orders", target: "orders" },
                  { name: "Website orders", number: stats?.website, icon: "grid", note: "Online sales", target: "orders" },
                  { name: "Awaiting response", number: waiting.length, icon: "chat", note: "Customer questions", target: "questions" },
                  { name: "Products", number: catalogStats ? allProducts.filter(p=>!p.imported).length + catalogStats.total : null, icon: "box", note: "Original + imported subscriptions", target: "catalog" },
                ].map((item) => (
                  <button key={item.name} className="admin-stat" onClick={() => openView(item.target)} type="button">
                    <span className="admin-stat-top"><span className="admin-stat-icon"><AdminGlyph name={item.icon} size={20} /></span><AdminGlyph name="arrow" size={16} /></span>
                    <span className="admin-stat-value">{item.number == null ? "—" : item.number.toLocaleString("en-PK")}</span>
                    <span className="admin-stat-name">{item.name}</span>
                    <span className="admin-stat-note">{item.note}</span>
                  </button>
                ))}
              </div>
              <section className="admin-overview-panel">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><h2 className="text-lg font-extrabold">Quick actions</h2><p className="mt-1 text-sm text-[color:var(--text-3)]">Jump straight into everyday store tasks.</p></div>
                </div>
                <div className="admin-quick-grid mt-5">
                  {[
                    { id: "orders", title: "Record an order", note: "Add a past or new sale", icon: "receipt" },
                    { id: "catalog", title: "Manage entire catalogue", note: "Original + imported products", icon: "box" },
                    { id: "trash", title: "Restore deleted products", note: "Open deleted items and restore a listing", icon: "refresh" },
                    { id: "details", title: "Edit product details", note: "Names, duration and features", icon: "edit" },
                    { id: "prices", title: "Update prices", note: "Change regular selling prices", icon: "price" },
                    { id: "discounts", title: "Create an offer", note: "Apply a discount to products", icon: "tag" },
                    { id: "purchases", title: "Issue a purchase number", note: "Enable customer reviews", icon: "key" },
                    { id: "reviews", title: "Manage reviews", note: "Review customer feedback", icon: "star" },
                  ].map((item) => <button key={item.id} type="button" onClick={() => openView(item.id)} className="admin-quick-link"><span className="admin-quick-icon"><AdminGlyph name={item.icon} /></span><span className="min-w-0 flex-1"><strong>{item.title}</strong><small>{item.note}</small></span><AdminGlyph name="arrow" size={16}/></button>)}
                </div>
              </section>
              <div className="admin-overview-panel admin-attention flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-start gap-3"><span className="admin-attention-icon"><AdminGlyph name="chat" /></span><div><h2 className="font-extrabold">Customer support inbox</h2><p className="mt-1 text-sm text-[color:var(--text-3)]">{waiting.length} awaiting an answer · {answered.length} answered · {published} in Customer FAQs</p></div></div>
                <button type="button" className="btn-primary text-sm" onClick={() => openView("questions")}>Open inbox <AdminGlyph name="arrow" size={16}/></button>
              </div>
            </div>
          )}
          <div className={view === "questions" ? "admin-questions" : "hidden"}>
            <div className="admin-inbox-toolbar">
              <div className="admin-inbox-tabs" role="group" aria-label="Question status">
                <button type="button" onClick={() => setTab("waiting")} aria-pressed={tab === "waiting"} className={tab === "waiting" ? "is-active" : ""}>Waiting <span>{waiting.length}</span></button>
                <button type="button" onClick={() => setTab("answered")} aria-pressed={tab === "answered"} className={tab === "answered" ? "is-active" : ""}>Answered <span>{answered.length}</span></button>
              </div>
              <div className="admin-inbox-search"><AdminGlyph name="search" /><input aria-label="Search customer questions" placeholder="Search questions or names" value={questionSearch} onChange={(e) => setQuestionSearch(e.target.value)} /></div>
            </div>
      {flash && <p role="status" className="mt-4 rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400">{flash}</p>}
      {list.length === 0 && <p className="admin-empty mt-4">No questions match this view. Try another status or search.</p>}
      <ul className="mt-5 space-y-4">
        {list.map((q) => (
          <li key={q.id} className="admin-question-card">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
              <span><strong className="text-sm text-[color:var(--text)]">{q.name}</strong> · {new Date(q.date).toLocaleString()}</span>
              <span>{[q.email, q.whatsapp].filter(Boolean).join(" · ") || "No contact details"}</span>
            </div>
            <p className="mt-3 font-semibold">{q.question}</p>
            {q.answer && <p className="mt-1 text-xs text-slate-400">{q.published ? `Published as ${q.displayName || "Anonymous"} in Customer FAQs` : "Private — not published in Customer FAQs"}</p>}
            <textarea rows={3} value={drafts[q.id] ?? q.answer} onChange={(e) => setDrafts({ ...drafts, [q.id]: e.target.value })} placeholder="Write your answer" className="field mt-3" />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button onClick={() => send(q)} className="btn-primary text-sm">{q.answer ? "Update answer" : "Send answer"}</button>
              {q.answer && q.whatsapp && (
                <a href={`https://wa.me/${whatsappNumber(q.whatsapp)}?text=${encodeURIComponent(`Hello ${q.name}, we have answered your question on our website: ${q.answer}`)}`} target="_blank" rel="noreferrer" className="btn-ghost text-sm">Tell them on WhatsApp</a>
              )}
              <button onClick={() => remove(q)} className="ml-auto text-sm text-red-600 hover:underline dark:text-red-400">Delete</button>
            </div>
            {q.answer && (
              <div className="admin-faq-box mt-4 p-4">
                <p className="mb-2 text-sm font-semibold">Customer FAQ publication</p>
                <p className="mb-3 text-xs text-slate-400">You may publish answered questions, including older ones. Check for private details. Only display the customer's name if they have consented. Store-published FAQs are labeled publicly.</p>
                <div className="flex flex-wrap items-end gap-2">
                  <label className="text-xs">Publish as
                    <select className="field mt-1" value={faqModes[q.id] || "anonymous"} onChange={(e) => setFaqModes((old) => ({ ...old, [q.id]: e.target.value }))}>
                      <option value="anonymous">Anonymous</option>
                      <option value="named">Customer name (with consent)</option>
                    </select>
                  </label>
                  <button type="button" className="btn-primary text-xs" disabled={faqBusy === q.id} onClick={() => publishFaq(q)}>{q.published ? "Update Customer FAQ" : "Add to Customer FAQs"}</button>
                  {q.published && <button type="button" className="btn-ghost text-xs" disabled={faqBusy === q.id} onClick={() => publishFaq(q, true)}>Remove from Customer FAQs</button>}
                </div>
              </div>
            )}
            {notes[q.id] && <p role="status" className="mt-2 text-sm text-slate-400">{notes[q.id]}</p>}
          </li>
        ))}
      </ul>
          </div>
          <AdminErrorBoundary key={view}>
          {["catalog", "trash", "products", "discounts", "prices"].includes(view) && <AdminCatalogWorkspace
            mode={view === "products" ? "stock" : view} password={password}
            onNavigate={openView}
            onEdit={(slug) => { setDetailSlug(slug); openView("details"); }} />}
          {view === "details" && <AdminEditDetails password={password} initialSlug={detailSlug} />}
          {view === "orders" && <AdminOrders password={password} />}
          {view === "reviews" && <AdminReviews password={password} />}
          {view === "purchases" && <AdminPurchaseNumbers password={password} />}
          </AdminErrorBoundary>
        </div>
      </div>
    </main>
  );
}
