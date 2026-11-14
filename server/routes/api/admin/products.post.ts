import { defineHandler } from "nitro";
import { createError, readBody } from "nitro/h3";
import { sql } from "../../../utils/db";
import { isUniqueViolation, validateProductInput } from "../../../utils/product-validation";

export default defineHandler(async event => {
  const product = validateProductInput(await readBody(event));
  if (product.categoryId) {
    const categories = await sql`SELECT id FROM categories WHERE id = ${product.categoryId}::uuid`;
    if (!categories.length) throw createError({ statusCode: 400, statusMessage: "Choose an existing category." });
  }
  try {
    const rows = await sql`
      INSERT INTO products (name, short_description, description, category_id, sku, price, sale_price, image_url, stock_quantity, available, featured)
      VALUES (${product.name}, ${product.shortDescription}, ${product.description}, ${product.categoryId}::uuid,
        ${product.sku}, ${product.price}, ${product.salePrice}, ${product.imageUrl}, ${product.stockQuantity}, ${product.available}, ${product.featured})
      RETURNING id::text AS id, name, short_description, description, sku, price::float AS price,
        sale_price::float AS sale_price, image_url, stock_quantity, available, featured,
        category_id::text AS category_id, created_at, updated_at
    `;
    return rows[0];
  } catch (error) {
    if (isUniqueViolation(error)) throw createError({ statusCode: 409, statusMessage: "That SKU is already assigned to another product." });
    throw error;
  }
});
