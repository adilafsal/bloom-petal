import { defineHandler } from "nitro";
import { getQuery } from "nitro/h3";
import { sql } from "../../../utils/db";

const statuses = ["Pending", "Confirmed", "Preparing", "Out for Delivery", "Delivered", "Cancelled"];

export default defineHandler(async event => {
  const query = getQuery(event);
  const status = typeof query.status === "string" && statuses.includes(query.status) ? query.status : null;
  const search = typeof query.search === "string" ? query.search.trim().slice(0, 120) : "";
  const pattern = `%${search.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
  return sql`
    SELECT o.id, o.order_number, o.created_at, o.subtotal::float AS subtotal,
           o.delivery_fee::float AS delivery_fee, o.total::float AS total,
           o.delivery_address, o.delivery_date, o.delivery_time, o.gift_message,
           o.payment_method, o.payment_status,
           CASE WHEN o.status = 'Order Received' THEN 'Pending' ELSE o.status END AS status,
           c.full_name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
           COALESCE(jsonb_agg(jsonb_build_object(
             'product_name', oi.product_name, 'quantity', oi.quantity,
             'unit_price', oi.unit_price::float, 'size', oi.size, 'customization', oi.customization
           )) FILTER (WHERE oi.id IS NOT NULL), '[]'::jsonb) AS products
    FROM orders o
    JOIN customers c ON c.id = o.customer_id
    LEFT JOIN order_items oi ON oi.order_id = o.id
    WHERE (${status}::text IS NULL OR
           CASE WHEN o.status = 'Order Received' THEN 'Pending' ELSE o.status END = ${status})
      AND (${search} = '' OR o.order_number ILIKE ${pattern} OR c.full_name ILIKE ${pattern})
    GROUP BY o.id, c.id
    ORDER BY o.created_at DESC
    LIMIT 250
  `;
});
