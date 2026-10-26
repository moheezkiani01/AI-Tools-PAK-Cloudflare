import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { priceInfo } from "../utils/discounts";
const DiscountContext = createContext({ discounts: {}, ready: false, priceFor: (p, o) => priceInfo(p, {}, o), hasDiscount: () => false });
export const useDiscounts = () => useContext(DiscountContext);

export function DiscountProvider({ children }) {
  const [discounts, setDiscounts] = useState({});
  const [prices, setPrices] = useState({});
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const res = await fetch("/api/discounts");
        if (!res.ok) throw new Error("Discount prices unavailable");
        const data = await res.json();
        if (active) {
          setDiscounts((old) => JSON.stringify(old) === JSON.stringify(data.discounts || {}) ? old : (data.discounts || {}));
          setPrices((old) => JSON.stringify(old) === JSON.stringify(data.prices || {}) ? old : (data.prices || {}));
          setReady(true);
        }
      } catch { if (active) setReady(false); }
    };
    refresh();
    const timer = setInterval(refresh, 120000);
    const visible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("discounts-updated", refresh);
    window.addEventListener("pricing-updated", refresh);
    return () => { active = false; clearInterval(timer); document.removeEventListener("visibilitychange", visible); window.removeEventListener("discounts-updated", refresh); window.removeEventListener("pricing-updated", refresh); };
  }, []);
  const value = useMemo(() => ({ discounts, prices, ready,
    hasDiscount: (slug) => !!discounts[slug],
    priceFor: (product, option) => product.imported ? { price: product.price, original: product.price, onSale: false } : priceInfo(product, discounts, option, prices),
  }), [discounts, prices, ready]);
  return <DiscountContext.Provider value={value}>{children}</DiscountContext.Provider>;
}
