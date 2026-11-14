import type { Product, Item } from "../store";

export type StoreProduct = Product & {
  available: boolean;
  regularPrice: number;
  salePrice: number | null;
  stockQuantity: number | null;
  categoryId: string | null;
};
export type StoreCategory = { id: string; name: string; description: string | null; imageUrl: string | null; productCount: number };
export type CustomBouquet = { flowers: string[]; color: string; size: string; wrapping: string; extras: string[]; giftMessage: string };
export type SubmittedItem = { productId: string | number; quantity: number; size: string; customization: Record<string, unknown> } | { quantity: number; size: string; customBouquet: CustomBouquet };
export type PlaceOrderInput = {
  customer: { fullName: string; email: string; phone: string };
  items: SubmittedItem[];
  delivery: { address: string; city: string; area: string; building: string; apartment: string; date: string; time: string };
  giftMessage: string;
  paymentMethod: "cash_on_delivery" | "online";
};
export type PlaceOrderResult = { reference: string; total: number; checkoutUrl?: string };

type ProductApiRecord = {
  id: string;
  database_id: string;
  name: string;
  short_description: string;
  description: string;
  price: number;
  regular_price: number;
  sale_price: number | null;
  category_id: string | null;
  category: string;
  image: string;
  available: boolean;
  stock_quantity: number | null;
  featured: boolean;
};

type CategoryApiRecord = { id: string; name: string; description: string | null; image_url: string | null; product_count: number };

export async function loadProducts(): Promise<StoreProduct[]> {
  const response = await fetch("/api/products");
  if (!response.ok) throw new Error("We couldn't load the flower collection. Please try again.");
  const records = await response.json() as ProductApiRecord[];
  return records.map(product => ({
    id: product.id,
    databaseId: product.database_id,
    name: product.name,
    shortDescription: product.short_description,
    description: product.description,
    price: product.price,
    regularPrice: product.regular_price,
    salePrice: product.sale_price,
    categoryId: product.category_id ?? undefined,
    category: product.category || "Seasonal Flowers",
    image: product.image,
    available: product.available,
    stockQuantity: product.stock_quantity,
    featured: product.featured,
    tag: product.stock_quantity === 0 ? "Out of stock" : product.featured ? "Featured" : undefined,
  }));
}

export async function loadCategories(): Promise<StoreCategory[]> {
  const response = await fetch("/api/categories");
  if (!response.ok) throw new Error("We couldn't load flower categories. Please try again.");
  const records = await response.json() as CategoryApiRecord[];
  return records.map(category => ({ id: category.id, name: category.name, description: category.description, imageUrl: category.image_url, productCount: category.product_count }));
}

export async function submitOrder(order: PlaceOrderInput): Promise<PlaceOrderResult> {
  const response = await fetch("/api/orders", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(order),
  });
  const result = await response.json().catch(() => ({})) as { statusMessage?: string; message?: string; data?: { statusMessage?: string } };
  if (!response.ok) throw new Error(result.statusMessage || result.data?.statusMessage || result.message || "We couldn't place the order. Please try again.");
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
    return { productId: item.product.databaseId ?? item.product.id, quantity: item.quantity, size: item.size, customization: item.custom ? { note: item.custom } : {} };
  });
}
