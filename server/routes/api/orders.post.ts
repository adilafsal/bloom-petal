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
type OrderItem = { productId?: string | number; quantity?: number; size?: string; customization?: Record<string, unknown>; customBouquet?: CustomBouquet };
type OrderInput = { customer?: { fullName?: string; email?: string; phone?: string }; items?: OrderItem[]; delivery?: { address?: string; city?: string; area?: string; building?: string; apartment?: string; date?: string; time?: string }; giftMessage?: string; paymentMethod?: string };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  if (!items?.length || items.length > 40) throw createError({ statusCode: 400, statusMessage: "Your order must contain between 1 and 40 items." });
  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity! < 1 || item.quantity! > 30) throw createError({ statusCode: 400, statusMessage: "Each product quantity must be a whole number between 1 and 30." });
    if (!item.size || !["Small", "Medium", "Large"].includes(item.size)) throw createError({ statusCode: 400, statusMessage: "Choose a valid size for every bouquet." });
    if (item.customBouquet) {
      if (!priceCustomBouquet(item) || item.customBouquet.size !== item.size) throw createError({ statusCode: 400, statusMessage: "The custom bouquet details are invalid. Please review your flower, size, colour, wrapping and extras selections." });
    } else if (!(typeof item.productId === "string" && uuidPattern.test(item.productId))) {
      throw createError({ statusCode: 400, statusMessage: `A product identifier is invalid for cart item ${items.indexOf(item) + 1}. Refresh your bag and try again.` });
    }
  }
  const paymentMethod = body.paymentMethod || "cash_on_delivery";
  if (!["cash_on_delivery", "online"].includes(paymentMethod)) throw createError({ statusCode: 400, statusMessage: "Choose a supported payment method." });
  if (paymentMethod === "online" && !onlinePaymentsEnabled) throw createError({ statusCode: 503, statusMessage: "Online payment is not configured. Choose Cash on Delivery." });

  const normalizedItems = items.map(item => {
    const custom = item.customBouquet ? priceCustomBouquet(item)! : null;
    return { productId: custom ? null : String(item.productId), quantity: item.quantity, size: custom?.size ?? item.size ?? "Medium", customName: custom?.name ?? null, customPrice: custom?.price ?? null, customization: custom?.details ?? item.customization ?? {} };
  });
  const reference = `BP${randomUUID().replaceAll("-", "").toUpperCase()}`;
  const address = { address: delivery.address.trim(), city: delivery.city.trim(), area: delivery.area.trim(), building: delivery.building?.trim() ?? "", apartment: delivery.apartment?.trim() ?? "" };
  let rows: Array<{ id: string; reference: string; total: number }>;
  try {
    rows = await sql`
    WITH requested AS (
      SELECT * FROM jsonb_to_recordset(${JSON.stringify(normalizedItems)}::jsonb)
        AS x("productId" text, quantity integer, size text, customization jsonb, "customName" text, "customPrice" numeric)
    ), requested_products AS MATERIALIZED (
      SELECT "productId", sum(quantity)::int AS quantity
      FROM requested WHERE "customPrice" IS NULL GROUP BY "productId"
    ), locked_products AS MATERIALIZED (
      SELECT p.id, p.legacy_id, p.name, p.price, p.sale_price, p.available, p.stock_quantity,
             requested_products."productId", requested_products.quantity
      FROM requested_products JOIN products p
        ON p.id::text = requested_products."productId" OR p.legacy_id::text = requested_products."productId"
      ORDER BY p.id
      FOR UPDATE OF p
    ), priced AS (
      SELECT p.id AS product_id, p.name,
             CASE WHEN r."customPrice" IS NOT NULL THEN r."customPrice"
                  WHEN r.size = 'Small' THEN GREATEST(COALESCE(p.sale_price, p.price) - 50, 89)
                  WHEN r.size = 'Large' THEN COALESCE(p.sale_price, p.price) + 50
                  ELSE COALESCE(p.sale_price, p.price) END AS price,
             r.quantity, COALESCE(r.size, 'Medium') AS size, COALESCE(r.customization, '{}'::jsonb) AS customization
      FROM requested r
      LEFT JOIN locked_products p ON p."productId" = r."productId" AND r."customPrice" IS NULL
        AND p.available = true AND (p.stock_quantity IS NULL OR p.stock_quantity >= p.quantity)
      WHERE r."customPrice" IS NOT NULL OR p.id IS NOT NULL
    ), valid AS (
      SELECT (SELECT count(*) FROM priced) = ${normalizedItems.length}::bigint
        AND (SELECT count(*) FROM locked_products) = (SELECT count(*) FROM requested_products)
        AND NOT EXISTS (SELECT 1 FROM locked_products WHERE available = false OR (stock_quantity IS NOT NULL AND stock_quantity < quantity)) AS ok
    ), stock_updates AS (
      UPDATE products p SET stock_quantity = p.stock_quantity - lp.quantity, updated_at = now()
      FROM locked_products lp, valid
      WHERE valid.ok AND p.id = lp.id AND p.stock_quantity IS NOT NULL
      RETURNING p.id
    ), inventory_valid AS (
      SELECT valid.ok AND (SELECT count(*) FROM stock_updates) = (SELECT count(*) FROM locked_products WHERE stock_quantity IS NOT NULL) AS ok
      FROM valid
    ), customer_row AS (
      INSERT INTO customers (full_name, email, phone)
      SELECT ${customer.fullName.trim()}, ${customer.email.trim().toLowerCase()}, ${customer.phone.trim()} FROM inventory_valid WHERE inventory_valid.ok
      ON CONFLICT (email, phone) DO UPDATE SET full_name = EXCLUDED.full_name RETURNING id
    ), totals AS (SELECT COALESCE(sum(price * quantity), 0)::numeric(10,2) AS subtotal FROM priced),
    new_order AS (
      INSERT INTO orders (order_number, customer_id, subtotal, delivery_fee, total, delivery_address, delivery_date, delivery_time, gift_message, payment_method, payment_provider, status, payment_status)
      SELECT ${reference}, customer_row.id, totals.subtotal, 25, totals.subtotal + 25, ${JSON.stringify(address)}::jsonb,
        ${delivery.date}::date, ${delivery.time}, ${body.giftMessage?.slice(0, 500) ?? ""}, ${paymentMethod}, ${paymentMethod === "online" ? "stripe" : null},
        ${paymentMethod === "online" ? "Pending" : "Order Received"}, 'Pending'
      FROM customer_row, totals, inventory_valid WHERE inventory_valid.ok RETURNING id, order_number, total
    ), saved_items AS (
      INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, size, customization)
      SELECT new_order.id, priced.product_id, priced.name, priced.quantity, priced.price, priced.size, priced.customization FROM new_order CROSS JOIN priced RETURNING order_id
    )
    SELECT new_order.id, new_order.order_number AS reference, new_order.total::float AS total FROM new_order
    `;
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "unknown";
    console.error("Order creation database statement failed.", { code });
    throw createError({ statusCode: 500, statusMessage: "We couldn't save your order due to a database error. Your cart is unchanged; please try again or contact the shop." });
  }
  if (!rows.length) throw createError({ statusCode: 409, statusMessage: "One or more products are unavailable or no longer have enough stock. Refresh your bag and try again." });
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
