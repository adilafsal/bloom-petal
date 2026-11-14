import Stripe from "stripe";

const secretKey = process.env.NITRO_STRIPE_SECRET_KEY;
export const stripe = secretKey ? new Stripe(secretKey) : null;
export const onlinePaymentsEnabled = Boolean(stripe && process.env.NITRO_PUBLIC_BASE_URL && process.env.NITRO_STRIPE_WEBHOOK_SECRET);

export async function createStripeCheckout(order: {
  id: string; orderNumber: string; customerEmail: string; total: number; deliveryFee: number;
  items: Array<{ name: string; quantity: number; unitPrice: number }>;
}) {
  if (!stripe || !onlinePaymentsEnabled) throw new Error("Online payment is not configured on this server.");
  const baseUrl = process.env.NITRO_PUBLIC_BASE_URL!;
  const currency = (process.env.NITRO_CURRENCY || "AED").toLowerCase();
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = order.items.map(item => ({
    quantity: item.quantity,
    price_data: {
      currency,
      unit_amount: Math.round(item.unitPrice * 100),
      product_data: { name: item.name },
    },
  }));
  if (order.deliveryFee > 0) lineItems.push({
    quantity: 1,
    price_data: { currency, unit_amount: Math.round(order.deliveryFee * 100), product_data: { name: "Flower delivery" } },
  });
  return stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: order.customerEmail,
    line_items: lineItems,
    success_url: `${baseUrl}/confirmation/${encodeURIComponent(order.orderNumber)}?payment=success`,
    cancel_url: `${baseUrl}/checkout?payment=cancelled`,
    client_reference_id: order.orderNumber,
    metadata: { orderId: order.id, orderNumber: order.orderNumber },
  }, { idempotencyKey: `bloom-petal-order-${order.id}` });
}
