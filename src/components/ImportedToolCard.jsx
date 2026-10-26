import BrandIcon from './BrandIcon';
import { formatPrice } from '../utils/formatPrice';

export default function ImportedToolCard({group}) {
  return <a href={`/tool/${encodeURIComponent(group.slug)}`} className="catalog-perf-card glass card-wash flex min-w-0 flex-col p-5 no-underline" aria-label={`Compare ${group.count} ${group.brand} plans`}>
    <div className="flex items-center justify-between gap-3">
      <BrandIcon name={group.legacyProducts?.[0]?.slug || group.slug} brandName={group.brand} category={group.category} size={52}/>
      {(group.adminFeatured || group.featured) && <span className="chip text-xs">Featured</span>}
    </div>
    <h3 className="mt-4 break-words text-xl font-bold">{group.brand}</h3>
    <p className="mt-2 flex-1 text-sm text-slate-400">{group.count} plan{group.count === 1 ? '' : 's'} to compare</p>
    <div className="mt-4 text-xs text-slate-400">{group.priceIsEnquiryOnly ? "Listed from · confirm availability" : "Starting from · orderable plan"}</div>
    <strong className="text-2xl">{formatPrice(group.minPrice)}</strong>
    <span className="mt-4 font-semibold text-blue-500">Explore plans →</span>
  </a>;
}
