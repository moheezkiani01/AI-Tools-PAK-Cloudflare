export default function Breadcrumbs({ items }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-slate-400">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map(([label, href], i) => (
          <li key={href} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden="true">/</span>}
            {i < items.length - 1 ? <a href={href} className="hover:underline">{label}</a> : <span className="max-w-[14rem] truncate text-slate-300 sm:max-w-none" aria-current="page">{label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
