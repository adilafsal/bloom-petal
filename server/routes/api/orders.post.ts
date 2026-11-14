import { randomUUID } from "node:crypto";
import { defineHandler } from "nitro";
import { createError, readBody } from "nitro/h3";
import { sql } from "../../utils/db";
import { notifyOrderByReference } from "../../utils/notify-order-by-reference";
import { createStripeCheckout, onlinePaymentsEnabled } from "../../utils/payments";

const flowerOptions = ["Red roses", "Pink roses", "White roses", "Tulips", "Lilies", "Sunflowers", "Carnations", "Baby's breath"];
const colors = ["Soft pink & ivory", "Classic red", "Fresh whites", "Garden mix", "Sunny yellows"];
const wraps = ["Classic cream", "Dusty pink", "Kraft paper", "Elegant white"];
const extras = ["Greeting card", "Gift box", "Ribbon", "Small teddy bear"];
const extraPrices: Record<string, number> = { "Greeting card": 12, "Gift box": 35, Ribbon: 8, "Small teddy bear": 45 };
const sizePrices: Record<string, number> = { Small: 139, Medium: 189, Large: 259 };
type CustomBouquet = { flowers?: string[]; color?: string; size?: string; wrapping?: string; extras?: string[]; giftMessage?: string };
type OrderItem = { productId?: number; quantity?: number; size?: string; customization?: Record<string, unknown>; customBouquet?: CustomBouquet };
type OrderInput = { customer?: { fullName?: string; email?: string; phone?: string }; items?: OrderItem[]; delivery?: { address?: string; city?: string; area?: string; building?: string; apartment?: string; date?: string; time?: string }; giftMessage?: string; paymentMethod?: string };

function priceCustomBouquet(item: OrderItem) {
  const bouquet = item.customBouquet;
  if (!bouquet || !Array.isArray(bouquet.flowers) || bouquet.flowers.length < 1 || bouquet.flowers.length > flowerOptions.length || bouquet.flowers.some(flower => !flowerOptions.includes(flower)) || new Set(bouquet.flowers).size !== bouquet.flowers.length) return null;
  if (!colors.includes(bouquet.color ?? "") || !wraps.includes(bouquet.wrapping ?? "") || !sizePrices[bouquet.size ?? ""]) return null;
  if (!Array.isArray(bouquet.extras) || bouquet.extras.length > extras.length || bouquet.extras.some(extra => !extras.includes(extra)) || new Set(bouquet.extras).size !== bouquet.extras.length) return null;
  if (typeof bouquet.giftMessage !== "string" || bouquet.giftMessage.length > 500) return null;
  return { price: sizePrices[bouquet.size!] + bouquet.extras.reduce((sum, extra) => sum + extraPrices[extra], 0), size: bouquet.size!, name: `Custom bouquet · ${bouquet.flowers.join(", ")} · ${bouquet.color} · ${bouquet.wrapping}${bouquet.extras.length ? ` · with ${bouquet.extras.join(", ")}` : ""}`, details: bouquet };
}

export default defineHandler(async event => {
  const body = await readBody<OrderInput>(event);
  const customer = body?.customer, delivery = body?.delivery, items = body?.items;
  if (!customer?.fullName?.trim() || !customer.email?.includes("@") || !customer.phone?.trim()) throw createError({ statusCode: 400, statusMessage: "Valid customer details are required." });
  if (!delivery?.address?.trim() || !delivery.city?.trim() || !delivery.area?.trim() || !delivery.date || !delivery.time) throw createError({ statusCode: 400, statusMessage: "Complete delivery information is required." });
  if (!items?.length || items.length > 40 || items.some(item => !Number.isInteger(item.quantity) || item.quantity! < 1 || item.quantity! > 30 || !["Small", "Medium", "Large"].includes(item.size || "Medium") || (item.customBouquet ? !priceCustomBouquet(item) : !Number.isInteger(item.productId)))) throw createError({ statusCode: 400, statusMessage: "A valid order item list is required." });
  const paymentMethod = body.paymentMethod || "cash_on_delivery";
  if (!["cash_on_delivery", "online"].includes(paymentMethod)) throw createError({ statusCode: 400, statusMessage: "Choose a supported payment method." });
  if (paymentMethod === "online" && !onlinePaymentsEnabled) throw createError({ statusCode: 503, statusMessage: "Online payment is not configured. Choose Cash on Delivery." });

  const normalizedItems = items.map(item => {
    const custom = item.customBouquet ? priceCustomBouquet(item)! : null;
    return { productId: custom ? null : item.productId, quantity: item.quantity, size: custom?.size ?? item.size ?? "Medium", customName: custom?.name ?? null, customPrice: custom?.price ?? null, customization: custom?.details ?? item.customization ?? {} };
  });
  const reference = `BP${randomUUID().replaceAll("-", "").toUpperCase()}`;
  const address = { address: delivery.address.trim(), city: delivery.city.trim(), area: delivery.area.trim(), building: delivery.building?.trim() ?? "", apartment: delivery.apartment?.trim() ?? "" };
  const rows = await sql`
    WITH requested AS (
      SELECT * FROM jsonb_to_recordset(${JSON.stringify(normalizedItems)}::jsonb)
        AS x("productId" integer, quantity integer, size text, customization jsonb, "customName" text, "customPrice" numeric)
    ), priced AS (
      SELECT p.id AS product_id, COALESCE(p.name, r."customName") AS name,
             CASE WHEN r."customPrice" IS NOT NULL THEN r."customPrice" WHEN r.size = 'Small' THEN GREATEST(p.price - 50, 89) WHEN r.size = 'Large' THEN p.price + 50 ELSE p.price END AS price,
             r.quantity, COALESCE(r.size, 'Medium') AS size, COALESCE(r.customization, '{}'::jsonb) AS customization
      FROM requested r LEFT JOIN products p ON p.legacy_id = r."productId" AND p.available = true
      WHERE r."customPrice" IS NOT NULL OR p.id IS NOT NULL
    ), valid AS (SELECT count(*) = ${normalizedItems.length}::bigint AS ok FROM priced),
    customer_row AS (
      INSERT INTO customers (full_name, email, phone)
      SELECT ${customer.fullName.trim()}, ${customer.email.trim().toLowerCase()}, ${customer.phone.trim()} FROM valid WHERE valid.ok
      ON CONFLICT (email, phone) DO UPDATE SET full_name = EXCLUDED.full_name RETURNING id
    ), totals AS (SELECT COALESCE(sum(price * quantity), 0)::numeric(10,2) AS subtotal FROM priced),
    new_order AS (
      INSERT INTO orders (order_number, customer_id, subtotal, delivery_fee, total, delivery_address, delivery_date, delivery_time, gift_message, payment_method, payment_provider, status, payment_status)
      SELECT ${reference}, customer_row.id, totals.subtotal, 25, totals.subtotal + 25, ${JSON.stringify(address)}::jsonb,
        ${delivery.date}::date, ${delivery.time}, ${body.giftMessage?.slice(0, 500) ?? ""}, ${paymentMethod}, ${paymentMethod === "online" ? "stripe" : null},
        ${paymentMethod === "online" ? "Pending" : "Order Received"}, 'Pending'
      FROM customer_row, totals, valid WHERE valid.ok RETURNING id, order_number, total
    ), saved_items AS (
      INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, size, customization)
      SELECT new_order.id, priced.product_id, priced.name, priced.quantity, priced.price, priced.size, priced.customization FROM new_order CROSS JOIN priced RETURNING order_id
    )
    SELECT new_order.id, new_order.order_number AS reference, new_order.total::float AS total FROM new_order
  `;
  if (!rows.length) throw createError({ statusCode: 409, statusMessage: "One or more products are unavailable. Refresh your bag and try again." });
  const savedOrder = rows[0] as { id: string; reference: string; total: number };
  let checkoutUrl: string | undefined;
  if (paymentMethod === "online") {
    try {
      const saved = await sql`SELECT o.id, o.total::float AS total, o.delivery_fee::float AS delivery_fee, c.email FROM orders o JOIN customers c ON c.id=o.customer_id WHERE o.id=${savedOrder.id}`;
      const lineRows = await sql`SELECT product_name AS name, quantity, unit_price::float AS unit_price FROM order_items WHERE order_id=${savedOrder.id}`;
      const session = await createStripeCheckout({ id: savedOrder.id, orderNumber: savedOrder.reference, customerEmail: saved[0].email, total: saved[0].total, deliveryFee: saved[0].delivery_fee, items: lineRows });
      checkoutUrl = session.url ?? undefined;
      await sql`UPDATE orders SET payment_session_id=${session.id} WHERE id=${savedOrder.id}`;
    } catch (error) {
      console.error("Order saved but online payment session creation failed.", error);
      throw createError({ statusCode: 502, statusMessage: `Order ${savedOrder.reference} was saved, but the payment session could not be created. Contact the shop before placing another order.` });
    }
  }
  if (paymentMethod === "cash_on_delivery") await notifyOrderByReference(savedOrder.reference);
  return { reference: savedOrder.reference, total: savedOrder.total, checkoutUrl };
});
