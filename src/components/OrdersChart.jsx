import { useEffect, useState } from "react";

export default function OrdersChart() {
  const [stats, setStats] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    fetch("/api/stats").then((r) => {
      if (!r.ok) throw new Error("Stats unavailable");
      return r.json();
    }).then(setStats).catch(() => setFailed(true));
  }, []);
  const max = Math.max(1, ...(stats?.days.map((day) => day.count) ?? [0]));
  return (
    <section id="orders" className="mx-auto max-w-7xl px-5 py-8 lg:py-10">
      <div className="glass p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="eyebrow">Activity</p><h2 className="section-title">Total Orders</h2>
            <p className="mt-2 text-sm text-slate-400">Website and other recorded orders. Bars show the last 14 days.</p>
          </div>
          <p className="text-6xl font-extrabold leading-none text-[color:var(--accent)]">{stats ? stats.total.toLocaleString("en-US") : "–"}</p>
        </div>
        {stats && (
          <div className="mt-4 flex flex-wrap gap-5 text-sm">
            <span><span aria-hidden="true" className="mr-2 inline-block h-3 w-3 rounded-sm bg-blue-500" />Website: <strong>{stats.website.toLocaleString("en-US")}</strong></span>
            <span><span aria-hidden="true" className="mr-2 inline-block h-3 w-3 rounded-sm bg-emerald-500" />WhatsApp / offline / other: <strong>{stats.other.toLocaleString("en-US")}</strong></span>
          </div>
        )}
        {failed ? <p className="mt-6 text-sm text-slate-400">Order stats are unavailable right now.</p> : (
          <div className="mt-6 flex h-40 items-end gap-1.5 sm:gap-3" role="img" aria-label="Website orders and other orders per day, last 14 days">
            {stats?.days.map((day) => (
              <div key={day.date} title={`${day.date}: Website ${day.website}, Other ${day.other}, Total ${day.count}`} className="flex h-full flex-1 flex-col items-center gap-1.5">
                <span className="h-4 text-xs text-slate-300">{day.count || ""}</span>
                <div className="flex w-full flex-1 items-end justify-center">
                  <div className="flex w-full max-w-9 flex-col overflow-hidden rounded-t-lg" style={{ height: `${Math.max((day.count / max) * 100, 3)}%`, opacity: day.count ? 1 : .25 }}>
                    {day.other > 0 && <div className="bg-emerald-500" style={{ flex: day.other }} />}
                    {day.website > 0 && <div className="bg-blue-500" style={{ flex: day.website }} />}
                    {!day.count && <div className="h-full bg-blue-500" />}
                  </div>
                </div>
                <span className="text-[10px] text-slate-500 sm:text-xs">{day.date.slice(8)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
