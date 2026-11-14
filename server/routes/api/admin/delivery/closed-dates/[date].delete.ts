import { defineHandler } from "nitro";
import { createError,getRouterParam } from "nitro/h3";
import { sql } from "../../../../../utils/db";
export default defineHandler(async event=>{const date=getRouterParam(event,"date");if(!date||!/^\d{4}-\d{2}-\d{2}$/.test(date))throw createError({statusCode:400,statusMessage:"Valid closed date required."});const rows=await sql`DELETE FROM delivery_closed_dates WHERE closed_date=${date}::date RETURNING closed_date`;if(!rows.length)throw createError({statusCode:404,statusMessage:"Closed date not found."});return{ok:true};});
