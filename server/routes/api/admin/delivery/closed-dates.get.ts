import { defineHandler } from "nitro";
import { sql } from "../../../../utils/db";
export default defineHandler(async()=>sql`SELECT closed_date::text,reason FROM delivery_closed_dates ORDER BY closed_date`);
