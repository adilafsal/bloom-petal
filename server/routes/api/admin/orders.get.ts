import { defineHandler } from "nitro";
import { createError, getQuery } from "nitro/h3";
import { sql } from "../../../utils/db";

const statuses = ["Pending", "Confirmed", "Preparing", "Out for Delivery", "Delivered", "Cancelled"];
const validDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));

export default defineHandler(async event => {
  const query = getQuery(event);
  const status = typeof query.status === "string" && query.status !== "All Orders" && statuses.includes(query.status) ? query.status : null;
  const search = typeof query.search === "string" ? query.search.trim().slice(0, 120) : "";
  const pattern = `%${search.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
  const from = typeof query.from === "string" ? query.from : null;
  const to = typeof query.to === "string" ? query.to : null;
  if ((from && !validDate(from)) || (to && !validDate(to))) throw createError({ statusCode: 400, statusMessage: "Use valid order date filters." });
  if (from && to && from > to) throw createError({ statusCode: 400, statusMessage: "The start date must be before the end date." });
  const pageValue = typeof query.page === "string" ? Number.parseInt(query.page, 10) : 1;
  const page = Number.isSafeInteger(pageValue) && pageValue > 0 ? pageValue : 1;
  const limit = 20;
  const offset = (page - 1) * limit;
  const patternSql = pattern;

  const [orders, counts, pending, recent] = await Promise.all([
    sql`
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
      WHERE (${status}::text IS NULL OR CASE WHEN o.status = 'Order Received' THEN 'Pending' ELSE o.status END = ${status})
        AND (${search} = '' OR o.order_number ILIKE ${patternSql} OR c.full_name ILIKE ${patternSql} OR c.phone ILIKE ${patternSql})
        AND (${from}::date IS NULL OR o.created_at::date >= ${from}::date)
        AND (${to}::date IS NULL OR o.created_at::date <= ${to}::date)
      GROUP BY o.id, c.id
      ORDER BY o.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `,
    sql`
      SELECT count(*)::int AS total FROM orders o JOIN customers c ON c.id = o.customer_id
      WHERE (${status}::text IS NULL OR CASE WHEN o.status = 'Order Received' THEN 'Pending' ELSE o.status END = ${status})
        AND (${search} = '' OR o.order_number ILIKE ${patternSql} OR c.full_name ILIKE ${patternSql} OR c.phone ILIKE ${patternSql})
        AND (${from}::date IS NULL OR o.created_at::date >= ${from}::date)
        AND (${to}::date IS NULL OR o.created_at::date <= ${to}::date)
    `,
    sql`SELECT count(*)::int AS total FROM orders WHERE status IN ('Pending', 'Order Received')`,
    sql`SELECT id FROM orders ORDER BY created_at DESC LIMIT 20`,
  ]);
  return { orders, total: counts[0].total, page, pageSize: limit, pendingCount: pending[0].total, recentIds: recent.map(row => row.id) };
});
