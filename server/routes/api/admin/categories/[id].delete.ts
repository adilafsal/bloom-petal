import { defineHandler } from "nitro";
import { createError, getRouterParam } from "nitro/h3";
import { sql } from "../../../../utils/db";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default defineHandler(async event => {
  const id = getRouterParam(event, "id");
  if (!id || !uuidPattern.test(id)) throw createError({ statusCode: 400, statusMessage: "Invalid category ID." });
  try {
    const rows = await sql`
      DELETE FROM categories c
      WHERE c.id = ${id}::uuid
        AND NOT EXISTS (SELECT 1 FROM products p WHERE p.category_id = c.id)
      RETURNING c.id::text AS id
    `;
    if (rows.length) return { deleted: true, id: rows[0].id };
    const existing = await sql`SELECT count(*)::int AS products FROM products WHERE category_id = ${id}::uuid`;
    const category = await sql`SELECT id FROM categories WHERE id = ${id}::uuid`;
    if (!category.length) throw createError({ statusCode: 404, statusMessage: "Category not found." });
    throw createError({ statusCode: 409, statusMessage: `This category still contains ${existing[0].products} product${existing[0].products === 1 ? "" : "s"}. Reassign or delete those products first.` });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23503") {
      throw createError({ statusCode: 409, statusMessage: "This category still contains products. Reassign them before deleting the category." });
    }
    throw error;
  }
});
