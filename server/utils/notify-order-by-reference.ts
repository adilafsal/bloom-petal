import { sql } from "./db";
import { notifyOrder } from "./order-notifications";

export async function notifyOrderByReference(orderNumber: string) {
  try {
    const rows = await sql`
      SELECT o.id, o.order_number, o.total::float AS total, o.payment_method,
             o.delivery_address, o.delivery_date::text AS delivery_date, o.delivery_time,
             c.full_name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
             COALESCE(jsonb_agg(jsonb_build_object(
               'product_name', i.product_name, 'quantity', i.quantity,
               'unit_price', i.unit_price::float, 'size', i.size
             )) FILTER (WHERE i.id IS NOT NULL), '[]'::jsonb) AS products
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      LEFT JOIN order_items i ON i.order_id = o.id
      WHERE o.order_number = ${orderNumber}
      GROUP BY o.id, c.id
    `;
    if (rows[0]) await notifyOrder(rows[0] as Parameters<typeof notifyOrder>[0]);
  } catch (error) {
    console.error("Order saved; notification processing failed.", error);
  }
}
