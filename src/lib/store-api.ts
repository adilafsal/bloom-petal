import type { Product } from "../store";

export type StoreProduct = Product & { available: boolean };
export type PlaceOrderInput = {
  customer: { fullName: string; email: string; phone: string };
  items: Array<{ productId: number; quantity: number; size: string; customization?: Record<string, unknown> }>;
  delivery: { address: string; city: string; area: string; building: string; apartment: string; date: string; time: string };
  giftMessage: string;
  paymentMethod: "cash_on_delivery";
};
export type PlaceOrderResult = { reference: string; total: number };

export async function loadProducts(): Promise<StoreProduct[]> {
  const response = await fetch("/api/products");
  if (!response.ok) throw new Error("We couldn't load the flower collection. Please try again.");
  return response.json();
}

export async function submitOrder(order: PlaceOrderInput): Promise<PlaceOrderResult> {
  const response = await fetch("/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(order),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.statusMessage || "We couldn't place the order. Please try again.");
  return result;
}

export function isCustomProduct(product: Product) {
  return product.category === "Custom bouquet";
}

export function toServerItems(items: Array<{ product: Product; quantity: number; size: string; custom?: string }>) {
  if (items.some(item => isCustomProduct(item.product))) {
    throw new Error("Custom bouquet pricing is not yet connected to the server checkout. Remove the custom bouquet to continue.");
  }
  return items.map(item => ({
    productId: item.product.id,
    quantity: item.quantity,
    size: item.size,
    customization: item.custom ? { note: item.custom } : {},
  }));
}
