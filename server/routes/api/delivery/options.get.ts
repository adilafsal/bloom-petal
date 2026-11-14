import { defineHandler } from "nitro";
import { getQuery, createError } from "nitro/h3";
import { sql } from "../../../utils/db";

export default defineHandler(async event => {
  const query = getQuery(event);
  const date = typeof query.date === "string" ? query.date : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw createError({ statusCode: 400, statusMessage: "Choose a valid delivery date." });
  const [settingsRows, zones, slots, closed] = await Promise.all([
    sql`SELECT settings FROM store_settings WHERE store_key = 'delivery'`,
    sql`SELECT id, name, city, country, areas, fee::float AS fee, minimum_order::float AS minimum_order, estimated_minutes FROM delivery_zones WHERE enabled ORDER BY city, name`,
    sql`SELECT s.id, s.label, s.start_time::text, s.end_time::text, s.max_orders,
      greatest(s.max_orders - coalesce(b.booked, 0), 0)::int AS remaining
      FROM delivery_slots s LEFT JOIN delivery_slot_bookings b ON b.slot_id=s.id AND b.delivery_date=${date}::date
      WHERE s.enabled ORDER BY s.start_time`,
    sql`SELECT EXISTS (SELECT 1 FROM delivery_closed_dates WHERE closed_date=${date}::date) AS closed`,
  ]);
  const settings = settingsRows[0]?.settings ?? {};
  const cutoff = String(settings.sameDayCutoff || "12:00");
  const pastCutoff = date === new Date().toISOString().slice(0, 10) && new Date().toTimeString().slice(0, 5) >= cutoff;
  return { settings, zones, slots: closed[0].closed || pastCutoff ? slots.map(slot => ({ ...slot, remaining: 0 })) : slots, closed: closed[0].closed || pastCutoff };
});
