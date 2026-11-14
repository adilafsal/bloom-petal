import { defineHandler } from "nitro";
import { createError, getRouterParam } from "nitro/h3";
import { sql } from "../../../utils/db";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default defineHandler(async event => {
  const id = getRouterParam(event, "id");
  if (!id || !uuidPattern.test(id)) throw createError({ statusCode: 400, statusMessage: "Invalid product ID." });
  const rows = await sql`DELETE FROM products WHERE id = ${id}::uuid RETURNING id::text AS id`;
  if (!rows.length) throw createError({ statusCode: 404, statusMessage: "Product not found." });
  return { deleted: true, id: rows[0].id };
});
