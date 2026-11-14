import { defineHandler } from "nitro";
import { createError, getRequestHeader, readRawBody } from "nitro/h3";
import { sql } from "../../../utils/db";
import { notifyOrderByReference } from "../../../utils/notify-order-by-reference";
import { stripe } from "../../../utils/payments";

export default defineHandler(async event => {
  const secret = process.env.NITRO_STRIPE_WEBHOOK_SECRET;
  const signature = getRequestHeader(event, "stripe-signature");
  const rawBody = await readRawBody(event, false);
  if (!stripe || !secret || !signature || !rawBody) throw createError({ statusCode: 503, statusMessage: "Payment webhook is not configured." });
  let stripeEvent;
  try { stripeEvent = stripe.webhooks.constructEvent(rawBody, signature, secret); }
  catch { throw createError({ statusCode: 400, statusMessage: "Invalid payment webhook signature." }); }
  if (stripeEvent.type === "checkout.session.completed" || stripeEvent.type === "checkout.session.async_payment_succeeded") {
    const session = stripeEvent.data.object;
    if (session.payment_status === "paid" && session.metadata?.orderNumber) {
      const rows = await sql`
        UPDATE orders SET payment_status = 'Paid', status = 'Confirmed'
        WHERE order_number = ${session.metadata.orderNumber} AND payment_session_id = ${session.id}
        RETURNING order_number
      `;
      if (rows[0]) await notifyOrderByReference(rows[0].order_number);
    }
  }
  if (stripeEvent.type === "checkout.session.expired") {
    const session = stripeEvent.data.object;
    if (session.metadata?.orderNumber) await sql`
      UPDATE orders SET payment_status = 'Expired', status = 'Pending'
      WHERE order_number = ${session.metadata.orderNumber} AND payment_session_id = ${session.id} AND payment_status <> 'Paid'
    `;
  }
  return { received: true };
});
