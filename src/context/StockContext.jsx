import { createContext, useContext, useEffect, useMemo, useState } from "react";

const StockContext = createContext({ isOut: () => false });
export const useStock = () => useContext(StockContext);

// Asks the server which products the admin marked "out of stock"
export function StockProvider({ children }) {
  const [outOfStock, setOutOfStock] = useState([]);

  useEffect(() => {
    const load = () => fetch("/api/stock").then((r) => r.json()).then((d) => {
      const next = d.outOfStock || [];
      setOutOfStock((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next)); // unchanged = nothing is redrawn
    }).catch(() => {});
    load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, []);

  const value = useMemo(() => ({ isOut: (slug) => outOfStock.includes(slug) }), [outOfStock]);
  return <StockContext.Provider value={value}>{children}</StockContext.Provider>;
}
