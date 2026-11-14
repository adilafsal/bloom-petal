import { defineHandler } from "nitro";
import { createError, getRouterParam, readBody } from "nitro/h3";
import { sql } from "../../../utils/db";

const transitions: Record<string, string[]> = {
  Pending: ["Confirmed", "Cancelled"],
  Confirmed: ["Preparing", "Cancelled"],
  Preparing: ["Ready for delivery", "Cancelled"],
  "Ready for delivery": ["Out for delivery", "Cancelled"],
  "Out for delivery": ["Delivered", "Cancelled"],
  Delivered: [],
  Cancelled: [],
};

export default defineHandler(async event => {
  const orderNumber = getRouterParam(event, "orderNumber");
  const body = await readBody<{ status?: string }>(event);
  if (!orderNumber || !body?.status || !Object.hasOwn(transitions, body.status)) {
    throw createError({ statusCode: 400, statusMessage: "A valid order status is required." });
  }
  const updated = await sql`
    WITH changed AS (
      UPDATE orders SET status = ${body.status}
      WHERE order_number = ${orderNumber}
        AND CASE WHEN status = 'Order Received' THEN 'Pending' ELSE status END = ANY(${transitions[body.status]}::text[])
      RETURNING id, order_number, status, payment_status
    ), history AS (
      INSERT INTO order_status_history (order_id, status, changed_by)
      SELECT id, status, 'admin' FROM changed RETURNING order_id
    )
    SELECT changed.order_number, changed.status, changed.payment_status FROM changed
  `;
  if (!updated.length) {
    const exists = await sql`SELECT status FROM orders WHERE order_number = ${orderNumber}`;
    if (!exists.length) throw createError({ statusCode: 404, statusMessage: "Order not found." });
    throw createError({ statusCode: 409, statusMessage: `Cannot change this order from ${exists[0].status} to ${body.status}.` });
  }
  return updated[0];
});
