import { useEffect,useMemo,useState } from 'react';
import { formatPrice } from '../utils/formatPrice';
import { brandIconSlug } from '../utils/brandFor';
import BrandIcon from './BrandIcon';
import { useDiscounts } from '../context/DiscountContext';
import { useStock } from '../context/StockContext';
import { brand } from '../config';
import { fetchGroupVariants, readCachedGroupVariants } from '../utils/catalogVariantCache';

export default function ImportedGroupDetails({slug,group,catalogReady=true}) {
  const importedSlug = group?.importedGroup?.slug || slug;
  const [items,setItems]=useState(() => readCachedGroupVariants(importedSlug) || []);
  const [status,setStatus]=useState(() => readCachedGroupVariants(importedSlug) ? 'ready' : (catalogReady && group && !group.importedGroup && group.legacyProducts?.length ? 'ready' : 'loading'));
  const [sort,setSort]=useState('price');
  const [catalogRevision,setCatalogRevision]=useState(0);
  useEffect(() => {
    const refresh = () => setCatalogRevision(value => value + 1);
    window.addEventListener('catalog-updated', refresh);
    return () => window.removeEventListener('catalog-updated', refresh);
  }, []);
  const {priceFor}=useDiscounts();
  const {isOut}=useStock();
  useEffect(()=>{
    let alive=true;
    const oldTitle=document.title;
    const description=document.querySelector('meta[name="description"]');
    const previous=description?.content;
    document.title=`${group?.brand||slug} Subscription Plans in Pakistan | ${brand.name}`;
    if(description) description.content=`Compare available ${group?.brand||slug} plans, durations and prices in PKR. Choose the right subscription from AI Tools PAK.`;
    return()=>{alive=false;document.title=oldTitle;if(description&&previous)description.content=previous};
  },[slug,group?.brand]);
  useEffect(()=>{
    let active=true;
    // Wait for the summary so legacy-only collections don't flash before
    // imported plans are known; skip the request for truly legacy-only brands.
    const cached=readCachedGroupVariants(importedSlug);
    if (cached) {setItems(cached);setStatus('ready');return()=>{active=false};}
    if (!catalogReady) {setStatus('loading');return()=>{active=false};}
    if (group && !group.importedGroup && group.legacyProducts?.length) {
      setItems([]);setStatus('ready');return()=>{active=false};
    }
    setItems([]);
    setStatus('loading');
    fetchGroupVariants(importedSlug)
      .then(variants=>{if(active){setItems(variants);setStatus('ready')}})
      .catch(()=>{if(active)setStatus(group?.legacyProducts?.length?'ready':'error')});
    return()=>{active=false};
  },[importedSlug,catalogReady,group?.importedGroup?.slug,group?.legacyProducts?.length,catalogRevision]);
  const legacy=group?.legacyProducts || [];
  const plans=useMemo(()=>{
    const entries=[...legacy.map(p=>({slug:p.slug,name:p.name,description:p.description,price:Math.min(...(p.options?.length?p.options.map(o=>priceFor(p,o).price):[priceFor(p).price])),duration:p.duration||'',unavailable:!!p.unavailable||isOut(p.slug),legacy:true,category:p.category})),
      ...items.map(p=>({slug:p.slug,name:p.name,description:p.description,price:p.finalPrice,duration:p.variant||'',unavailable:p.unavailable,needsConfirmation:!!p.needsConfirmation,restricted:!!p.restricted,legacy:false,category:p.category}))];
    return entries.sort((a,b)=>sort==='name'?a.name.localeCompare(b.name):sort==='high'?b.price-a.price:a.price-b.price);
  },[legacy,items,sort,priceFor,isOut]);
  const display=group?.brand || items[0]?.brand || slug.replaceAll('-',' ');
  const count=group?.count || plans.length;
  return <section className="mx-auto max-w-6xl px-5 py-8 lg:py-10">
    <nav aria-label="Breadcrumb" className="text-sm text-slate-400"><a href="/">Home</a> / <a href="/products">All tools</a> / <span>{display}</span></nav>
    <header className="mt-5 flex flex-wrap items-center gap-4">
      <BrandIcon name={group?.legacyProducts?.[0]?.slug||brandIconSlug(display)||slug} brandName={display} category={group?.category} size={68}/>
      <div><h1 className="text-3xl font-extrabold sm:text-4xl">{display} subscription plans</h1>
        <p className="mt-1 text-slate-400">{count} plan{count===1?'':'s'} in this collection · Prices in PKR</p></div>
    </header>
    <p className="mt-5 max-w-3xl text-slate-400">Compare package features, access type, duration and pricing. The exact access method, provider eligibility, and delivery terms depend on the selected plan.</p>
    <div className="mt-6 flex items-center justify-between gap-3"><h2 className="text-2xl font-bold">Choose your plan</h2>
      <label className="text-sm">Sort <select className="field ml-2" value={sort} onChange={e=>setSort(e.target.value)}><option value="price">Price: low to high</option><option value="high">Price: high to low</option><option value="name">Name A–Z</option></select></label></div>
    {status==='loading'&&<div role="status" aria-label="Loading plans" className="mt-4 grid gap-4 md:grid-cols-2">{Array.from({length:Math.min(4,Math.max(2,group?.count || 2))},(_,i)=><div key={i} className="glass min-h-40 animate-pulse p-5"><div className="h-5 w-2/3 rounded bg-[color:var(--surface-2)]"/><div className="mt-4 h-4 w-1/3 rounded bg-[color:var(--surface-2)]"/><div className="mt-5 h-8 w-24 rounded bg-[color:var(--surface-2)]"/></div>)}</div>}
    {status==='error'&&!legacy.length&&<p role="alert" className="mt-5">Plans are temporarily unavailable. Please try again later.</p>}
    {status==='ready'&&!plans.length&&<p className="mt-5">No listed plans are available right now.</p>}
    {status!=='loading'&&<div className="mt-4 grid gap-4 md:grid-cols-2">
      {plans.map(p=><article key={p.slug} className="glass flex min-w-0 flex-col gap-3 p-5">
        <h3 className="break-words text-lg font-bold">{p.name}</h3>
        {p.duration && <span className="chip self-start text-xs">{p.duration}</span>}
        <p className="line-clamp-4 flex-1 text-sm text-slate-400">{p.description||'See the plan page for details and access conditions.'}</p>
        {p.restricted&&<p className="text-xs text-amber-500">Listed for reference only; not available for ordering until eligibility is verified.</p>}
        {!p.restricted&&p.needsConfirmation&&<p className="text-xs text-amber-500">Confirm the plan terms before payment. Never share passwords or 2FA secrets.</p>}
        <div className="flex flex-wrap items-end justify-between gap-3"><span className="text-2xl font-extrabold">{formatPrice(p.price)}</span>
          <a href={`/product/${encodeURIComponent(p.slug)}`} className="btn-primary">View plan details</a></div>
      </article>)}
    </div>}
    <section className="mt-9 glass p-5 sm:p-6" aria-labelledby="collection-questions">
      <h2 id="collection-questions" className="text-xl font-bold">Questions about {display} plans</h2>
      <div className="mt-3 space-y-3 text-sm text-slate-400">
        <details><summary>How do I compare the plans?</summary><p className="mt-2">Open each package to compare its duration, access type, limits, conditions and final PKR price before ordering.</p></details>
        <details><summary>Are these official subscriptions?</summary><p className="mt-2">AI Tools PAK is an independent seller. Listings do not imply an official partnership or endorsement by the brand. Check each offer's eligibility and access conditions.</p></details>
        <details><summary>How will I receive my subscription?</summary><p className="mt-2">Delivery and activation vary by plan. Check the exact product details and confirm how access will be provided before making a payment. Never share your password or two-factor authentication secret.</p></details>
      </div>
    </section>
  </section>;
}
