import { defineHandler } from "nitro";
import { createError, readBody } from "nitro/h3";
import { sql } from "../../../../utils/db";
export default defineHandler(async event => {
  const body = await readBody<{ name?: string; city?: string; country?: string; areas?: string[]; fee?: number; minimumOrder?: number; estimatedMinutes?: number; enabled?: boolean }>(event);
  if (!body?.name?.trim() || !body.city?.trim() || !body.country?.trim() || !Array.isArray(body.areas) || !body.areas.length || body.areas.some(area => typeof area !== "string" || !area.trim()) || !Number.isFinite(body.fee) || body.fee! < 0 || !Number.isFinite(body.minimumOrder) || body.minimumOrder! < 0 || !Number.isInteger(body.estimatedMinutes) || body.estimatedMinutes! < 1) throw createError({ statusCode: 400, statusMessage: "Complete valid delivery zone details are required." });
  return (await sql`INSERT INTO delivery_zones (name,city,country,areas,fee,minimum_order,estimated_minutes,enabled) VALUES (${body.name.trim()},${body.city.trim()},${body.country.trim()},${body.areas.map(area=>area.trim())},${body.fee},${body.minimumOrder},${body.estimatedMinutes},${body.enabled ?? true}) RETURNING id,name,city,country,areas,fee::float AS fee,minimum_order::float AS minimum_order,estimated_minutes,enabled`)[0];
});
