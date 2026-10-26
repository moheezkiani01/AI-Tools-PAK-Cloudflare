import { useEffect, useMemo, useState } from 'react';
import Icon from './Icon';
import BrandIcon from './BrandIcon';
import { needs, recommendedForNeed } from '../utils/toolRecommendations';
import { formatPrice } from '../utils/formatPrice';

const PER_PAGE = 8;
// Every eligible non-API brand is reachable here. Buttons filter the complete
// group list instead of limiting customers to four hand-picked products.
export default function ToolFinder({ catalogGroups = [] }) {
  const [active, setActive] = useState(0);
  const [shown, setShown] = useState(PER_PAGE);
  const picks = useMemo(() => recommendedForNeed(catalogGroups, needs[active], Number.POSITIVE_INFINITY), [catalogGroups, active]);
  useEffect(() => setShown(PER_PAGE), [active]);
  return <section id="finder" className="mx-auto max-w-7xl px-5 pt-5 pb-8 sm:pt-6 sm:pb-10">
    <p className="eyebrow">Find your tool</p>
    <h2 className="section-title">What do you want to do?</h2>
    <p className="mt-2 text-sm text-slate-400">Explore all tool collections by what you want to accomplish. API subscriptions have their own dedicated category.</p>
    <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Find tools by purpose">
      {needs.map((need, i) => <button type="button" key={need.label} onClick={() => setActive(i)} aria-pressed={i===active}
        className={`chip flex cursor-pointer items-center gap-2 px-4 py-2 text-sm transition ${i===active?'chip-active':'hover:bg-[color:var(--hover)]'}`}>
        <Icon name={need.icon} size={16}/>{need.label}
      </button>)}
    </div>
    <div className="mt-4 flex items-center justify-between gap-3 text-sm text-slate-400">
      <span>{picks.length} matching tool collection{picks.length===1?'':'s'}</span>
      <a href="/api-tools" className="font-semibold text-[color:var(--accent)] no-underline">Browse AI APIs →</a>
    </div>
    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {picks.slice(0,shown).map(group => <a key={group.slug} href={`/tool/${encodeURIComponent(group.slug)}`}
        className="glass card-wash fade-up flex min-w-0 flex-col gap-3 p-4 transition-colors hover:border-[color:var(--border-strong)]">
        <div className="flex items-start justify-between gap-2">
          <BrandIcon name={group.legacyProducts?.[0]?.slug || group.slug} brandName={group.brand} category={group.category} size={48}/>
          <span className="text-right"><span className="block text-[11px] text-slate-400">{group.priceIsEnquiryOnly ? "Listed" : "From"}</span><strong className="text-sm sm:text-base">{formatPrice(group.minPrice)}</strong></span>
        </div>
        <div><strong className="block text-base">{group.brand}</strong><span className="mt-1 block text-xs text-slate-400">{group.count} plan{group.count===1?'':'s'} · Explore options</span></div>
      </a>)}
    </div>
    {shown < picks.length && <div className="mt-5 text-center"><button type="button" className="btn-ghost" onClick={() => setShown(n=>Math.min(n+PER_PAGE,picks.length))}>Show more tools ({picks.length-shown} remaining)</button></div>}
    {!picks.length && <p className="glass mt-4 p-5 text-sm text-slate-400">No tools match this purpose yet. Try All tools.</p>}
    <p className="mt-4 text-xs text-slate-500">Collections are ordered by editorial relevance, not unverified sales counts. Compare individual plans before ordering.</p>
  </section>;
}
