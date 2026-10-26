import BrandIcon from "./BrandIcon";
import { useStock } from "../context/StockContext";
import { allCategories } from "../data/categories";
import SalePrice from "./SalePrice";
import { useDiscounts } from "../context/DiscountContext";

// Compact product link with the live price and stock status
export default function ProductMini({ product }) {
  const { isOut } = useStock();
  const { priceFor } = useDiscounts();
  const sale = priceFor(product);
  const { slug, name, category, options, duration, limit, price } = product;
  return (
    <a href={`/product/${slug}`} style={{ "--c": allCategories.find((c) => c.slug === category)?.color }} className="glass card-hover card-wash flex items-center gap-4 p-4">
      <BrandIcon name={slug} category={category} size={46} />
      <span className="min-w-0 flex-1">
        <span className="block font-bold leading-tight">{name}</span>
        <span className="mt-1 block text-xs text-slate-400">{isOut(slug) ? "Out of stock" : options ? "Several plans" : duration || limit}</span>
      </span>
      <span className="text-right font-bold">
        <SalePrice from={!!options} original={sale.original} price={sale.price} />
      </span>
    </a>
  );
}
