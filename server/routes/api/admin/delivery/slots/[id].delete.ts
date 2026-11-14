import { defineHandler } from "nitro";
import { createError,getRouterParam } from "nitro/h3";
import { sql } from "../../../../../utils/db";
export default defineHandler(async event=>{const id=getRouterParam(event,"id");if(!id)throw createError({statusCode:400,statusMessage:"Slot ID is required."});const rows=await sql`DELETE FROM delivery_slots WHERE id=${id} RETURNING id`;if(!rows.length)throw createError({statusCode:404,statusMessage:"Delivery slot not found."});return {ok:true};});
