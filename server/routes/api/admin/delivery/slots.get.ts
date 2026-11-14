import { defineHandler } from "nitro";
import { sql } from "../../../../utils/db";
export default defineHandler(async () => sql`SELECT id,label,start_time::text,end_time::text,max_orders,enabled FROM delivery_slots ORDER BY start_time`);
