# Stripe ↔ Memberships dashboard

Blink Pro checkout creates Stripe subscriptions. The internal **Memberships** dashboard (`/internal/memberships`) syncs Stripe into Neon and reads live billing metrics on every refresh.

## Environment

| Variable | Purpose |
|----------|---------|
| `STRIPE_SECRET_KEY` | `sk_live_…` or restricted `rk_live_…` with read access to Customers, Subscriptions, Charges; write for Customers metadata (optional) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` from the webhook endpoint |

## Webhook endpoint

`POST /api/stripe/webhook`

Subscribe to:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Checkout and subscription metadata must include `walletAddress` (0x…) so entitlements map to the correct wallet.

## Dashboard refresh flow

1. Paginate all Stripe subscriptions → upsert `blink_membership` (skips lifetime gifts).
2. Pull Stripe MRR/ARR, customer counts, and charge history.
3. Merge per-customer spend into membership rows.
4. Render Neon ledger + Stripe headline metrics.

## Restricted keys

If using `rk_live_…`, grant at least:

- Customers: Read (+ Write if you want wallet metadata backfill)
- Subscriptions: Read
- Charges: Read
- Checkout Sessions: Read (optional)

Webhooks still require `STRIPE_WEBHOOK_SECRET` from a Dashboard webhook endpoint.
