import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import ImportedToolCard from './ImportedToolCard';
import { allCategories } from '../data/categories';
import { sortCatalogGroups, buildCatalogGroups } from '../utils/catalogGroups';
import { selectCatalogCollections } from '../utils/catalogCategoryView';
import { formatPrice } from '../utils/formatPrice';
import { useProducts } from '../context/ProductContext';
import { useDiscounts } from '../context/DiscountContext';
import { useStock } from '../context/StockContext';

function Select({ value, onChange, label, options }) {
  return <select value={value} onChange={e => onChange(e.target.value)} aria-label={label} className="field">
    {options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}
  </select>;
}

// ONE card per tool/brand collection in every category, including All Products.
// Plan variants are displayed only after a customer opens /tool/:slug.
// The lightweight public group summaries already include the current plan count
// and starting price, so do not download every plan just to render this grid.
export default function ProductGrid({ category='all', setCategory, importedGroups=[], catalogGroups, catalogReady=true, catalogError=false, compactTop=false }) {
  const products = useProducts();
  const { priceFor, hasDiscount } = useDiscounts();
  const { isOut } = useStock();
  const [search, setSearch] = useState(() => new URLSearchParams(window.location.search).get('q') || '');
  const deferred = useDeferredValue(search);
  const [extra, setExtra] = useState([]);
  const [price, setPrice] = useState('all');
  const [duration, setDuration] = useState('all');
  const [sort, setSort] = useState('featured');
  const [apiProvider, setApiProvider] = useState('all');

  // Search plan names on the server only when necessary. Results are merged
  // into the same brand collections, never rendered as separate plan cards.
  useEffect(() => {
    const term = deferred.trim();
    if (!catalogReady || term.length < 2) { setExtra([]); return; }
    setExtra([]);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/catalog/groups?limit=200&search=${encodeURIComponent(term)}`, { signal:controller.signal })
        .then(response => { if (!response.ok) throw Error('Search unavailable'); return response.json(); })
        .then(data => { if (!controller.signal.aborted) setExtra(Array.isArray(data.groups) ? data.groups : []); })
        .catch(() => { if (!controller.signal.aborted) setExtra([]); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [deferred, catalogReady]);

  const groups = useMemo(() => {
    if (!extra.length && catalogGroups) return catalogGroups;
    const imported = new Map(importedGroups.map(group => [group.slug, group]));
    for (const group of extra) if (!imported.has(group.slug)) imported.set(group.slug, group);
    return buildCatalogGroups(products, [...imported.values()], { priceFor, hasDiscount, isOut });
  }, [catalogGroups, products, importedGroups, extra, priceFor, hasDiscount, isOut]);

  const apiProviders = useMemo(() => sortCatalogGroups(groups.filter(group => group.category === 'api-tools')), [groups]);
  const filtered = useMemo(() => selectCatalogCollections(groups, {
    search: deferred, category, apiProvider, price, duration, sort, extra,
  }), [groups, deferred, category, apiProvider, price, duration, sort, extra]);

  // Show all categories, including ones that would otherwise be outside a
  // horizontal-scroll row. The product cards are unique tools, not plan rows.
  const categoryChoices = useMemo(() => [
    { slug:'all', name:'All Products', count:groups.length },
    ...allCategories.map(item => ({
      ...item,
      count:groups.filter(group => item.slug === 'discounts' ? group.hasDiscount : group.category === item.slug).length,
    })),
  ], [groups]);
  useEffect(() => { setApiProvider('all'); }, [category]);
  useEffect(() => {
    const sync = () => setSearch(new URLSearchParams(window.location.search).get('q') || '');
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);
  const selectCategory = slug => {
    // Stay in the catalogue section. Remove narrowing filters so the selected
    // category actually shows all its tool collections.
    setSearch('');
    setPrice('all');
    setDuration('all');
    setSort('featured');
    setApiProvider('all');
    setCategory?.(slug);
  };

  return <section id="catalog" className={`mx-auto max-w-7xl px-5 ${compactTop ? 'pt-5 pb-10' : 'py-8 lg:py-10'}`}>
    <p className="eyebrow">Explore our tools</p>
    <h2 className="section-title">Product Catalogue</h2>
    <p className="mt-2 max-w-3xl text-sm text-slate-400">Every category is shown below. Choose one to see all its tools here; open a tool to compare individual plans.</p>
    <label htmlFor="product-search" className="sr-only">Search tools and brands</label>
    <input id="product-search" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tools and brands…" className="field mt-5" />
    <nav aria-label="Product categories" className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
      {categoryChoices.map(c => <button key={c.slug} type="button" onClick={() => selectCategory(c.slug)} aria-pressed={category === c.slug} className={`chip flex min-h-11 min-w-0 items-center justify-center gap-1 rounded-xl px-2 py-2 text-center text-sm whitespace-normal cursor-pointer ${category === c.slug ? 'chip-active' : ''}`}>
        <span>{c.name}</span><span className="text-xs opacity-75" aria-label={`${c.count} tools`}>({c.count})</span>
      </button>)}
    </nav>
    {category === 'api-tools' && <section className="mt-5" aria-labelledby="api-provider-heading">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div><h3 id="api-provider-heading" className="text-xl font-bold">Browse API categories</h3>
          <p className="mt-1 text-sm text-slate-400">Select an API provider to open its collection of plans.</p></div>
        <span className="text-xs text-slate-400">{apiProviders.reduce((sum, g) => sum + g.count, 0)} API plans in {apiProviders.length} provider groups</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" aria-label="API provider categories">
        <button type="button" aria-pressed={apiProvider === 'all'} className={`min-w-0 rounded-xl border p-3 text-left transition-colors ${apiProvider === 'all' ? 'border-blue-500 bg-blue-500/10' : 'border-[color:var(--border)] bg-[color:var(--surface-2)] hover:border-blue-400'}`} onClick={() => setApiProvider('all')}>
          <span className="block text-sm font-bold">All APIs</span><span className="mt-1 block text-xs text-slate-400">Every API provider</span>
        </button>
        {apiProviders.map(g => <button type="button" key={g.slug} aria-pressed={apiProvider === g.slug} className={`min-w-0 rounded-xl border p-3 text-left transition-colors ${apiProvider === g.slug ? 'border-blue-500 bg-blue-500/10' : 'border-[color:var(--border)] bg-[color:var(--surface-2)] hover:border-blue-400'}`} onClick={() => setApiProvider(g.slug)}>
          <span className="block truncate text-sm font-bold" title={g.brand}>{g.brand}</span>
          <span className="mt-1 block text-xs text-slate-400">{g.count} plan{g.count === 1 ? '' : 's'}</span>
          <span className="mt-1 block truncate text-xs font-semibold">{g.priceIsEnquiryOnly ? 'Listed from' : 'From'} {formatPrice(g.minPrice)}</span>
        </button>)}
      </div>
    </section>}
    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Select label="Price" value={price} onChange={setPrice} options={[["all","All prices"],["under1000","Under Rs. 1,000"],["mid","Rs. 1,000 – 2,500"],["high","Rs. 2,501 – 10,000"],["premium","Above Rs. 10,000"]]} />
      <Select label="Duration" value={duration} onChange={setDuration} options={[["all","Any duration"],["short","Up to 2 months"],["medium","3–6 months"],["long","1 year+"]]} />
      <Select label="Sort" value={sort} onChange={setSort} options={[["featured","Recommended first"],["low","Lowest price"],["high","Highest price"],["name-asc","Name A–Z"],["name-desc","Name Z–A"]]} />
    </div>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-slate-400" role="status" aria-live="polite">{catalogReady ? `Showing all ${filtered.length} unique tool${filtered.length === 1 ? '' : 's'} in ${categoryChoices.find(c => c.slug === category)?.name || 'this category'}` : 'Loading tools…'}</p>
      {!compactTop && <a href="/products" className="btn-ghost">Open full catalogue →</a>}
    </div>
    {catalogError && <p role="alert" className="mt-3 rounded-lg border border-amber-500/30 p-3 text-sm text-amber-600">Current catalogue prices could not be loaded. <button type="button" className="underline" onClick={() => window.dispatchEvent(new Event('catalog-updated'))}>Retry</button></p>}
    {!catalogReady && !catalogError ? <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" role="status" aria-label="Loading current catalogue prices">{Array.from({length:8}, (_, i) => <div className="glass h-52 animate-pulse p-5" key={i}><div className="h-10 w-10 rounded bg-[color:var(--surface-2)]"/><div className="mt-5 h-5 w-3/4 rounded bg-[color:var(--surface-2)]"/></div>)}</div>
      : catalogError ? null
      : !filtered.length ? <p className="glass mt-4 p-7 text-center text-slate-400">No matching tools. Try a different category or search.</p>
      : <>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map(group => <ImportedToolCard key={group.slug} group={group} />)}
        </div>
      </>}
  </section>;
}
