// See orders:            npm run orders
// Mark one as completed: npm run orders -- done AIT-123456
import fs from "node:fs";

const DB_FILE = new URL("./db.json", import.meta.url);
const db = fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE, "utf8")) : {};
const orders = db.orders || [];
const [action, number] = process.argv.slice(2);

if (action === "done") {
  const order = orders.find((o) => o.number === number?.toUpperCase());
  if (!order) console.log("Order not found.");
  else {
    order.status = "Completed";
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    console.log(`${order.number} marked as Completed`);
  }
} else {
  if (!orders.length) console.log("No orders yet.");
  orders.forEach((o) => {
    console.log(`${o.number} | ${o.status} | ${o.date.slice(0, 16)} | ${o.customer.name} | WhatsApp ${o.customer.whatsapp} | ${o.customer.email}`);
    o.items.forEach((i) => console.log(`    ${i.name} ${i.label} x${i.qty} = Rs. ${i.price * i.qty}`));
    console.log(`    Total Rs. ${o.total}${o.customer.notes ? ` | Notes: ${o.customer.notes}` : ""}`);
  });
}
