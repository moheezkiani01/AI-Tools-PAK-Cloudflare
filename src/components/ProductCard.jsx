import { navigate } from "../utils/navigate";
import { Stars } from "./Icon";
import BrandIcon from "./BrandIcon";
import { brandIconSlug } from "../utils/brandFor";
import { memo } from "react";
import { useCartActions } from "../context/CartContext";
import { useStock } from "../context/StockContext";
import { whatsappLink } from "../utils/whatsapp";
import { allCategories } from "../data/categories";
import SalePrice from "./SalePrice";
import { useDiscounts } from "../context/DiscountContext";

function ProductCard({ product, rating }) {
  const { addItem, setIsOpen } = useCartActions();
  const out = useStock().isOut(product.slug) || !!product.unavailable;
  const { priceFor } = useDiscounts();
  const sale = priceFor(product);
  const { slug, name, description, duration, limit, price, options, popular } = product;
  const category = allCategories.find((c) => c.slug === product.category);
  const color = category?.color;
  const terms = options ? options.map((o) => o.label).join(" / ") : duration;
  const detailsLink = `/product/${slug}`;

  // Products with several plans send the customer to the details page to pick one
  const addToCart = () => {
    if (options) { navigate(detailsLink); return; }
    addItem(product);
    setIsOpen(true);
  };
  const buyNow = () => {
    if (options) { navigate(detailsLink); return; }
    addItem(product);
    navigate("/checkout");
  };

  return (
    <article style={{ "--c": color }} className="catalog-perf-card glass card-hover card-wash fade-up relative flex flex-col p-5">
      {sale.onSale && !out && <span className="absolute right-4 top-4 rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold text-white">{sale.rule?.type === "percent" ? `${sale.rule.value}% OFF` : "SALE"}</span>}
      {popular && !out && !sale.onSale && <span className="absolute right-4 top-4 rounded-full bg-[#2563eb] px-3 py-1 text-xs font-semibold text-white">Popular</span>}
      <div className="flex items-center gap-3">
        <BrandIcon name={brandIconSlug(product.brand)||slug} category={product.category} />
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{category?.name}</span>
      </div>
      <h3 className="mt-4 text-xl font-bold">{name}</h3>
      <div className="mt-1 h-5 text-xs text-slate-500">
        <a href={`/product/${slug}/reviews`} aria-label={`Read or write reviews for ${name}`} className="inline-flex items-center gap-1 rounded text-slate-400 hover:text-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">{rating?.count ? <><Stars value={rating.average} size={14} />{rating.average} ({rating.count})</> : <><Stars value={0} size={14} />Write a review</>}</a>
      </div>
      <p className="mt-2 flex-1 text-sm text-slate-400">{description}</p>
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        {terms && <span className="chip">{terms}</span>}
        {product.type && <span className="chip">{product.type}</span>}
        {limit && <span className="chip">{limit}</span>}
      </div>
      <p className="mt-5 text-3xl font-extrabold">
        <SalePrice from={!!options} original={sale.original} price={sale.price} />
      </p>
      {out ? (
        <div className="mt-4">
          <a href={whatsappLink(`Hello, is ${name} available?`)} target="_blank" rel="noreferrer" className="btn-ghost block whitespace-nowrap px-3">Ask on WhatsApp</a>
        </div>
      ) : (
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button onClick={buyNow} className="btn-primary min-w-0 px-2 text-sm sm:px-3">Buy Now</button>
        <button onClick={addToCart} className="btn-ghost min-w-0 px-2 text-sm sm:px-3">Add to Cart</button>
      </div>
      )}
      <a href={detailsLink} className="mt-3 text-center text-sm text-slate-300 underline-offset-4 hover:underline">View Details</a>
    </article>
  );
}

export default memo(ProductCard);
