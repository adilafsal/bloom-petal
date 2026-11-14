import { defineHandler } from "nitro";
import { createError, getRouterParam, readBody } from "nitro/h3";
import { sql } from "../../../utils/db";
import { addressInput, getAddressOwner } from "../../../utils/customer-addresses";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default defineHandler(async event => {
  const owner = await getAddressOwner(event);
  const id = getRouterParam(event, "id");
  const body = await readBody<Record<string, unknown>>(event);
  if (!id || !uuidPattern.test(id)) throw createError({ statusCode: 400, statusMessage: "A valid address ID is required." });
  if (body?.make_default === true) {
    const exists = await sql`SELECT 1 FROM customer_addresses WHERE id=${id}::uuid AND customer_id=${owner.customerId}`;
    if (!exists.length) throw createError({ statusCode: 404, statusMessage: "Saved address not found." });
    await sql`UPDATE customer_addresses SET is_default=false, updated_at=now() WHERE customer_id=${owner.customerId} AND is_default=true`;
    await sql`UPDATE customer_addresses SET is_default=true, updated_at=now() WHERE id=${id}::uuid AND customer_id=${owner.customerId}`;
    return { ok: true };
  }
  const address = addressInput(body ?? {});
  const result = await sql`UPDATE customer_addresses SET recipient_name=${address.recipient_name}, phone=${address.phone}, label=${address.label}, building=${address.building}, street=${address.street}, area=${address.area}, city=${address.city}, delivery_instructions=${address.delivery_instructions}, updated_at=now() WHERE id=${id}::uuid AND customer_id=${owner.customerId} RETURNING id`;
  if (!result.length) throw createError({ statusCode: 404, statusMessage: "Saved address not found." });
  return { ok: true };
});
