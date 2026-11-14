import { defineHandler } from "nitro";
import { createError, getRouterParam, readBody } from "nitro/h3";
import { sql } from "../../../utils/db";

const statuses = ["Pending", "Confirmed", "Preparing", "Out for Delivery", "Delivered", "Cancelled"];

export default defineHandler(async event => {
  const orderNumber = getRouterParam(event, "orderNumber");
  const body = await readBody<{ status?: string }>(event);
  if (!orderNumber || !statuses.includes(body?.status ?? "")) {
    throw createError({ statusCode: 400, statusMessage: "A valid order status is required." });
  }
  const rows = await sql`
    UPDATE orders SET status = ${body.status}
    WHERE order_number = ${orderNumber}
    RETURNING order_number, status, payment_status
  `;
  if (!rows.length) throw createError({ statusCode: 404, statusMessage: "Order not found." });
  return rows[0];
});
