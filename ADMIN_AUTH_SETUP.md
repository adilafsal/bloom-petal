# Admin access setup

The admin UI uses Neon Auth sessions. Every `/api/admin/*` handler also checks the server-only `NITRO_ADMIN_EMAILS` allowlist; a signed-in, verified user not on that list cannot read or change orders.

Configure these variables in the private server environment (for local development, `.env.local`):

- `DATABASE_URL` — Neon pooled connection string; never expose it with a `VITE_` prefix.
- `NEON_AUTH_BASE_URL` — Neon Auth endpoint from the Neon Console.
- `NITRO_ADMIN_EMAILS` — comma-separated verified administrator email addresses.

Enable Neon Auth for this Neon project, create/verify the owner account, and add its exact email to `NITRO_ADMIN_EMAILS`. Never commit environment values. Admin order endpoints return 403 until the auth endpoint and allowlist are configured.

The development branch currently contains no orders, so the dashboard will show its real empty state until a genuine checkout order is placed. No mock order rows are created for testing.

Online payments, order notifications, and admin user management are not configured.
