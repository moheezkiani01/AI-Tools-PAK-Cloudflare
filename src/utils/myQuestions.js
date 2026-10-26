// Keep private question-management keys in the visitor's own browser only.
const KEY = "myQuestions";
export const getMine = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
};
const saveMine = (list) => {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {}
  window.dispatchEvent(new Event("my-questions"));
};
export const addMine = (item) => saveMine([item, ...getMine()]);
export const removeMine = (id) => saveMine(getMine().filter((q) => q.id !== id));
export const updateMine = (id, changes) => saveMine(getMine().map((q) => q.id === id ? { ...q, ...changes } : q));
export const markSeen = () => saveMine(getMine().map((q) => ({ ...q, seen: true })));

export async function refreshMine() {
  const list = getMine().slice(0, 20);
  if (!list.length) return;
  try {
    const res = await fetch("/api/questions/status", {
      method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
      body: JSON.stringify({ questions: list.map((q) => ({ id: q.id, manageKey: q.manageKey })) }),
    });
    if (!res.ok) return;
    const updates = Object.fromEntries((await res.json()).map((q) => [q.id, q]));
    let changed = false;
    const updated = getMine().map((q) => {
      const data = updates[q.id];
      if (!data) return q;
      const answer = data.answer || "";
      const seen = !q.answer && answer ? false : q.seen;
      if (q.answer !== answer || q.published !== data.published || q.displayName !== data.displayName || q.publishedBy !== data.publishedBy || q.seen !== seen) changed = true;
      return { ...q, answer, seen, published: data.published, displayName: data.displayName, publishedBy: data.publishedBy, legacy: data.legacy };
    });
    if (changed) saveMine(updated);
  } catch {}
}
