# Store administration and service setup

## Admin authentication

The admin UI uses Neon Auth sessions. Every `/api/admin/*` request is verified server-side; a session must be valid, the email verified, and the email present in `NITRO_ADMIN_EMAILS`.

Configure privately in the server environment (local development: `.env.local`):

- `DATABASE_URL` — Neon pooled connection string. Never expose it with a `VITE_` prefix.
- `NEON_AUTH_BASE_URL` — Neon Auth endpoint from the Neon Console.
- `NITRO_ADMIN_EMAILS` — comma-separated, verified administrator email addresses.

Enable Neon Auth for the project, create and verify the owner account, and add its exact email to `NITRO_ADMIN_EMAILS`. In Neon Auth's trusted-origin / redirect URL settings, allow each exact storefront origin used by the app: local development origin(s), Dyad preview origin(s), and the production HTTPS origin. The app builds absolute callbacks from the active browser origin, so production does not depend on a hardcoded localhost URL. Add a new preview or production origin in Neon Auth when its hostname changes. Unauthorized requests receive 401/403 and cannot query orders. Never commit environment values.

## Order email notifications

Email uses Resend only when configured:

- `NITRO_RESEND_API_KEY`
- `NITRO_EMAIL_FROM` — sender address verified with Resend
- `NITRO_OWNER_EMAIL` — shop order notification recipient

Order notifications are recorded per order and channel in `order_notifications` to avoid repeat sends. If configuration is missing, notifications are recorded as `not_configured`; checkout still succeeds and no email is claimed as sent.

## Official WhatsApp Cloud API

Owner alerts use Meta's official WhatsApp Cloud API template endpoint. Configure:

- `NITRO_WHATSAPP_ACCESS_TOKEN`
- `NITRO_WHATSAPP_PHONE_NUMBER_ID`
- `NITRO_WHATSAPP_OWNER_NUMBER` — destination in international format
- `NITRO_WHATSAPP_TEMPLATE` — approved Meta message template with four body placeholders
- Optional `NITRO_WHATSAPP_GRAPH_VERSION` (defaults to `v21.0`)

Without all required values, no WhatsApp request is sent.

## Online payments

Stripe Checkout is enabled only when all of these are set:

- `NITRO_STRIPE_SECRET_KEY`
- `NITRO_STRIPE_WEBHOOK_SECRET`
- `NITRO_PUBLIC_BASE_URL` — canonical HTTPS storefront URL
- Optional `NITRO_CURRENCY` (defaults to `AED`)

Register `POST /api/payments/webhook` in Stripe for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, and `checkout.session.expired`. Webhook signatures are verified before payment status changes. When Stripe is not configured, checkout offers Cash on Delivery only. No credentials are included in source code.

## Feature status and branch data

The active Neon development branch was empty of orders at last verification. No fake orders are seeded. Use a real checkout to test the owner dashboard. Email, WhatsApp, and Stripe delivery require provider setup and live credentials; successful order persistence does not depend on notification success.
