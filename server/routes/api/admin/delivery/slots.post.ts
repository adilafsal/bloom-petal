import { defineHandler } from "nitro";
import { createError, readBody } from "nitro/h3";
import { sql } from "../../../../utils/db";
export default defineHandler(async event => {
 const body=await readBody<{label?:string;startTime?:string;endTime?:string;maxOrders?:number;enabled?:boolean}>(event);
 if(!body?.label?.trim()||!/^([01]\d|2[0-3]):[0-5]\d$/.test(body.startTime||"")||!/^([01]\d|2[0-3]):[0-5]\d$/.test(body.endTime||"")||body.endTime!<=body.startTime!||!Number.isInteger(body.maxOrders)||body.maxOrders!<1) throw createError({statusCode:400,statusMessage:"Enter a valid slot label, time range, and capacity."});
 return (await sql`INSERT INTO delivery_slots(label,start_time,end_time,max_orders,enabled) VALUES(${body.label.trim()},${body.startTime},${body.endTime},${body.maxOrders},${body.enabled??true}) RETURNING id,label,start_time::text,end_time::text,max_orders,enabled`)[0];
});
