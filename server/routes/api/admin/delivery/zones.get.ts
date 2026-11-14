import { defineHandler } from "nitro";
import { sql } from "../../../../utils/db";
export default defineHandler(async () => sql`SELECT id, name, city, country, areas, fee::float AS fee, minimum_order::float AS minimum_order, estimated_minutes, enabled FROM delivery_zones ORDER BY city, name`);
