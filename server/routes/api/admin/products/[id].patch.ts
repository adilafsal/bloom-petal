import { defineHandler } from "nitro";
import { createError, getRouterParam, readBody } from "nitro/h3";
import { sql } from "../../../utils/db";
import { isUniqueViolation, validateProductInput } from "../../../utils/product-validation";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default defineHandler(async event => {
  const id = getRouterParam(event, "id");
  if (!id || !uuidPattern.test(id)) throw createError({ statusCode: 400, statusMessage: "Invalid product ID." });
  const product = validateProductInput(await readBody(event));
  if (product.categoryId) {
    const categories = await sql`SELECT id FROM categories WHERE id = ${product.categoryId}::uuid`;
    if (!categories.length) throw createError({ statusCode: 400, statusMessage: "Choose an existing category." });
  }
  try {
    const rows = await sql`
      UPDATE products SET name = ${product.name}, short_description = ${product.shortDescription},
        description = ${product.description}, category_id = ${product.categoryId}::uuid, sku = ${product.sku},
        price = ${product.price}, sale_price = ${product.salePrice}, image_url = ${product.imageUrl},
        stock_quantity = ${product.stockQuantity}, available = ${product.available}, featured = ${product.featured}, updated_at = now()
      WHERE id = ${id}::uuid
      RETURNING id::text AS id, name, short_description, description, sku, price::float AS price,
        sale_price::float AS sale_price, image_url, stock_quantity, available, featured,
        category_id::text AS category_id, created_at, updated_at
    `;
    if (!rows.length) throw createError({ statusCode: 404, statusMessage: "Product not found." });
    return rows[0];
  } catch (error) {
    if (isUniqueViolation(error)) throw createError({ statusCode: 409, statusMessage: "That SKU is already assigned to another product." });
    throw error;
  }
});
