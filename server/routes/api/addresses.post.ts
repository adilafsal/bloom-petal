import { defineHandler } from "nitro";
import { createError, readBody } from "nitro/h3";
import { sql } from "../../utils/db";
import { addressInput, getAddressOwner } from "../../utils/customer-addresses";

export default defineHandler(async event => {
  const owner = await getAddressOwner(event);
  const body = await readBody<Record<string, unknown>>(event);
  const address = addressInput(body ?? {});
  const makeDefault = body?.is_default === true;
  const existing = await sql`SELECT count(*)::int AS count FROM customer_addresses WHERE customer_id=${owner.customerId}`;
  const isDefault = makeDefault || existing[0].count === 0;
  if (isDefault) await sql`UPDATE customer_addresses SET is_default=false, updated_at=now() WHERE customer_id=${owner.customerId} AND is_default=true`;
  try {
    return await sql`INSERT INTO customer_addresses (customer_id, recipient_name, phone, label, building, street, area, city, delivery_instructions, is_default) VALUES (${owner.customerId}, ${address.recipient_name}, ${address.phone}, ${address.label}, ${address.building}, ${address.street}, ${address.area}, ${address.city}, ${address.delivery_instructions}, ${isDefault}) RETURNING id, recipient_name, phone, label, building, street, area, city, delivery_instructions, is_default, created_at, updated_at`;
  } catch (error) {
    console.error("Could not save customer address.", error);
    throw createError({ statusCode: 500, statusMessage: "We couldn't save this address. Please try again." });
  }
});
