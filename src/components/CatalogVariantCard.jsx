import BrandIcon from './BrandIcon';
import { formatPrice } from '../utils/formatPrice';

// Product listing only: every imported variant has its own entry on /products.
// The detail page and backend remain responsible for checking ordering eligibility.
export default function CatalogVariantCard({product}) {
  return <article className="catalog-perf-card glass card-wash flex min-w-0 flex-col gap-3 p-4 sm:p-5">
    <div className="flex min-w-0 items-center gap-3">
      <BrandIcon name={product.icon || product.slug} brandName={product.brand} category={product.category} size={44}/>
      <div className="min-w-0">
        <a href={`/tool/${encodeURIComponent(product.groupSlug)}`} className="block truncate text-xs font-medium text-slate-400 hover:text-blue-500">{product.brand}</a>
        <span className="text-xs text-slate-400">{product.duration || 'Subscription plan'}</span>
      </div>
    </div>
    <h3 className="line-clamp-2 min-h-[3rem] break-words text-base font-bold">{product.name}</h3>
    <p className="line-clamp-2 flex-1 break-words text-xs text-slate-400">{product.description || 'Open the plan for exact terms and features.'}</p>
    <div className="mt-auto">
      <p className="text-xl font-extrabold">{formatPrice(product.price)}</p>
      {product.restricted ? <p className="mt-1 text-xs font-medium text-amber-600">Enquiry only · eligibility not verified</p> : product.unavailable ? <p className="mt-1 text-xs font-medium text-amber-600">Currently unavailable · confirm stock</p> : <p className="mt-1 text-xs text-emerald-600">Listed as available · confirm before payment</p>}
    </div>
    <a href={`/product/${encodeURIComponent(product.slug)}${product.optionIndex===null||product.optionIndex===undefined?"":`?plan=${product.optionIndex}`}`} className="btn-ghost mt-auto block text-center text-sm">View plan details</a>
  </article>;
}
