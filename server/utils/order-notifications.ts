import { Resend } from "resend";
import { sql } from "./db";

type NotificationOrder = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  total: number;
  payment_method: string;
  delivery_address: Record<string, string>;
  delivery_date: string;
  delivery_time: string;
  products: Array<{ product_name: string; quantity: number; unit_price: number; size: string }>;
};

async function deliverOnce(orderId: string, channel: string, configured: boolean, deliver: () => Promise<void>) {
  const claim = await sql`
    INSERT INTO order_notifications (order_id, channel, status, attempts)
    VALUES (${orderId}, ${channel}, ${configured ? "sending" : "not_configured"}, ${configured ? 1 : 0})
    ON CONFLICT (order_id, channel) DO UPDATE
      SET status = 'sending', attempts = order_notifications.attempts + 1,
          last_error = NULL, updated_at = now()
      WHERE order_notifications.status IN ('failed', 'not_configured')
         OR (order_notifications.status = 'sending' AND order_notifications.updated_at < now() - interval '15 minutes')
    RETURNING id
  `;
  if (!claim.length || !configured) return;
  try {
    await deliver();
    await sql`UPDATE order_notifications SET status = 'sent', sent_at = now(), updated_at = now() WHERE id = ${claim[0].id}`;
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1000) : "Provider delivery failed";
    await sql`UPDATE order_notifications SET status = 'failed', last_error = ${message}, updated_at = now() WHERE id = ${claim[0].id}`;
  }
}

const formatItems = (order: NotificationOrder) => order.products.map(item => `• ${item.product_name} (${item.size}) × ${item.quantity} — AED ${(item.unit_price * item.quantity).toFixed(2)}`).join("\n");
const formatAddress = (address: NotificationOrder["delivery_address"]) => Object.values(address).filter(Boolean).join(", ");

export async function notifyOrder(order: NotificationOrder) {
  const resendKey = process.env.NITRO_RESEND_API_KEY;
  const from = process.env.NITRO_EMAIL_FROM;
  const ownerEmail = process.env.NITRO_OWNER_EMAIL;
  const emailReady = Boolean(resendKey && from);
  const resend = emailReady ? new Resend(resendKey) : null;
  const text = `Order ${order.order_number}\n\n${formatItems(order)}\n\nTotal: AED ${Number(order.total).toFixed(2)}\nPayment: ${order.payment_method}\nDelivery: ${formatAddress(order.delivery_address)}\n${order.delivery_date} · ${order.delivery_time}`;

  await Promise.allSettled([
    deliverOnce(order.id, "customer_email", emailReady, async () => {
      if (!resend || !from) return;
      const result = await resend.emails.send({ from, to: order.customer_email, subject: `Your Bloom & Petal order ${order.order_number}`, text: `Thank you for your order.\n\n${text}` });
      if (result.error) throw new Error(result.error.message);
    }),
    deliverOnce(order.id, "owner_email", Boolean(emailReady && ownerEmail), async () => {
      if (!resend || !from || !ownerEmail) return;
      const result = await resend.emails.send({ from, to: ownerEmail, subject: `New flower order ${order.order_number}`, text: `A new customer order has been placed.\n\nCustomer: ${order.customer_name} · ${order.customer_phone}\n${text}` });
      if (result.error) throw new Error(result.error.message);
    }),
    sendOwnerWhatsApp(order),
  ]);
}

async function sendOwnerWhatsApp(order: NotificationOrder) {
  const token = process.env.NITRO_WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.NITRO_WHATSAPP_PHONE_NUMBER_ID;
  const ownerNumber = process.env.NITRO_WHATSAPP_OWNER_NUMBER;
  const template = process.env.NITRO_WHATSAPP_TEMPLATE;
  const configured = Boolean(token && phoneNumberId && ownerNumber && template);
  await deliverOnce(order.id, "owner_whatsapp", configured, async () => {
    if (!token || !phoneNumberId || !ownerNumber || !template) return;
    const version = process.env.NITRO_WHATSAPP_GRAPH_VERSION || "v21.0";
    const response = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: ownerNumber,
        type: "template",
        template: {
          name: template,
          language: { code: "en" },
          components: [{ type: "body", parameters: [
            { type: "text", text: order.order_number },
            { type: "text", text: order.customer_name.slice(0, 200) },
            { type: "text", text: `AED ${Number(order.total).toFixed(2)}` },
            { type: "text", text: `${formatItems(order)}\n${formatAddress(order.delivery_address)} · ${order.delivery_date} ${order.delivery_time}`.slice(0, 1024) },
          ] }],
        },
      }),
    });
    if (!response.ok) throw new Error(`WhatsApp API returned ${response.status}`);
  });
}
