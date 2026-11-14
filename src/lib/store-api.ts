import type { Product, Item } from "../store";

export type StoreProduct = Product & { available: boolean };
export type CustomBouquet = { flowers: string[]; color: string; size: string; wrapping: string; extras: string[]; giftMessage: string };
export type SubmittedItem = { productId: number; quantity: number; size: string; customization: Record<string, unknown> } | { quantity: number; size: string; customBouquet: CustomBouquet };
export type PlaceOrderInput = {
  customer: { fullName: string; email: string; phone: string };
  items: SubmittedItem[];
  delivery: { address: string; city: string; area: string; building: string; apartment: string; date: string; time: string };
  giftMessage: string;
  paymentMethod: "cash_on_delivery" | "online";
};
export type PlaceOrderResult = { reference: string; total: number; checkoutUrl?: string };

export async function loadProducts(): Promise<StoreProduct[]> {
  const response = await fetch("/api/products");
  if (!response.ok) throw new Error("We couldn't load the flower collection. Please try again.");
  return response.json();
}

export async function submitOrder(order: PlaceOrderInput): Promise<PlaceOrderResult> {
  const response = await fetch("/api/orders", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(order),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.statusMessage || "We couldn't place the order. Please try again.");
  return result;
}

export function giftMessageForOrder(items: Item[], fallback: string) {
  if (fallback) return fallback;
  for (const item of items) {
    if (item.product.category !== "Custom bouquet") continue;
    try {
      const bouquet = JSON.parse(item.custom || "") as CustomBouquet;
      if (bouquet.giftMessage) return bouquet.giftMessage;
    } catch {
      return "";
    }
  }
  return "";
}

export function toServerItems(items: Item[]): SubmittedItem[] {
  return items.map(item => {
    if (item.product.category === "Custom bouquet") {
      try {
        const customBouquet = JSON.parse(item.custom || "") as CustomBouquet;
        return { quantity: item.quantity, size: item.size, customBouquet };
      } catch {
        throw new Error("Your custom bouquet details are incomplete. Please rebuild it before checkout.");
      }
    }
    return { productId: item.product.id, quantity: item.quantity, size: item.size, customization: item.custom ? { note: item.custom } : {} };
  });
}
