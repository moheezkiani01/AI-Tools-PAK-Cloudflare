import { useEffect,useState } from 'react';
import { formatPrice } from '../utils/formatPrice';
import Icon from './Icon';
import BrandIcon from './BrandIcon';
import { brandIconSlug } from '../utils/brandFor';

function ToolCard({group}) {
 return <a href={`/tool/${group.slug}`} className="glass card-hover card-wash flex min-h-56 flex-col p-5 no-underline" aria-label={`Explore ${group.brand} subscriptions`}>
   <div className="flex items-center justify-between gap-3"><BrandIcon name={brandIconSlug(group.brand)||group.slug} category={group.category} size={48}/>
   {group.featured&&<span className="chip">Featured</span>}</div>
   <h3 className="mt-4 truncate text-xl font-bold" title={group.brand}>{group.brand}</h3>
   <p className="mt-1 flex-1 text-sm text-slate-400">{group.count} listed plan{group.count===1?'':'s'} · Compare options</p>
   <p className="mt-4 text-xl font-extrabold">{group.availableCount ? "From" : "Listed from"} {formatPrice(group.minPrice)}</p>
   <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-400">Explore plans <Icon name="arrow-right" size={16}/></span>
 </a>;
}
export default function ImportedGroups({home=false,categorySlug="all"}) {
 const [list,setList]=useState([]),[page,setPage]=useState(1),[total,setTotal]=useState(0),[search,setSearch]=useState(''),[cat,setCat]=useState(categorySlug),[state,setState]=useState('loading');
 useEffect(()=>{let active=true;setState('loading');fetch(`/api/catalog/groups?limit=${home?8:12}&page=${page}&category=${encodeURIComponent(cat)}&search=${encodeURIComponent(search)}`).then(r=>{if(!r.ok)throw Error('Catalog unavailable');return r.json()}).then(d=>{if(active){setList(d.groups||[]);setTotal(d.total||0);setState('ready')}}).catch(()=>{if(active)setState('error')});return()=>{active=false}},[home,page,cat,search]);
 useEffect(()=>{setCat(categorySlug);setPage(1)},[categorySlug]);
 const cats=[['all','All tools'],['ai-tools','AI chat'],['creative-tools','Design & video'],['developer-tools','Coding'],['productivity','Productivity'],['marketing-tools','Marketing & SEO'],['entertainment','Entertainment'],['discounts','Discounts']];
 return <section id="tool-collections" className="mx-auto max-w-7xl px-5 py-8 lg:py-10">
   <p className="eyebrow">Browse by brand</p>
   <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="section-title">{home?'Explore AI tool collections':'All tool collections'}</h2><a className="btn-ghost" href="/tools">View all collections</a></div>
   <p className="mt-2 text-sm text-slate-400">One tool, multiple plans. Compare listed plans in one place. Some plans require eligibility or availability confirmation.</p>
   {!home&&<><input className="field mt-5" type="search" aria-label="Search tool collections" placeholder="Search brands and products" value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}}/>
   <div className="mt-3 flex gap-2 overflow-x-auto pb-2">{cats.map(([id,title])=><button key={id} className={`chip shrink-0 ${id===cat?'chip-active':''}`} onClick={()=>{setCat(id);setPage(1)}}>{title}</button>)}</div></>}
   {state==='error'&&<p role="alert" className="mt-4 text-sm text-amber-500">New catalog temporarily unavailable. Existing products remain accessible below.</p>}
   {state==='loading'&&<p role="status" className="mt-4 text-sm text-slate-400">Loading tool collections…</p>}
   {state==='ready'&&list.length>0&&<div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{list.map(g=><ToolCard key={g.slug} group={g}/>)}</div>}
   {!home&&state==='ready'&&list.length===0&&<p className="glass mt-5 p-8 text-center text-slate-400">No approved plans match your search yet.</p>}
   {!home&&total>12&&<div className="mt-7 flex items-center justify-center gap-4"><button disabled={page===1} className="btn-ghost disabled:opacity-40" onClick={()=>setPage(n=>n-1)}>Previous</button><span className="text-sm text-slate-400">Page {page} / {Math.ceil(total/12)}</span><button disabled={page*12>=total} className="btn-ghost disabled:opacity-40" onClick={()=>setPage(n=>n+1)}>Next</button></div>}
 </section>;
}
