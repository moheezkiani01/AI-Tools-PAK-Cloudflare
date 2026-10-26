import { brand } from "../config";

export const whatsappLink = (text) => `https://wa.me/${brand.whatsappNumber}?text=${encodeURIComponent(text)}`;

// Counts the order on the server, then opens WhatsApp
export const orderOnWhatsApp = (message, items) => {
  fetch("/api/orders/whatsapp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items }), keepalive: true }).catch(() => {});
  window.open(whatsappLink(message), "_blank", "noopener");
};
