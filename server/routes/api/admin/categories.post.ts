import { defineHandler } from "nitro";
import { createError, readBody } from "nitro/h3";
import { sql } from "../../../utils/db";
import { isCategoryNameConflict, validateCategoryInput } from "../../../utils/category-validation";

export default defineHandler(async event => {
  const category = validateCategoryInput(await readBody(event));
  try {
    const rows = await sql`
      INSERT INTO categories (name, description, image_url)
      VALUES (${category.name}, ${category.description}, ${category.imageUrl})
      RETURNING id::text AS id, name, description, image_url, created_at
    `;
    return rows[0];
  } catch (error) {
    if (isCategoryNameConflict(error)) throw createError({ statusCode: 409, statusMessage: "A category with that name already exists." });
    throw error;
  }
});
