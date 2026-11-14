import { defineHandler } from "nitro";
import { createError, getRouterParam } from "nitro/h3";
import { sql } from "../../../../../utils/db";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default defineHandler(async event => {
  const id = getRouterParam(event, "id");
  if (!id || !uuidPattern.test(id)) throw createError({ statusCode: 400, statusMessage: "A valid delivery zone ID is required." });
  const linked = await sql`SELECT count(*)::int AS count FROM orders WHERE delivery_zone_id=${id}::uuid`;
  if (!linked.length || linked[0].count > 0) throw createError({ statusCode: 409, statusMessage: "This zone is attached to existing orders. Disable it instead to preserve order history." });
  const rows = await sql`DELETE FROM delivery_zones WHERE id=${id}::uuid RETURNING id`;
  if (!rows.length) throw createError({ statusCode: 404, statusMessage: "Delivery zone not found." });
  return { ok: true };
});
