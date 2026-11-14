import { defineHandler } from "nitro";
import { createError, getRouterParam } from "nitro/h3";
import { sql } from "../../../utils/db";
import { getAddressOwner } from "../../../utils/customer-addresses";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default defineHandler(async event => {
  const owner = await getAddressOwner(event);
  const id = getRouterParam(event, "id");
  if (!id || !uuidPattern.test(id)) throw createError({ statusCode: 400, statusMessage: "A valid address ID is required." });
  const removed = await sql`DELETE FROM customer_addresses WHERE id=${id}::uuid AND customer_id=${owner.customerId} RETURNING is_default`;
  if (!removed.length) throw createError({ statusCode: 404, statusMessage: "Saved address not found." });
  if (removed[0].is_default) await sql`UPDATE customer_addresses SET is_default=true, updated_at=now() WHERE id=(SELECT id FROM customer_addresses WHERE customer_id=${owner.customerId} ORDER BY created_at DESC LIMIT 1)`;
  return { ok: true };
});
