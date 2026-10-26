import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { products as baseProducts } from "../data/products";
import { applyProductDetails } from "../utils/productDetails";
import { fetchProductVariant, fetchAllCatalogVariants, readCachedProductVariant } from "../utils/catalogVariantCache";

const ProductContext = createContext({ products: baseProducts, ready: false });
export const useProducts = () => useContext(ProductContext).products;
export const useAllProducts = () => useContext(ProductContext).allProducts || [];
export const useDeletedOriginalProducts = () => useContext(ProductContext).deletedOriginalProducts || [];

export function ProductProvider({ children }) {
  const [details, setDetails] = useState({});
  const [deletedOriginalProducts, setDeletedOriginalProducts] = useState([]);
  const [ready, setReady] = useState(false);
  const [imported, setImported] = useState([]);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch("/api/product-details");
        if (!response.ok) throw new Error("Product details unavailable");
        const data = await response.json();
        if (active) {
          setDetails((previous) => JSON.stringify(previous) === JSON.stringify(data.details || {}) ? previous : data.details || {});
          setDeletedOriginalProducts(Array.isArray(data.deletedProducts) ? data.deletedProducts : []);
          setReady(true);
        }
      } catch { if (active) setReady(false); }
    };
    refresh();
    const timer = setInterval(refresh, 120000);
    const changed = () => refresh();
    const visible = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("product-details-updated", changed);
    window.addEventListener("catalog-updated", changed);
    document.addEventListener("visibilitychange", visible);
    return () => { active = false; clearInterval(timer); window.removeEventListener("product-details-updated", changed); window.removeEventListener("catalog-updated", changed); document.removeEventListener("visibilitychange", visible); };
  }, []);
  // Load only the selected imported product. Homepage uses the small paged group endpoint;
  // it must not download hundreds of plan descriptions and prices.
  useEffect(() => {
    let active = true;
    const sync = async () => {
      const slug = location.pathname.split('/').filter(Boolean);
      const fromCart = (() => {try {return JSON.parse(localStorage.getItem('cart')||'[]').some(i=>String(i.key||'').startsWith('import-'))}catch{return false}})();
      const many = slug[0] === 'admin' || (slug[0] === 'checkout' && fromCart);
      if (!many && !(slug[0] === 'product' && slug[1]?.startsWith('import-'))) return;
      try {
        const list = many ? await fetchAllCatalogVariants() : [await fetchProductVariant(slug[1])];
        const mapped = (list||[]).map(p=>({slug:p.slug,name:p.name,category:p.category,description:p.description,price:p.finalPrice,brand:p.brand,duration:p.variant,type:p.productType,months:[],popular:p.featured,unavailable:p.unavailable,needsConfirmation:!!p.needsConfirmation,restricted:!!p.restricted,imported:true}));
        if(active)setImported(old=>{
          const known = new Map((many ? [] : old).map(p=>[p.slug,p]));
          mapped.forEach(p=>known.set(p.slug,p));return [...known.values()];
        });
      } catch {}
    };
    sync();
    const onChange=()=>sync();
    window.addEventListener('popstate',onChange);
    window.addEventListener('catalog-updated',onChange);
    return()=>{active=false;window.removeEventListener('popstate',onChange);window.removeEventListener('catalog-updated',onChange)};
  },[]);
  const allProducts = useMemo(() => [...baseProducts.map((p) => applyProductDetails(p, details[p.slug])), ...imported], [details, imported]);
  // Fail closed until original-product deletion list is loaded from the server.
  const products = useMemo(() => ready ? allProducts.filter(p => p.imported || !deletedOriginalProducts.includes(p.slug)) : [], [allProducts, deletedOriginalProducts, ready]);
  return <ProductContext.Provider value={{ products, allProducts, deletedOriginalProducts, ready }}>{children}</ProductContext.Provider>;
}
