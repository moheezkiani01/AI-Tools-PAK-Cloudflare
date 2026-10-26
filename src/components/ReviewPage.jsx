import { useEffect } from "react";
import { useProducts } from "../context/ProductContext";
import { brand } from "../config";
import BrandIcon from "./BrandIcon";
import Reviews from "./Reviews";

export default function ReviewPage({ slug }) {
  const products = useProducts();
  const product = products.find((p) => p.slug === slug);
  useEffect(() => {
    const old = document.title;
    document.title = `${product ? product.name : "Product"} Reviews | ${brand.name}`;
    return () => { document.title = old; };
  }, [product]);
  if (!product) return <div className="mx-auto max-w-3xl px-5 py-12">Product not found. <a href="/products" className="underline">View products</a></div>;
  return (
    <div className="mx-auto max-w-3xl space-y-5 px-5 py-9">
      <a href={`/product/${slug}`} className="text-sm text-slate-400 hover:underline">← Back to {product.name}</a>
      <header className="flex min-w-0 items-center gap-4"><BrandIcon name={slug} category={product.category} size={60} /><div className="min-w-0 break-words"><p className="text-sm text-slate-400">Customer feedback</p><h1 className="text-3xl font-extrabold">{product.name} Reviews</h1></div></header>
      <Reviews slug={slug} />
    </div>
  );
}
