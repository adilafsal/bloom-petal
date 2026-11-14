import { defineHandler } from "nitro";
import { sql } from "../../utils/db";

export default defineHandler(async () => {
  return sql`
    SELECT c.id::text AS id, c.name, c.description,
           COALESCE(NULLIF(c.image_url, ''), (
             SELECT p.image_url FROM products p
             WHERE p.category_id = c.id AND p.available = true AND p.image_url <> ''
             ORDER BY p.featured DESC, p.created_at DESC LIMIT 1
           )) AS image_url,
           count(p.id)::int AS product_count
    FROM categories c LEFT JOIN products p ON p.category_id = c.id AND p.available = true
    GROUP BY c.id
    HAVING count(p.id) > 0
    ORDER BY c.name ASC
  `;
});
