import { defineHandler } from "nitro";
import { createError,readBody } from "nitro/h3";
import { sql } from "../../../../utils/db";
export default defineHandler(async event=>{const body=await readBody<{date?:string;reason?:string}>(event);if(!body?.date||!/^\d{4}-\d{2}-\d{2}$/.test(body.date))throw createError({statusCode:400,statusMessage:"Choose a valid closed date."});return(await sql`INSERT INTO delivery_closed_dates(closed_date,reason) VALUES(${body.date}::date,${(body.reason||"Closed").slice(0,120)}) ON CONFLICT(closed_date) DO UPDATE SET reason=EXCLUDED.reason RETURNING closed_date::text,reason`)[0];});
