import { defineHandler } from "nitro";
import { createError, getRouterParam } from "nitro/h3";
import { sql } from "../../../utils/db";

export default defineHandler(async event => {
  const reference = getRouterParam(event, "orderNumber");
  if (!reference) throw createError({ statusCode: 400, statusMessage: "An order reference is required." });
  const rows = await sql`
    SELECT o.order_number, o.created_at, o.subtotal::float AS subtotal,
      o.delivery_fee::float AS delivery_fee, o.total::float AS total,
      o.delivery_address, o.delivery_date, o.delivery_time, o.gift_message,
      o.payment_method, o.payment_status,
      CASE WHEN o.status = 'Order Received' THEN 'Pending' ELSE o.status END AS status,
      c.full_name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
      COALESCE(jsonb_agg(jsonb_build_object('product_name', oi.product_name, 'quantity', oi.quantity,
        'unit_price', oi.unit_price::float, 'size', oi.size, 'customization', oi.customization))
        FILTER (WHERE oi.id IS NOT NULL), '[]'::jsonb) AS products,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('status', h.status, 'changed_at', h.changed_at) ORDER BY h.changed_at)
        FROM order_status_history h WHERE h.order_id = o.id), jsonb_build_array(jsonb_build_object('status', 'Pending', 'changed_at', o.created_at))) AS timeline
    FROM orders o JOIN customers c ON c.id = o.customer_id
    LEFT JOIN order_items oi ON oi.order_id = o.id
    WHERE o.order_number = ${reference}
    GROUP BY o.id, c.id
  `;
  if (!rows.length) throw createError({ statusCode: 404, statusMessage: "Order not found." });
  return rows[0];
});
