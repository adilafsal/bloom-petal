import { defineHandler } from "nitro";
import { sql } from "../../../../utils/db";
export default defineHandler(async () => {
  const rows = await sql`SELECT settings FROM store_settings WHERE store_key='delivery'`;
  return rows[0]?.settings ?? {};
});
