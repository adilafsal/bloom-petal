import { defineHandler } from "nitro";
import { createError, getRouterParam, readBody } from "nitro/h3";
import { sql } from "../../../../../utils/db";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default defineHandler(async event => {
  const id = getRouterParam(event, "id");
  const body = await readBody<Record<string, unknown>>(event);
  const minimumOrder = body?.minimumOrder ?? body?.minimum_order;
  const estimatedMinutes = body?.estimatedMinutes ?? body?.estimated_minutes;
  if (!id || !uuidPattern.test(id) || typeof body?.name !== "string" || !body.name.trim() || typeof body.city !== "string" || !body.city.trim() || typeof body.country !== "string" || !body.country.trim() || !Array.isArray(body.areas) || !body.areas.length || body.areas.some(area => typeof area !== "string" || !area.trim()) || !Number.isFinite(body.fee) || Number(body.fee) < 0 || !Number.isFinite(minimumOrder) || Number(minimumOrder) < 0 || !Number.isInteger(estimatedMinutes) || Number(estimatedMinutes) < 1 || typeof body.enabled !== "boolean") {
    throw createError({ statusCode: 400, statusMessage: "Complete valid delivery zone details are required." });
  }
  const rows = await sql`UPDATE delivery_zones SET name=${body.name.trim()}, city=${body.city.trim()}, country=${body.country.trim()}, areas=${(body.areas as string[]).map(area => area.trim())}, fee=${Number(body.fee)}, minimum_order=${Number(minimumOrder)}, estimated_minutes=${Number(estimatedMinutes)}, enabled=${body.enabled}, updated_at=now() WHERE id=${id}::uuid RETURNING id, name, city, country, areas, fee::float AS fee, minimum_order::float AS minimum_order, estimated_minutes, enabled`;
  if (!rows.length) throw createError({ statusCode: 404, statusMessage: "Delivery zone not found." });
  return rows[0];
});
