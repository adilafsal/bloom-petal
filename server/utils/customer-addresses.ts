import { createError, getRequestHeader, getRequestURL } from "nitro/h3";
import type { H3Event } from "nitro/h3";
import { getSessionFromCookie } from "./session";
import { sql } from "./db";

export async function getAddressOwner(event: H3Event) {
  const session = await getSessionFromCookie(getRequestHeader(event, "cookie") ?? null, getRequestURL(event).protocol === "http:");
  if (!session?.user) throw createError({ statusCode: 401, statusMessage: "Sign in to manage saved addresses." });
  const rows = await sql`
    INSERT INTO customers (full_name, email, phone, auth_user_id)
    VALUES (${session.user.name || session.user.email.split("@")[0]}, ${session.user.email.toLowerCase()}, '', ${session.user.id})
    ON CONFLICT (auth_user_id) DO UPDATE SET full_name = EXCLUDED.full_name
    RETURNING id
  `;
  return { userId: session.user.id, customerId: rows[0].id as string, name: session.user.name, email: session.user.email };
}

export function addressInput(body: Record<string, unknown>) {
  const fields = ["recipient_name", "phone", "building", "street", "area", "city"] as const;
  const values = Object.fromEntries(fields.map(field => [field, typeof body[field] === "string" ? body[field].trim() : ""]));
  if (fields.some(field => !values[field]) || !["Home", "Work", "Other"].includes(String(body.label))) {
    throw createError({ statusCode: 400, statusMessage: "Enter the recipient, phone, label, building, street, area, and city." });
  }
  const instructions = typeof body.delivery_instructions === "string" ? body.delivery_instructions.trim().slice(0, 500) : "";
  return { ...values, label: body.label as string, delivery_instructions: instructions };
}
