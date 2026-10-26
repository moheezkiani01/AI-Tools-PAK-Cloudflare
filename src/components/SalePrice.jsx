import { formatPrice } from "../utils/formatPrice";
export default function SalePrice({ original, price, from = false, className = "" }) {
  return <span className={className}>
    {from && <span className="mr-1 text-sm font-normal text-slate-400">From</span>}
    {price < original ? <span className="inline-flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <del className="text-base font-medium text-slate-400">{formatPrice(original)}</del>
      <span className="font-extrabold text-emerald-600 dark:text-emerald-400">{formatPrice(price)}</span>
    </span> : formatPrice(price)}
  </span>;
}
