import { defineHandler } from "nitro";
import { sql } from "../../utils/db";

export default defineHandler(async () => {
  const rows = await sql`
    SELECT p.legacy_id AS id, p.name, p.description, p.price::float AS price,
           c.name AS category, p.image_url AS image, p.available
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.available = true
    ORDER BY p.legacy_id NULLS LAST, p.created_at DESC
  `;
  return rows;
});
