import { defineHandler } from "nitro";
import { createError, getRouterParam, readBody } from "nitro/h3";
import { sql } from "../../../../utils/db";
import { isCategoryNameConflict, validateCategoryInput } from "../../../../utils/category-validation";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default defineHandler(async event => {
  const id = getRouterParam(event, "id");
  if (!id || !uuidPattern.test(id)) throw createError({ statusCode: 400, statusMessage: "Invalid category ID." });
  const category = validateCategoryInput(await readBody(event));
  try {
    const rows = await sql`
      UPDATE categories SET name = ${category.name}, description = ${category.description}, image_url = ${category.imageUrl}
      WHERE id = ${id}::uuid RETURNING id::text AS id, name, description, image_url, created_at
    `;
    if (!rows.length) throw createError({ statusCode: 404, statusMessage: "Category not found." });
    return rows[0];
  } catch (error) {
    if (isCategoryNameConflict(error)) throw createError({ statusCode: 409, statusMessage: "A category with that name already exists." });
    throw error;
  }
});
