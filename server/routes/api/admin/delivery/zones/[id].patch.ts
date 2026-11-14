import { defineHandler } from "nitro";
import { createError, getRouterParam, readBody } from "nitro/h3";
import { sql } from "../../../../../utils/db";
export default defineHandler(async event => {
  const id=getRouterParam(event,"id"), body=await readBody<Record<string,unknown>>(event);
  if (!id || typeof body?.name!=="string" || !body.name.trim() || typeof body.city!=="string" || !body.city.trim() || typeof body.country!=="string" || !body.country.trim() || !Array.isArray(body.areas) || !body.areas.length || body.areas.some(area=>typeof area!=="string"||!area.trim()) || !Number.isFinite(body.fee) || Number(body.fee)<0 || !Number.isFinite(body.minimumOrder) || Number(body.minimumOrder)<0 || !Number.isInteger(body.estimatedMinutes) || Number(body.estimatedMinutes)<1 || typeof body.enabled!=="boolean") throw createError({statusCode:400,statusMessage:"Complete valid delivery zone details are required."});
  const rows=await sql`UPDATE delivery_zones SET name=${body.name.trim()},city=${body.city.trim()},country=${body.country.trim()},areas=${(body.areas as string[]).map(area=>area.trim())},fee=${body.fee},minimum_order=${body.minimumOrder},estimated_minutes=${body.estimatedMinutes},enabled=${body.enabled},updated_at=now() WHERE id=${id} RETURNING id,name,city,country,areas,fee::float AS fee,minimum_order::float AS minimum_order,estimated_minutes,enabled`;
  if(!rows.length) throw createError({statusCode:404,statusMessage:"Delivery zone not found."}); return rows[0];
});
