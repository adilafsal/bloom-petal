import { randomUUID } from "node:crypto";
import { defineHandler } from "nitro";
import { createError, getRequestHeader, getRequestURL, readBody } from "nitro/h3";
import { sql } from "../../utils/db";
import { getSessionFromCookie } from "../../utils/session";
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
type OrderInput = { customer?: { fullName?: string; email?: string; phone?: string }; items?: OrderItem[]; delivery?: { savedAddressId?: string; address?: string; city?: string; area?: string; building?: string; apartment?: string; date?: string; time?: string; zoneId?: string; slotId?: string; instructions?: string }; giftMessage?: string; paymentMethod?: string };
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
  const customer = body?.customer ?? {} as NonNullable<OrderInput["customer"]>, delivery = body?.delivery, items = body?.items;
  let deliverySnapshot: Record<string, string> | null = null;
  let authenticatedUserId: string | null = null;
  if (delivery?.savedAddressId) {
    if (!uuidPattern.test(delivery.savedAddressId)) throw createError({ statusCode: 400, statusMessage: "Choose a valid saved delivery address." });
    const session = await getSessionFromCookie(getRequestHeader(event, "cookie") ?? null, getRequestURL(event).protocol === "http:");
    if (!session?.user) throw createError({ statusCode: 401, statusMessage: "Sign in to use saved addresses." });
    authenticatedUserId = session.user.id;
    const owned = await sql`SELECT a.recipient_name, a.phone, a.label, a.building, a.street, a.area, a.city, a.delivery_instructions FROM customer_addresses a JOIN customers c ON c.id=a.customer_id WHERE a.id=${delivery.savedAddressId}::uuid AND c.auth_user_id=${session.user.id}`;
    if (!owned.length) throw createError({ statusCode: 403, statusMessage: "That saved address does not belong to your account. Choose another address." });
    const saved = owned[0];
    deliverySnapshot = { recipient_name: saved.recipient_name, phone: saved.phone, label: saved.label, address: saved.street, building: saved.building, street: saved.street, area: saved.area, city: saved.city, delivery_instructions: saved.delivery_instructions };
    delivery.address = saved.street;
    delivery.city = saved.city;
    delivery.area = saved.area;
    delivery.building = saved.building;
    delivery.instructions = saved.delivery_instructions;
    customer.fullName = saved.recipient_name;
    customer.phone = saved.phone;
    customer.email = session.user.email;
  }
  if (!customer?.fullName?.trim() || !customer.email?.includes("@") || !customer.phone?.trim()) throw createError({ statusCode: 400, statusMessage: "Valid customer details are required." });
  if (!delivery?.address?.trim() || !delivery.city?.trim() || !delivery.area?.trim() || !delivery.date || !delivery.time) throw createError({ statusCode: 400, statusMessage: "Complete delivery information is required." });
  if (!items?.length || items.length > 40) throw createError({ statusCode: 400, statusMessage: "Your order must contain between 1 and 40 items." });
  for (const [index, item] of items.entries()) {
    if (!Number.isInteger(item.quantity) || item.quantity! < 1 || item.quantity! > 30) throw createError({ statusCode: 400, statusMessage: `Quantity for cart item ${index + 1} must be a whole number between 1 and 30.` });
    if (!item.size || !["Small", "Medium", "Large"].includes(item.size)) throw createError({ statusCode: 400, statusMessage: `Choose a valid size for cart item ${index + 1}.` });
    if (item.customBouquet) {
      if (!priceCustomBouquet(item) || item.customBouquet.size !== item.size) throw createError({ statusCode: 400, statusMessage: `Custom bouquet details for cart item ${index + 1} are invalid. Review its flower, size, colour, wrapping, and extras.` });
    } else if (!(typeof item.productId === "string" && uuidPattern.test(item.productId))) {
      throw createError({ statusCode: 400, statusMessage: `Product ID for cart item ${index + 1} must be a Neon product UUID. Refresh your bag and try again.` });
    }
  }
  const paymentMethod = body.paymentMethod || "cash_on_delivery";
  if (!["cash_on_delivery", "online"].includes(paymentMethod)) throw createError({ statusCode: 400, statusMessage: "Choose a supported payment method." });
  if (paymentMethod === "online" && !onlinePaymentsEnabled) throw createError({ statusCode: 503, statusMessage: "Online payment is not configured. Choose Cash on Delivery." });

  const normalizedItems = items.map(item => {
    const custom = item.customBouquet ? priceCustomBouquet(item)! : null;
    return { productId: custom ? null : String(item.productId), quantity: item.quantity, size: custom?.size ?? item.size ?? "Medium", customName: custom?.name ?? null, customPrice: custom?.price ?? null, customization: custom?.details ?? item.customization ?? {} };
  });
  const invalidProduct = await sql`SELECT item.ordinality::int AS item_index FROM jsonb_array_elements(${JSON.stringify(normalizedItems)}::jsonb) WITH ORDINALITY AS item(value, ordinality) LEFT JOIN products p ON p.id::text=item.value->>'productId' WHERE item.value->>'customPrice' IS NULL AND (p.id IS NULL OR p.available=false OR (p.stock_quantity IS NOT NULL AND p.stock_quantity < (item.value->>'quantity')::int)) LIMIT 1`;
  if (invalidProduct.length) throw createError({ statusCode: 409, statusMessage: `Product in cart item ${invalidProduct[0].item_index} no longer exists, is unavailable, or has insufficient stock. Refresh your bag.` });
  if (!delivery.zoneId || !delivery.slotId || !uuidPattern.test(delivery.zoneId) || !uuidPattern.test(delivery.slotId)) throw createError({ statusCode: 400, statusMessage: "Choose an available delivery area and time slot." });
  const [zoneRows, settingsRows, closedRows, slotRows, subtotalRows] = await Promise.all([
    sql`SELECT id, city, areas, fee::float AS fee, minimum_order::float AS minimum_order FROM delivery_zones WHERE id=${delivery.zoneId} AND enabled=true`,
    sql`SELECT settings FROM store_settings WHERE store_key='delivery'`,
    sql`SELECT 1 FROM delivery_closed_dates WHERE closed_date=${delivery.date}::date`,
    sql`SELECT id, label, max_orders FROM delivery_slots WHERE id=${delivery.slotId} AND enabled=true`,
    sql`WITH requested AS (SELECT * FROM jsonb_to_recordset(${JSON.stringify(normalizedItems)}::jsonb) AS x("productId" text,quantity integer,size text,"customPrice" numeric)) SELECT COALESCE(sum(CASE WHEN "customPrice" IS NOT NULL THEN "customPrice" WHEN size='Small' THEN GREATEST(COALESCE(p.sale_price,p.price)-50,89) WHEN size='Large' THEN COALESCE(p.sale_price,p.price)+50 ELSE COALESCE(p.sale_price,p.price) END * quantity),0)::float AS subtotal FROM requested LEFT JOIN products p ON p.id::text=requested."productId" WHERE "customPrice" IS NOT NULL OR p.id IS NOT NULL`,
  ]);
  if (!zoneRows.length || zoneRows[0].city.trim().toLowerCase() !== delivery.city!.trim().toLowerCase() || !zoneRows[0].areas.some((area:string)=>area.trim().toLowerCase()===delivery.area!.trim().toLowerCase())) throw createError({ statusCode: 400, statusMessage: `Delivery is unavailable in ${delivery.area.trim()}, ${delivery.city.trim()}. Choose an address in an active delivery area.` });
  const deliverySettings = settingsRows[0]?.settings ?? {};
  if (deliverySettings.deliveryAvailable === false) throw createError({ statusCode: 503, statusMessage: "Delivery is temporarily unavailable." });
  const settingsMinimum = Number(deliverySettings.minimumOrderAmount || 0);
  if (Number(subtotalRows[0].subtotal) < Math.max(settingsMinimum, Number(zoneRows[0].minimum_order))) throw createError({ statusCode: 400, statusMessage: "Your order does not meet the minimum for this delivery area." });
  if (!slotRows.length || closedRows.length) throw createError({ statusCode: 409, statusMessage: "That delivery date or time slot is unavailable." });
  const dayOffset = Math.ceil((new Date(`${delivery.date}T00:00:00Z`).getTime()-new Date(`${new Date().toISOString().slice(0,10)}T00:00:00Z`).getTime())/86400000);
  if (dayOffset < 0 || dayOffset > Number(deliverySettings.advanceDays || 30)) throw createError({ statusCode: 400, statusMessage: "Choose a delivery date within the available booking window." });
  if (dayOffset === 0 && new Date().toTimeString().slice(0,5) >= String(deliverySettings.sameDayCutoff || "12:00")) throw createError({ statusCode: 409, statusMessage: "Same-day delivery has passed its cutoff time." });
  const computedSubtotal=Number(subtotalRows[0].subtotal);
  const freeThreshold=Number(deliverySettings.freeDeliveryThreshold||0);
  const deliveryFee=freeThreshold>0&&computedSubtotal>=freeThreshold?0:Number(zoneRows[0].fee??deliverySettings.defaultDeliveryFee??25);
  const reference = `BP${randomUUID().replaceAll("-", "").toUpperCase()}`;
  const address = deliverySnapshot ?? { address: delivery.address.trim(), city: delivery.city.trim(), area: delivery.area.trim(), building: delivery.building?.trim() ?? "", apartment: delivery.apartment?.trim() ?? "", street: delivery.address.trim(), recipient_name: customer.fullName.trim(), phone: customer.phone.trim(), delivery_instructions: delivery.instructions?.trim() ?? "" };
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
        ON p.id::text = requested_products."productId"
      ORDER BY p.id
      FOR UPDATE OF p
    ), priced AS (
      SELECT p.id AS product_id, COALESCE(r."customName", p.name) AS name,
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
    ), slot_reservation AS (
      INSERT INTO delivery_slot_bookings (slot_id, delivery_date, booked)
      SELECT ${delivery.slotId}::uuid, ${delivery.date}::date, 1
      WHERE EXISTS (SELECT 1 FROM valid WHERE ok)
        AND EXISTS (SELECT 1 FROM delivery_slots WHERE id=${delivery.slotId}::uuid AND enabled=true)
        AND NOT EXISTS (SELECT 1 FROM delivery_closed_dates WHERE closed_date=${delivery.date}::date)
      ON CONFLICT (slot_id, delivery_date) DO UPDATE SET booked=delivery_slot_bookings.booked+1
        WHERE delivery_slot_bookings.booked < (SELECT max_orders FROM delivery_slots WHERE id=${delivery.slotId}::uuid AND enabled=true)
      RETURNING slot_id
    ), stock_updates AS (
      UPDATE products p SET stock_quantity = p.stock_quantity - lp.quantity, updated_at = now()
      FROM locked_products lp, valid
      WHERE valid.ok AND EXISTS (SELECT 1 FROM slot_reservation) AND p.id = lp.id AND p.stock_quantity IS NOT NULL
      RETURNING p.id
    ), inventory_valid AS (
      SELECT valid.ok AND EXISTS (SELECT 1 FROM slot_reservation)
        AND (SELECT count(*) FROM stock_updates) = (SELECT count(*) FROM locked_products WHERE stock_quantity IS NOT NULL) AS ok
      FROM valid
    ), customer_row AS (
      INSERT INTO customers (full_name, email, phone)
      SELECT ${customer.fullName.trim()}, ${customer.email.trim().toLowerCase()}, ${customer.phone.trim()} FROM inventory_valid, slot_reservation WHERE inventory_valid.ok
      ON CONFLICT (email, phone) DO UPDATE SET full_name = EXCLUDED.full_name RETURNING id
    ), totals AS (SELECT COALESCE(sum(price * quantity), 0)::numeric(10,2) AS subtotal FROM priced),
    new_order AS (
      INSERT INTO orders (order_number, customer_id, subtotal, delivery_fee, total, delivery_address, delivery_date, delivery_time, gift_message, payment_method, payment_provider, status, payment_status, delivery_zone_id, delivery_slot_id, delivery_instructions)
      SELECT ${reference}, customer_row.id, totals.subtotal, ${deliveryFee}, totals.subtotal + ${deliveryFee}, ${JSON.stringify(address)}::jsonb,
        ${delivery.date}::date, ${slotRows[0].label}, ${body.giftMessage?.slice(0, 500) ?? ""}, ${paymentMethod}, ${paymentMethod === "online" ? "stripe" : null},
        'Pending', 'Pending', ${delivery.zoneId}::uuid, ${delivery.slotId}::uuid, ${delivery.instructions?.slice(0,500) ?? ""}
      FROM customer_row, totals, inventory_valid WHERE inventory_valid.ok RETURNING id, order_number, total
    ), saved_items AS (
      INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, size, customization)
      SELECT new_order.id, priced.product_id, priced.name, priced.quantity, priced.price, priced.size, priced.customization FROM new_order CROSS JOIN priced RETURNING order_id
    ), initial_history AS (
      INSERT INTO order_status_history (order_id, status, changed_by)
      SELECT id, 'Pending', 'system' FROM new_order RETURNING order_id
    )
    SELECT new_order.id, new_order.order_number AS reference, new_order.total::float AS total FROM new_order
    `;
  } catch (error) {
    console.error("Order creation database statement failed.", error);
    throw createError({ statusCode: 500, statusMessage: "We couldn't save your order due to a database error. Your cart is unchanged; please try again or contact the shop." });
  }
  if (!rows.length) throw createError({ statusCode: 409, statusMessage: "A product is unavailable or the selected delivery slot just filled. Refresh your bag and choose an available slot." });
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
