import { createError } from "nitro/h3";

export type ProductInput = {
  name: string;
  shortDescription: string;
  description: string;
  categoryId: string | null;
  sku: string | null;
  price: number;
  salePrice: number | null;
  imageUrl: string;
  stockQuantity: number | null;
  available: boolean;
  featured: boolean;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateProductInput(value: unknown): ProductInput {
  const body = value as Record<string, unknown> | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const shortDescription = typeof body?.short_description === "string" ? body.short_description.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const skuText = typeof body?.sku === "string" ? body.sku.trim() : "";
  const imageUrl = typeof body?.image_url === "string" ? body.image_url.trim() : "";
  const price = Number(body?.price);
  const salePrice = body?.sale_price === null || body?.sale_price === "" || body?.sale_price === undefined ? null : Number(body.sale_price);
  const stockQuantity = body?.stock_quantity === null || body?.stock_quantity === "" || body?.stock_quantity === undefined ? null : Number(body.stock_quantity);
  const categoryId = body?.category_id === null || body?.category_id === "" ? null : body?.category_id;

  if (!name || name.length > 120) throw createError({ statusCode: 400, statusMessage: "Product name is required and must be 120 characters or fewer." });
  if (shortDescription.length > 240 || description.length > 5000) throw createError({ statusCode: 400, statusMessage: "Descriptions exceed the allowed length." });
  if (!Number.isFinite(price) || price < 0 || price > 999999.99) throw createError({ statusCode: 400, statusMessage: "Enter a valid regular price in AED." });
  if (salePrice !== null && (!Number.isFinite(salePrice) || salePrice < 0 || salePrice >= price)) throw createError({ statusCode: 400, statusMessage: "Sale price must be a valid amount below the regular price." });
  if (stockQuantity !== null && (!Number.isInteger(stockQuantity) || stockQuantity < 0 || stockQuantity > 2147483647)) throw createError({ statusCode: 400, statusMessage: "Stock must be a non-negative whole number or left blank for untracked stock." });
  if (skuText.length > 64) throw createError({ statusCode: 400, statusMessage: "SKU must be 64 characters or fewer." });
  if (categoryId !== null && (typeof categoryId !== "string" || !uuidPattern.test(categoryId))) throw createError({ statusCode: 400, statusMessage: "Choose a valid product category." });
  if (imageUrl.length > 2048 || (imageUrl && !imageUrl.startsWith("/") && !/^https:\/\//i.test(imageUrl))) throw createError({ statusCode: 400, statusMessage: "Use an HTTPS image URL or a site-relative image path." });
  if (typeof body?.available !== "boolean" || typeof body?.featured !== "boolean") throw createError({ statusCode: 400, statusMessage: "Choose product visibility and featured status." });

  return { name, shortDescription, description, categoryId: categoryId as string | null, sku: skuText || null, price, salePrice, imageUrl, stockQuantity, available: body.available, featured: body.featured };
}

export function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}
