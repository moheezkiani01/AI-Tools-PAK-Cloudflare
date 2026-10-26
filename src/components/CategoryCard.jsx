import Icon from './Icon';
import BrandIcon from './BrandIcon';
import { sortCatalogGroups } from '../utils/catalogGroups';
import { formatPrice } from '../utils/formatPrice';

// Keep the original category-led layout, but list each brand once with its plan count and starting price.
export default function CategoryCard({ category, catalogGroups = [], large = false, className = '' }) {
  const matching = sortCatalogGroups(catalogGroups.filter(g => category.slug === 'discounts' ? g.hasDiscount : g.category === category.slug));
  const shown = matching.slice(0, 3);
  return (
    <article style={{'--c':category.color}} className={`glass card-wash flex h-full min-w-0 flex-col p-4 sm:p-5 ${className}`}>
      <a href={`/${category.slug}`} className="group inline-flex min-w-0 flex-col items-start no-underline">
        <span className="tile"><Icon name={category.slug} size={22}/></span>
        <h3 className={`mt-3 font-bold text-xl`}>{category.title}</h3>
        <p className="mt-1 text-sm text-slate-400">{category.tools}</p>
      </a>
      <div className="mt-3 flex flex-1 flex-col gap-2">
        {shown.map(group => (
          <a key={group.slug} href={`/tool/${encodeURIComponent(group.slug)}`} className="flex min-w-0 items-center gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-2)] p-2.5 no-underline hover:border-[color:var(--border-strong)]">
            <BrandIcon name={group.legacyProducts[0]?.slug || group.slug} brandName={group.brand} category={group.category} size={38}/>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold">{group.brand}</span>
              <span className="block text-xs text-slate-400">{group.count} plan{group.count===1?'':'s'}</span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-[10px] text-slate-400">{group.priceIsEnquiryOnly ? "Listed" : "From"}</span>
              <span className="block text-xs font-bold sm:text-sm">{formatPrice(group.minPrice)}</span>
            </span>
          </a>
        ))}
        {!shown.length && <span className="text-sm text-slate-400">Browse available tools in this category.</span>}
      </div>
      <a href={`/${category.slug}`} className="mt-3 flex items-center justify-between gap-2 border-t border-[color:var(--border)] pt-3 text-sm font-semibold no-underline" style={{color:category.color}}>
        <span>Explore {matching.length} tool{matching.length===1?'':'s'}</span><span aria-hidden="true">→</span>
      </a>
    </article>
  );
}
