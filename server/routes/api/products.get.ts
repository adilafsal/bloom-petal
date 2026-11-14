import { defineHandler } from "nitro";
import { sql } from "../../utils/db";

export default defineHandler(async () => {
  return sql`
    SELECT COALESCE(p.legacy_id::text, p.id::text) AS id,
           p.id::text AS database_id, p.name, p.short_description, p.description,
           COALESCE(p.sale_price, p.price)::float AS price, p.price::float AS regular_price,
           p.sale_price::float AS sale_price, p.category_id::text AS category_id,
           c.name AS category, p.image_url AS image, p.available, p.stock_quantity, p.featured
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.available = true
    ORDER BY p.featured DESC, p.created_at DESC
  `;
});
