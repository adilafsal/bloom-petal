import { defineHandler } from "nitro";
import { sql } from "../../../utils/db";

export default defineHandler(async () => {
  return sql`
    SELECT c.id::text AS id, c.name, c.description, c.image_url, c.created_at,
           count(p.id)::int AS product_count
    FROM categories c LEFT JOIN products p ON p.category_id = c.id
    GROUP BY c.id
    ORDER BY c.name ASC
  `;
});
