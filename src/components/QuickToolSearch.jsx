import { useEffect, useMemo, useRef, useState } from 'react';
import BrandIcon from './BrandIcon';
import { sortCatalogGroups } from '../utils/catalogGroups';
import { formatPrice } from '../utils/formatPrice';
import { navigate } from '../utils/navigate';

const MAX_RESULTS = 7;
// Local suggestions are instant. Searching also asks the catalog API for
// approved brands beyond the homepage's 200-group summary.
export default function QuickToolSearch({catalogGroups = []}) {
  const [query, setQuery] = useState('');
  const [remote, setRemote] = useState([]);
  const [focused, setFocused] = useState(false);
  const [selected, setSelected] = useState(-1);
  const container = useRef(null);
  const cleaned = query.trim();
  useEffect(() => {
    setRemote([]);
    if (cleaned.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/catalog/groups?limit=120&search=${encodeURIComponent(cleaned)}`,{signal:controller.signal})
        .then(r => {if (!r.ok) throw Error('Search unavailable');return r.json();})
        .then(data => setRemote(Array.isArray(data.groups) ? data.groups : []))
        .catch(() => {if (!controller.signal.aborted) setRemote([]);});
    }, 230);
    return () => {clearTimeout(timer);controller.abort();};
  }, [cleaned]);
  useEffect(() => {setSelected(-1);}, [cleaned]);
  useEffect(() => {
    const dismiss = e => {if (!container.current?.contains(e.target)) setFocused(false);};
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, []);
  const results = useMemo(() => {
    if (!cleaned) return [];
    const lower = cleaned.toLocaleLowerCase();
    const map = new Map();
    for (const group of [...catalogGroups,...remote]) {
      if (!group?.slug) continue;
      if (`${group.brand||''} ${group.slug||''} ${(group.legacyProducts||[]).map(p=>p.name).join(' ')}`.toLocaleLowerCase().includes(lower)
        || remote.some(r => r.slug === group.slug)) map.set(group.slug, group);
    }
    return sortCatalogGroups([...map.values()]).slice(0,MAX_RESULTS);
  }, [cleaned, catalogGroups, remote]);
  const navigateTo = group => {setFocused(false);navigate(`/tool/${encodeURIComponent(group.slug)}`);};
  const submit = e => {
    e.preventDefault();
    if (!cleaned) {document.getElementById('quick-tool-search')?.focus();return;}
    if (selected >= 0 && results[selected]) {navigateTo(results[selected]);return;}
    setFocused(false);
    navigate(`/products?q=${encodeURIComponent(cleaned)}`);
  };
  return <section ref={container} aria-labelledby="quick-search-title" className="mx-auto max-w-7xl px-5 pt-7 pb-2 sm:pt-9">
    <div className="quick-search-shell relative overflow-visible rounded-2xl border border-[color:var(--border-strong)] p-4 sm:p-6">
      <div className="relative z-10 max-w-4xl">
        <span className="eyebrow">Instant tool search</span>
        <h2 id="quick-search-title" className="mt-1 text-xl font-extrabold tracking-tight sm:text-2xl">Find the right AI tool in seconds</h2>
        <p className="mt-1 text-sm text-slate-400">Search tools, subscription plans, brands and APIs, all in one place.</p>
        <form onSubmit={submit} role="search" className="mt-4 flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5" strokeLinecap="round"/></svg>
            <input id="quick-tool-search" value={query} type="search" autoComplete="off"
              onFocus={()=>setFocused(true)} onChange={e=>{setQuery(e.target.value);setFocused(true);}}
              onKeyDown={e=>{if(e.key==='ArrowDown'&&results.length){e.preventDefault();setSelected(i=>(i+1)%results.length);}else if(e.key==='ArrowUp'&&results.length){e.preventDefault();setSelected(i=>(i<=0?results.length-1:i-1));}else if(e.key==='Escape'){setFocused(false);setSelected(-1);}}}
              placeholder="Search ChatGPT, Canva, Claude API, design tools…"
              aria-label="Search AI tools and subscription plans"
              aria-controls="quick-search-results" aria-expanded={focused&&cleaned.length>0}
              className="field quick-search-input w-full py-3 pl-12 pr-4 text-base" />
          </div>
          <button type="submit" className="btn-primary min-h-12 shrink-0 px-7">Search tools →</button>
        </form>
        {focused && cleaned.length > 0 && <div id="quick-search-results" className="quick-search-results absolute left-4 right-4 top-full z-30 mt-2 overflow-hidden rounded-xl border border-[color:var(--border-strong)] bg-[color:var(--surface)] p-2 shadow-2xl sm:left-6 sm:right-auto sm:w-[min(720px,calc(100%-3rem))]" role="listbox" aria-label="Tool suggestions">
          {results.map((group,i)=><a role="option" aria-selected={selected===i} key={group.slug}
            href={`/tool/${encodeURIComponent(group.slug)}`}
            className={`flex items-center gap-3 rounded-lg p-2.5 no-underline ${selected===i?'bg-[color:var(--hover)]':'hover:bg-[color:var(--hover)]'}`}
            onClick={()=>setFocused(false)}>
            <BrandIcon name={group.legacyProducts?.[0]?.slug || group.slug} brandName={group.brand} category={group.category} size={36}/>
            <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{group.brand}</strong><span className="block text-xs text-slate-400">{group.count} plans · {group.category==='api-tools'?'AI APIs':'Tool collection'}</span></span>
            <strong className="shrink-0 text-sm">{group.priceIsEnquiryOnly ? "Listed" : "From"} {formatPrice(group.minPrice)}</strong>
          </a>)}
          {results.length===0 && <p className="p-3 text-sm text-slate-400">No matching brand yet. Search all subscription listings below.</p>}
          <button type="button" className="mt-1 w-full rounded-lg border-t border-[color:var(--border)] p-3 text-left text-sm font-semibold text-[color:var(--accent)] hover:bg-[color:var(--hover)]" onClick={()=>{setFocused(false);navigate(`/products?q=${encodeURIComponent(cleaned)}`);}}>View all results for “{cleaned}” →</button>
        </div>}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span>Popular searches:</span>
          {['ChatGPT','Canva','Claude','Gemini','API'].map(term=><button key={term} type="button" className="quick-search-tag" onClick={()=>{setQuery(term);setFocused(true);document.getElementById('quick-tool-search')?.focus();}}>{term}</button>)}
        </div>
      </div>
    </div>
  </section>;
}
