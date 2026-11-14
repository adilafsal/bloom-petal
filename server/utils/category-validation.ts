import { createError } from "nitro/h3";

export function validateCategoryInput(value: unknown) {
  const body = value as Record<string, unknown> | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const imageUrl = typeof body?.image_url === "string" ? body.image_url.trim() : "";
  if (!name || name.length > 80) throw createError({ statusCode: 400, statusMessage: "Category name is required and must be 80 characters or fewer." });
  if (description.length > 500) throw createError({ statusCode: 400, statusMessage: "Category description must be 500 characters or fewer." });
  if (imageUrl.length > 2048 || (imageUrl && !imageUrl.startsWith("/") && !/^https:\/\//i.test(imageUrl))) throw createError({ statusCode: 400, statusMessage: "Use an HTTPS image URL or a site-relative image path." });
  return { name, description: description || null, imageUrl: imageUrl || null };
}

export function isCategoryNameConflict(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}
