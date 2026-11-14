import { defineHandler } from "nitro";
import { sql } from "../../utils/db";
import { getAddressOwner } from "../../utils/customer-addresses";

export default defineHandler(async event => {
  const owner = await getAddressOwner(event);
  return sql`SELECT id, recipient_name, phone, label, building, street, area, city, delivery_instructions, is_default, created_at, updated_at FROM customer_addresses WHERE customer_id=${owner.customerId} ORDER BY is_default DESC, created_at DESC`;
});
