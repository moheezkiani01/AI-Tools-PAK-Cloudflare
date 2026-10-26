import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useProducts } from "./ProductContext";
import { useDiscounts } from "./DiscountContext";

const CartContext = createContext();
const ActionsContext = createContext();
export const useCart = () => useContext(CartContext);           // everything: cart drawer, navbar badge, checkout
export const useCartActions = () => useContext(ActionsContext); // only the buttons. Never re-draws when the cart changes, so product cards stay still

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem("cart")) || []; } catch { return []; }
  });
  const [isOpen, setIsOpen] = useState(false);
  const { priceFor } = useDiscounts();
  const products = useProducts();

  useEffect(() => {
    try { localStorage.setItem("cart", JSON.stringify(items)); } catch {}
  }, [items]);

  // "option" is a plan like { label: "1 Year", price: 12000 } for products that have several plans
  const addItem = useCallback((product, option) => {
    const label = option?.label ?? product.duration ?? "";
    const keyLabel = option?.key || option?.label || product.slug;
    const price = priceFor(product, option).price;
    const key = `${product.slug}|${keyLabel}`;
    setItems((current) =>
      current.some((i) => i.key === key)
        ? current.map((i) => (i.key === key ? { ...i, qty: i.qty + 1 } : i))
        : [...current, { key, name: product.name, label, price, qty: 1 }]
    );
  }, [priceFor]);
  const changeQty = useCallback((key, change) => setItems((c) => c.map((i) => (i.key === key ? { ...i, qty: Math.max(1, i.qty + change) } : i))), []);
  const removeItem = useCallback((key) => setItems((c) => c.filter((i) => i.key !== key)), []);
  const clearCart = useCallback(() => setItems([]), []);

  const actions = useMemo(() => ({ addItem, changeQty, removeItem, clearCart, setIsOpen }), [addItem, changeQty, removeItem, clearCart]);
  // Existing carts also update if an admin adds/removes a sale while they are open.
  const pricedItems = useMemo(() => items.map((item) => {
    const [slug, label] = item.key.split("|");
    const product = products.find((p) => p.slug === slug);
    const option = product?.options?.find((o) => (o.key || o.label) === label);
    if (!product) return item;
    const { original, price } = priceFor(product, option);
    return { ...item, name: product.name, label: option?.label || product.duration || item.label, originalPrice: original, price };
  }), [items, priceFor, products]);
  const total = useMemo(() => pricedItems.reduce((sum, i) => sum + i.price * i.qty, 0), [pricedItems]);
  const count = useMemo(() => items.reduce((sum, i) => sum + i.qty, 0), [items]);
  const value = useMemo(() => ({ items: pricedItems, total, count, isOpen, ...actions }), [pricedItems, total, count, isOpen, actions]);

  return (
    <ActionsContext.Provider value={actions}>
      <CartContext.Provider value={value}>{children}</CartContext.Provider>
    </ActionsContext.Provider>
  );
}
