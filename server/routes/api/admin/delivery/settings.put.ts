import { defineHandler } from "nitro";
import { createError, readBody } from "nitro/h3";
import { sql } from "../../../../utils/db";
export default defineHandler(async event => {
  const body = await readBody<Record<string, unknown>>(event);
  const numberKeys = ["freeDeliveryThreshold", "defaultDeliveryFee", "minimumOrderAmount", "estimatedDeliveryMinutes", "advanceDays"];
  for (const key of numberKeys) if (typeof body?.[key] !== "number" || !Number.isFinite(body[key]) || Number(body[key]) < 0) throw createError({ statusCode: 400, statusMessage: `Invalid setting: ${key}.` });
  if (typeof body.sameDayCutoff !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(body.sameDayCutoff)) throw createError({ statusCode: 400, statusMessage: "Enter a valid same-day cutoff time." });
  for (const key of ["storeAddress", "contactNumber", "whatsappNumber"]) if (typeof body[key] !== "string") throw createError({ statusCode: 400, statusMessage: `Invalid setting: ${key}.` });
  if (typeof body.deliveryAvailable !== "boolean") throw createError({ statusCode: 400, statusMessage: "Choose whether delivery is available." });
  const rows = await sql`INSERT INTO store_settings (store_key, settings, updated_at) VALUES ('delivery', ${JSON.stringify(body)}::jsonb, now()) ON CONFLICT (store_key) DO UPDATE SET settings=EXCLUDED.settings, updated_at=now() RETURNING settings`;
  return rows[0].settings;
});
