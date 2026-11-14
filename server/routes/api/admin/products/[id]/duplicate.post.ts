import { defineHandler } from "nitro";
import { createError, getRouterParam } from "nitro/h3";
import { sql } from "../../../../utils/db";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default defineHandler(async event => {
  const id = getRouterParam(event, "id");
  if (!id || !uuidPattern.test(id)) throw createError({ statusCode: 400, statusMessage: "Invalid product ID." });
  const rows = await sql`
    INSERT INTO products (name, short_description, description, category_id, price, sale_price, image_url, stock_quantity, available, featured)
    SELECT left(name || ' (Copy)', 120), short_description, description, category_id, price, sale_price, image_url, NULL, false, featured
    FROM products WHERE id = ${id}::uuid
    RETURNING id::text AS id, name, short_description, description, sku, price::float AS price,
      sale_price::float AS sale_price, image_url, stock_quantity, available, featured,
      category_id::text AS category_id, created_at, updated_at
  `;
  if (!rows.length) throw createError({ statusCode: 404, statusMessage: "Product not found." });
  return rows[0];
});
