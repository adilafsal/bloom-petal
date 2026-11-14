import { randomUUID } from "node:crypto";
import { defineHandler } from "nitro";
import { createError, readBody } from "nitro/h3";
import { sql } from "../../utils/db";

type OrderInput = {
  customer?: { fullName?: string; email?: string; phone?: string };
  items?: Array<{ productId?: number; quantity?: number; size?: string; customization?: Record<string, unknown> }>;
  delivery?: { address?: string; city?: string; area?: string; building?: string; apartment?: string; date?: string; time?: string };
  giftMessage?: string;
  paymentMethod?: string;
};

export default defineHandler(async (event) => {
  const body = await readBody<OrderInput>(event);
  const customer = body?.customer;
  const delivery = body?.delivery;
  const items = body?.items;
  if (!customer?.fullName?.trim() || !customer.email?.includes("@") || !customer.phone?.trim()) {
    throw createError({ statusCode: 400, statusMessage: "Valid customer details are required." });
  }
  if (!delivery?.address?.trim() || !delivery.city?.trim() || !delivery.area?.trim() || !delivery.date || !delivery.time) {
    throw createError({ statusCode: 400, statusMessage: "Complete delivery information is required." });
  }
  if (!items?.length || items.length > 40 || items.some(item => !Number.isInteger(item.productId) || !Number.isInteger(item.quantity) || item.quantity! < 1 || item.quantity! > 30 || !["Small", "Medium", "Large"].includes(item.size || "Medium"))) {
    throw createError({ statusCode: 400, statusMessage: "A valid order item list is required." });
  }
  if (body.paymentMethod && body.paymentMethod !== "cash_on_delivery") {
    throw createError({ statusCode: 400, statusMessage: "That payment method is not configured." });
  }

  const reference = `BP${randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
  const address = {
    address: delivery.address.trim(), city: delivery.city.trim(), area: delivery.area.trim(),
    building: delivery.building?.trim() ?? "", apartment: delivery.apartment?.trim() ?? "",
  };
  const rows = await sql`
    WITH requested AS (
      SELECT * FROM jsonb_to_recordset(${JSON.stringify(items)}::jsonb)
        AS x("productId" integer, quantity integer, size text, customization jsonb)
    ), priced AS (
      SELECT p.id AS product_id, p.name,
             CASE COALESCE(r.size, 'Medium')
               WHEN 'Small' THEN GREATEST(p.price - 50, 89)
               WHEN 'Large' THEN p.price + 50
               ELSE p.price
             END AS price,
             r.quantity, COALESCE(r.size, 'Medium') AS size,
             COALESCE(r.customization, '{}'::jsonb) AS customization
      FROM requested r
      JOIN products p ON p.legacy_id = r."productId" AND p.available = true
    ), valid AS (
      SELECT count(*) = ${items.length}::bigint AS ok FROM priced
    ), customer_row AS (
      INSERT INTO customers (full_name, email, phone)
      VALUES (${customer.fullName.trim()}, ${customer.email.trim().toLowerCase()}, ${customer.phone.trim()})
      ON CONFLICT (email, phone) DO UPDATE SET full_name = EXCLUDED.full_name
      RETURNING id
    ), totals AS (
      SELECT COALESCE(sum(price * quantity), 0)::numeric(10,2) AS subtotal FROM priced
    ), new_order AS (
      INSERT INTO orders (order_number, customer_id, subtotal, delivery_fee, total, delivery_address, delivery_date, delivery_time, gift_message, payment_method)
      SELECT ${reference}, customer_row.id, totals.subtotal, 25, totals.subtotal + 25,
             ${JSON.stringify(address)}::jsonb, ${delivery.date}::date, ${delivery.time}, ${body.giftMessage?.slice(0, 500) ?? ""}, 'cash_on_delivery'
      FROM customer_row, totals, valid WHERE valid.ok
      RETURNING id, order_number, total
    ), saved_items AS (
      INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, size, customization)
      SELECT new_order.id, priced.product_id, priced.name, priced.quantity, priced.price, priced.size, priced.customization
      FROM new_order CROSS JOIN priced
      RETURNING order_id
    )
    SELECT new_order.order_number AS reference, new_order.total::float AS total
    FROM new_order
  `;
  if (!rows.length) throw createError({ statusCode: 409, statusMessage: "One or more products are unavailable. Refresh your bag and try again." });
  return rows[0];
});
