import { navigate } from "../utils/navigate";
import { useCart } from "../context/CartContext";
import { formatPrice } from "../utils/formatPrice";
import { orderOnWhatsApp } from "../utils/whatsapp";

export default function Cart() {
  const { items, changeQty, removeItem, total, isOpen, setIsOpen } = useCart();
  if (!isOpen) return null;

  const close = () => setIsOpen(false);
  const goToCheckout = () => { close(); navigate("/checkout"); };
  const message = `Hello, I want to purchase ${items.map((i) => `${i.name} x${i.qty}`).join(", ")} for ${formatPrice(total)}.`;

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/70" onClick={close} />
      <aside aria-label="Shopping cart" className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l-2 border-[color:var(--border)] bg-[color:var(--surface-2)] p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-extrabold">Your Cart</h2>
          <button onClick={close} aria-label="Close cart" className="text-3xl leading-none">×</button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <p className="text-slate-300">Your cart is empty.</p>
            <button onClick={close} className="btn-primary">Browse Products</button>
          </div>
        ) : (
          <>
            <ul className="mt-5 flex-1 space-y-3 overflow-y-auto">
              {items.map((item) => (
                <li key={item.key} className="glass p-4">
                  <div className="flex min-w-0 justify-between gap-3">
                    <div className="min-w-0 break-words">
                      <p className="font-bold">{item.name}</p>
                      {item.label && <p className="text-xs text-slate-400">{item.label}</p>}
                    </div>
                    <p className="shrink-0 text-right text-sm font-bold">{item.originalPrice > item.price && <del className="block text-xs font-normal text-slate-400">{formatPrice(item.originalPrice * item.qty)}</del>}{formatPrice(item.price * item.qty)}</p>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button onClick={() => changeQty(item.key, -1)} aria-label="Decrease quantity" className="chip h-8 w-8 !p-0">−</button>
                      <span>{item.qty}</span>
                      <button onClick={() => changeQty(item.key, 1)} aria-label="Increase quantity" className="chip h-8 w-8 !p-0">+</button>
                    </div>
                    <button onClick={() => removeItem(item.key)} className="text-sm text-red-600 dark:text-red-400 hover:underline">Remove</button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-4 space-y-1 border-t border-[color:var(--border)] pt-4 text-sm">
              <p className="flex justify-between text-slate-300"><span>Subtotal</span><span>{formatPrice(total)}</span></p>
              <p className="flex justify-between text-lg font-extrabold"><span>Total</span><span>{formatPrice(total)}</span></p>
            </div>
            <div className="mt-4">
              <p className="mb-1 text-xs text-slate-400">Your WhatsApp message</p>
              <p className="break-words rounded-2xl rounded-tl-sm bg-[#d9fdd3] px-3 py-2 text-sm text-black">{message}</p>
            </div>
            <div className="mt-4 grid gap-2">
              <button onClick={goToCheckout} className="btn-primary">Proceed to Checkout</button>
              <button onClick={() => orderOnWhatsApp(message, items.map((i) => i.name).join(", "))} className="btn-ghost">Order on WhatsApp</button>
              <button onClick={close} className="text-sm text-slate-300 hover:underline">Continue Shopping</button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
