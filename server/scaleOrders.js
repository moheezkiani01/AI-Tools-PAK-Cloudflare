// Optional, additive checkout storage for heavy concurrency.
// Disabled unless ORDER_STORAGE_V2=true AND the migration has been applied.
// Unlike the legacy JSONB state, one order is one PostgreSQL row, with
// database-enforced idempotency and no global revision conflict.
import crypto from 'node:crypto';
import { supabaseRequest, StoreError } from './dataStore.js';

export const usingOrderTable = () => process.env.ORDER_STORAGE_V2 === 'true';

export async function placeDedicatedOrder({ idempotencyKey, customer, items, total }) {
  const safeKey = idempotencyKey || crypto.randomUUID();
  const number = `AIT-${crypto.randomBytes(7).toString('hex').toUpperCase()}`;
  const order = await supabaseRequest('rpc/ai_tools_create_checkout_order', {
    method: 'POST',
    body: { p_number: number, p_idempotency_key: safeKey, p_customer: customer, p_items: items, p_total: total },
  });
  if (!order || typeof order.number !== 'string' || !Number.isSafeInteger(Number(order.total)))
    throw new StoreError('Order was not confirmed. Please check your order status before retrying.');
  return { number: order.number, total: Number(order.total) };
}

export async function dedicatedOrderSummary() {
  if (!usingOrderTable()) return { total: 0, days: [] };
  const result = await supabaseRequest('rpc/ai_tools_checkout_order_summary', { method: 'POST', body: {} });
  if (!Number.isSafeInteger(result?.total) || !Array.isArray(result?.days))
    throw new StoreError('Could not load the new checkout-order summary.');
  return result;
}

export async function listDedicatedOrders() {
  if (!usingOrderTable()) return [];
  const rows = await supabaseRequest('ai_tools_checkout_orders?select=number,idempotency_key,date,status,customer,items,total&order=date.desc&limit=200');
  if (!Array.isArray(rows)) throw new StoreError('Could not load recent checkout orders.');
  return rows.map(row => ({
    number: row.number, idempotencyKey: row.idempotency_key,
    date: row.date, status: row.status,
    customer: row.customer, items: row.items, total: row.total,
  }));
}

export async function updateDedicatedOrder(number, status) {
  if (!usingOrderTable()) return false;
  const rows = await supabaseRequest(`ai_tools_checkout_orders?number=eq.${encodeURIComponent(number)}&select=number`, {
    method: 'PATCH', body: { status },
  });
  if (!Array.isArray(rows)) throw new StoreError('Could not update order status.');
  return rows.length > 0;
}
