import { defineHandler } from "nitro";
import { getQuery } from "nitro/h3";
import { sql } from "../../../../utils/db";
export default defineHandler(async event=>{const query=getQuery(event);const day=typeof query.date==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(query.date)?query.date:new Date().toISOString().slice(0,10);return sql`SELECT o.order_number,o.created_at,o.delivery_date::text,o.delivery_time,o.delivery_address,o.status,o.total::float AS total,c.full_name AS customer_name,c.phone AS customer_phone,c.email AS customer_email FROM orders o JOIN customers c ON c.id=o.customer_id WHERE o.delivery_date >= ${day}::date AND o.status NOT IN ('Cancelled','Delivered') ORDER BY o.delivery_date,o.delivery_time`;});
