import { defineHandler } from "nitro";
import { getQuery } from "nitro/h3";
import { sql } from "../../../utils/db";

export default defineHandler(async event => {
  const query = getQuery(event);
  const search = typeof query.search === "string" ? query.search.trim().slice(0, 120) : "";
  const category = typeof query.category === "string" ? query.category : "";
  const availability = typeof query.availability === "string" ? query.availability : "all";
  const sort = typeof query.sort === "string" && ["newest", "oldest", "price-low", "price-high", "name"].includes(query.sort) ? query.sort : "newest";
  const pageValue = typeof query.page === "string" ? Number.parseInt(query.page, 10) : 1;
  const page = Number.isSafeInteger(pageValue) && pageValue > 0 ? Math.min(pageValue, 100000) : 1;
  const limit = 20;
  const pattern = `%${search.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
  const [products, totals] = await Promise.all([
    sql`
      SELECT p.id::text AS id, p.name, p.short_description, p.description,
             p.sku, p.price::float AS price, p.sale_price::float AS sale_price,
             p.image_url, p.stock_quantity, p.available, p.featured,
             p.category_id::text AS category_id, c.name AS category_name,
             p.created_at, p.updated_at
      FROM products p LEFT JOIN categories c ON c.id = p.category_id
      WHERE (${search} = '' OR p.name ILIKE ${pattern} OR COALESCE(p.sku, '') ILIKE ${pattern})
        AND (${category} = '' OR p.category_id::text = ${category})
        AND (${availability} = 'all'
          OR (${availability} = 'active' AND p.available = true)
          OR (${availability} = 'hidden' AND p.available = false)
          OR (${availability} = 'out' AND p.available = true AND p.stock_quantity = 0))
      ORDER BY
        CASE WHEN ${sort} = 'oldest' THEN p.created_at END ASC,
        CASE WHEN ${sort} = 'newest' THEN p.created_at END DESC,
        CASE WHEN ${sort} = 'price-low' THEN COALESCE(p.sale_price, p.price) END ASC,
        CASE WHEN ${sort} = 'price-high' THEN COALESCE(p.sale_price, p.price) END DESC,
        CASE WHEN ${sort} = 'name' THEN p.name END ASC,
        p.created_at DESC
      LIMIT ${limit} OFFSET ${(page - 1) * limit}
    `,
    sql`
      SELECT count(*)::int AS total FROM products p
      WHERE (${search} = '' OR p.name ILIKE ${pattern} OR COALESCE(p.sku, '') ILIKE ${pattern})
        AND (${category} = '' OR p.category_id::text = ${category})
        AND (${availability} = 'all'
          OR (${availability} = 'active' AND p.available = true)
          OR (${availability} = 'hidden' AND p.available = false)
          OR (${availability} = 'out' AND p.available = true AND p.stock_quantity = 0))
    `,
  ]);
  return { products, total: totals[0].total, page, pageSize: limit };
});
