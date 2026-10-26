import BrandIcon from './BrandIcon';
import { sortCatalogGroups } from '../utils/catalogGroups';

// Moving brand strip uses the real combined catalogue, not a fixed mock list.
// Duplicate items are visual only; the copy is hidden from assistive technologies.
export default function LogoStrip({ catalogGroups = [] }) {
  const featured = sortCatalogGroups(catalogGroups).slice(0, 14);
  if (!featured.length) return null;
  const items = (copy = false) => featured.map(group => <a key={`${copy ? 'copy-' : ''}${group.slug}`}
    tabIndex={copy ? -1 : undefined} href={`/tool/${encodeURIComponent(group.slug)}`}
    className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap text-sm font-semibold text-slate-400 no-underline transition-colors hover:text-[color:var(--text)]">
    <BrandIcon name={group.legacyProducts?.[0]?.slug || group.slug} brandName={group.brand} category={group.category} size={30}/>
    <span>{group.brand}</span>
  </a>);
  return <div className="brand-marquee border-y border-[color:var(--border)] bg-[color:var(--surface-2)]/60 py-3" aria-label="Featured AI tool brands">
    <div className="brand-marquee-track">
      <div className="brand-marquee-set">{items()}</div>
      <div className="brand-marquee-set" aria-hidden="true">{items(true)}</div>
    </div>
  </div>;
}
