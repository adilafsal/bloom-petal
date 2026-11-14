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
  products: Array<{
    product_name: string;
    quantity: number;
    unit_price: number;
    size: string;
    customization: Record<string, unknown>;
    image_url?: string | null;
  }>;
};

// Premium florist email HTML template
function renderEmailTemplate(order: NotificationOrder, siteUrl: string, supportEmail: string, supportPhone: string, unsubscribeUrl?: string): string {
  const productsHtml = order.products.map((item, idx) => {
    const img = item.image_url && item.image_url.startsWith("http") 
      ? `<img src="${item.image_url}" alt="${item.product_name}" style="width:100%; max-width:120px; height:auto; border-radius:6px; object-fit:cover; display:block;" />`
      : "";
    const customizationHtml = Object.keys(item.customization || {}).length > 0
      ? `<div style="font-size:10px; color:#6b727c; margin-top:4px;">
          ${Object.entries(item.customization).map(([key, value]) => {
            const val = Array.isArray(value) ? value.join(", ") : String(value);
            return `<span style="margin-right:8px;">${key}: ${val}</span>`;
          }).join("")}
        </div>`
      : "";

    return `
      <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:8px;">
        ${img}
        <div style="flex:1;">
          <div style="font:700 11px/1.4 var(--serif,Georgia,serif),serif; color:#2d3a38; margin-bottom:2px;">${item.product_name}</div>
          <div style="font:400 9px/1.3 var(--sans,Arial,sans-serif),sans-serif; color:#5a6b66; margin-bottom:2px;">${item.size} · Qty ${item.quantity}</div>
          ${customizationHtml}
          <div style="font:400 9px/1.3 var(--sans,Arial,sans-serif),sans-serif; color:#5a6b66;">
            AED ${Number(item.unit_price * item.quantity).toFixed(2)}
          </div>
        </div>
      </div>
    `;
  }).join("");

  const paymentMethodDisplay = order.payment_method === "cash_on_delivery"
    ? `<div style="font:400 9px/1.3 var(--sans,Arial,sans-serif),sans-serif; color:#5a6b66;">
        Payment upon delivery · Cash on Delivery
      </div>`
    : `<div style="font:400 9px/1.3 var(--sans,Arial,sans-serif),sans-serif; color:#5a6b66;">
        ${order.payment_method}
      </div>`;

  const unsubscribeHtml = unsubscribeUrl
    ? `<div style="margin-top:24px; font-size:9px; color:#6b727c;">
        <a href="${unsubscribeUrl}" style="color:#6b727c; text-decoration:underline;">Unsubscribe from marketing emails</a>
      </div>`
    : "";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmation - Bloom & Petal</title>
</head>
<body style="margin:0; padding:0; background:#faf8f4; font-family: Arial, Helvetica, sans-serif; line-height:1.6;">
  <!-- Brand Header -->
  <div style="background:#34483f; padding:24px 32px 16px; text-align:center;">
    <a href="${siteUrl}" style="text-decoration:none; color:#fff;">
      <div style="display:inline-flex; align-items:center; gap:10px; margin-bottom:8px;">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:#e0b7a9;">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 7l10 5 10-5"/>
          <circle cx="12" cy="7" r="3"/>
        </svg>
        <span style="font:26px/1.05 var(--serif,Georgia,serif),serif; color:#fff; letter-spacing:-.02em;">Bloom & Petal</span>
      </div>
    </a>
    <div style="width:40px; height:1px; background:#e0b7a9; margin:12px auto 0;"></div>
  </div>

  <!-- Hero Section -->
  <div style="background:linear-gradient(135deg, #f5f0eb 0%, #faf8f4 100%); padding:32px 32px 24px; text-align:center; border-bottom:1px solid #e8e1d8;">
    <img src="https://images.unsplash.com/photo-1494972308805-463bc619d34e?auto=format&fit=crop&w=800&q=85" alt="Premium flower bouquet" style="width:100%; max-width:600px; height:auto; margin:0 auto 24px; border-radius:8px; object-fit:cover;">
    <h1 style="margin:0 0 8px; font:700 32px/1.1 var(--serif,Georgia,serif),serif; color:#2d3a38; letter-spacing:-.02em;">A little beauty is on its way.</h1>
    <p style="margin:0; max-width:560px; margin:0 auto; font:400 14px/1.6 var(--sans,Arial,sans-serif),sans-serif; color:#5a6b66; line-height:1.5;">
      Thank you for choosing Bloom & Petal. Your order has been confirmed and our florists are preparing your arrangement with care.
    </p>
  </div>

  <!-- Order Confirmation -->
  <div style="padding:0 32px 24px;">
    <div style="background:#fffefa; border:1px solid #e8e1d8; border-radius:8px; padding:20px 24px; margin-bottom:24px;">
      <span style="display:block; font:700 10px/1.3 var(--sans,Arial,sans-serif),sans-serif; text-transform:uppercase; letter-spacing:.1em; color:#8c7563; margin-bottom:8px;">ORDER CONFIRMED</span>
      <h2 style="margin:0 0 12px; font:700 22px/1.1 var(--serif,Georgia,serif),serif; color:#2d3a38;">Order #${order.order_number}</h2>
      <p style="margin:0; font:400 12px/1.5 var(--sans,Arial,sans-serif),sans-serif; color:#5a6b66;">
        Placed on ${new Date(order.delivery_date).toLocaleDateString()}
      </p>
      <p style="margin:8px 0 0; font:400 12px/1.5 var(--sans,Arial,sans-serif),sans-serif; color:#5a6b66;">
        Dear ${order.customer_name.split(" ")[0]},
      </p>
    </div>

    <!-- Order Details -->
    <div style="background:#fffefa; border:1px solid #e8e1d8; border-radius:8px; padding:20px 24px; margin-bottom:24px;">
      <span style="display:block; font:700 10px/1.3 var(--sans,Arial,sans-serif),sans-serif; text-transform:uppercase; letter-spacing:.1em; color:#8c7563; margin-bottom:12px;">ORDER DETAILS</span>
      <div style="margin-bottom:16px;">
        ${productsHtml}
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:16px; padding-top:16px; border-top:1px solid #eee;">
        <span style="font:400 11px/1.4 var(--sans,Arial,sans-serif),sans-serif; color:#5a6b66;">Subtotal</span>
        <span style="font:700 14px/1.2 var(--serif,Georgia,serif),serif; color:#2d3a38; font-variant-numeric:tabular-nums;">AED ${Number(order.total - (order.delivery_fee || 0)).toFixed(2)}</span>
      </div>
    </div>

    <!-- Delivery Information -->
    <div style="background:#fffefa; border:1px solid #e8e1d8; border-radius:8px; padding:20px 24px; margin-bottom:24px;">
      <span style="display:block; font:700 10px/1.3 var(--sans,Arial,sans-serif),sans-serif; text-transform:uppercase; letter-spacing:.1em; color:#8c7563; margin-bottom:12px;">DELIVERY INFORMATION</span>
      <div style="font:400 11px/1.6 var(--sans,Arial,sans-serif),sans-serif; color:#5a6b66; margin-bottom:12px;">
        <strong>Recipient:</strong> ${order.customer_name}<br/>
        <strong>Phone:</strong> ${order.customer_phone}<br/>
        <strong>Address:</strong> ${order.delivery_address.address || ''} ${order.delivery_address.building || ''} ${order.delivery_address.street || ''} ${order.delivery_address.area || ''}, ${order.delivery_address.city}<br/>
        ${order.delivery_address.delivery_instructions && order.delivery_address.delivery_instructions !== "''::text" ? `<strong>Delivery instructions:</strong> ${order.delivery_address.delivery_instructions}<br/>` : ''}
        <strong>Delivery date:</strong> ${new Date(order.delivery_date).toLocaleDateString()}<br/>
        <strong>Delivery time:</strong> ${order.delivery_time}
      </div>
    </div>

    <!-- Payment Information -->
    <div style="background:#fffefa; border:1px solid #e8e1d8; border-radius:8px; padding:20px 24px; margin-bottom:24px;">
      <span style="display:block; font:700 10px/1.3 var(--sans,Arial,sans-serif),sans-serif; text-transform:uppercase; letter-spacing:.1em; color:#8c7563; margin-bottom:12px;">PAYMENT INFORMATION</span>
      ${paymentMethodDisplay}
      <div style="margin-top:12px; font:400 11px/1.5 var(--sans,Arial,sans-serif),sans-serif; color:#5a6b66;">
        ${order.payment_method === "cash_on_delivery" 
          ? "Payment will be collected from the recipient upon delivery." 
          : "Your payment has been processed successfully."}
      </div>
    </div>

    <!-- Order Tracking -->
    <div style="text-align:center; margin:24px 0;">
      <a href="${siteUrl}/order/${order.order_number}" style="display:inline-block; background:#4d9a6a; color:#fff; text-decoration:none; padding:12px 28px; font:700 13px/1.3 var(--sans,Arial,sans-serif),sans-serif; border-radius:5px; margin-bottom:8px;">
        View Your Order
      </a>
      <p style="margin:8px 0 0; font:400 11px/1.5 var(--sans,Arial,sans-serif),sans-serif; color:#6b727c;">
        Track your order status and delivery details
      </p>
    </div>
  </div>

  <!-- Footer -->
  <div style="background:#34483f; padding:32px 32px 24px; color:#fff; font-size:12px;">
    <div style="max-width:600px; margin:0 auto; text-align:center;">
      <div style="width:56px; height:56px; background:#e0b7a9; margin:0 auto 24px; border-radius:50; display:flex; align-items:center; justify-content:center;">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:#34483f;">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 7l10 5 10-5"/>
          <circle cx="12" cy="7" r="3"/>
        </svg>
      </div>
      <h3 style="margin:0 0 8px; font:700 20px/1.2 var(--serif,Georgia,serif),serif; color:#fff;">Bloom & Petal</h3>
      <p style="margin:0 0 24px; font:400 12px/1.6 var(--sans,Arial,sans-serif),sans-serif; color:#c8c1ba; line-height:1.5;">
        Thank you for supporting our small floral business. We're dedicated to bringing beauty to every moment.
      </p>
      <div style="margin-bottom:24px; padding-bottom:24px; border-bottom:1px solid #4a564e;">
        <p style="margin:0 0 8px; font:700 11px/1.3 var(--sans,Arial,sans-serif),sans-serif; color:#fff;">Contact</p>
        <div style="display:flex; justify-content:center; gap:24px; flex-wrap:wrap; font:400 11px/1.5 var(--sans,Arial,sans-serif),sans-serif; color:#c8c1ba;">
          <span>📧 ${supportEmail}</span>
          <span>📞 ${supportPhone}</span>
        </div>
      </div>
      <p style="margin:0; font:400 11px/1.5 var(--sans,Arial,sans-serif),sans-serif; color:#c8c1ba; line-height:1.5;">
        ${siteUrl}
      </p>
      ${unsubscribeHtml}
    </div>
  </div>
</body>
</html>
  `;
}

export async function notifyOrder(order: NotificationOrder) {
  const resendKey = process.env.NITRO_RESEND_API_KEY;
  const from = process.env.NITRO_EMAIL_FROM;
  const ownerEmail = process.env.NITRO_OWNER_EMAIL;
  const emailReady = Boolean(resendKey && from);
  const resend = emailReady ? new Resend(resendKey) : null;

  // Fetch store settings for contact info and site URL
  const settingsRows = await sql`SELECT settings FROM store_settings WHERE store_key='delivery'`;
  const settings = settingsRows[0]?.settings ?? {};
  const supportEmail = settings.contactNumber ? null : (process.env.NITRO_SUPPORT_EMAIL || "support@bloomandpetal.example");
  const supportPhone = settings.whatsappNumber || process.env.NITRO_SUPPORT_PHONE || "+971 50 123 4567";
  const siteUrl = process.env.NITRO_SITE_URL || "https://bloomandpetal.example";

  const text = `Order ${order.order_number}

${order.products.map(item => `• ${item.product_name} (${item.size}) × ${item.quantity} — AED ${(item.unit_price * item.quantity).toFixed(2)}`).join("\n")}

Total: AED ${Number(order.total).toFixed(2)}
Payment: ${order.payment_method}
Delivery: ${order.delivery_address.address || ''} ${order.delivery_address.building || ''} ${order.delivery_address.street || ''} ${order.delivery_address.area || ''}, ${order.delivery_address.city}
${order.delivery_date} · ${order.delivery_time}

Thank you for your order from Bloom & Petal.

---
This is a transactional order confirmation from Bloom & Petal.
If you have questions, please contact: ${supportEmail}
`;

  await Promise.allSettled([
    deliverOnce(order.id, "customer_email", emailReady, async () => {
      if (!resend || !from) return;
      const html = renderEmailTemplate(order, siteUrl, supportEmail, supportPhone);
      const result = await resend.emails.send({ from, to: order.customer_email, subject: `Your Bloom & Petal order ${order.order_number}`, html });
      if (result.error) throw new Error(result.error.message);
    }),
    deliverOnce(order.id, "owner_email", Boolean(emailReady && ownerEmail), async () => {
      if (!resend || !from || !ownerEmail) return;
      const html = renderEmailTemplate(order, siteUrl, supportEmail, supportPhone);
      const result = await resend.emails.send({ from, to: ownerEmail, subject: `New flower order ${order.order_number}`, html });
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
    const itemsHtml = order.products.map(item => 
      `• ${item.product_name} (${item.size}) × ${item.quantity}`
    ).join("\n");
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
            { type: "text", text: `${itemsHtml}\n${order.delivery_address.address || ''} ${order.delivery_address.building || ''} ${order.delivery_address.street || ''} ${order.delivery_address.area || ''}, ${order.delivery_address.city} · ${order.delivery_date} ${order.delivery_time}`.slice(0, 1024) },
          ] }],
        },
      }),
    });
    if (!response.ok) throw new Error(`WhatsApp API returned ${response.status}`);
  });
}

function formatItems(order: NotificationOrder) {
  return order.products.map(item => `• ${item.product_name} (${item.size}) × ${item.quantity} — AED ${(item.unit_price * item.quantity).toFixed(2)}`).join("\n");
}
function formatAddress(address: NotificationOrder["delivery_address"]) {
  return Object.values(address).filter(Boolean).join(", ");
}