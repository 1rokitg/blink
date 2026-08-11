# Stripe setup for The Circle

## 1. Create catalog

Card billing is **EUR** (converted from the USD / USDC list price at `USD_TO_EUR_RATE`).
Crypto rails still charge the USD list amount in **USDC**.

Current live ladder (rate `0.865682`):

- **1 Month** — 50 USDC / €43.28 / month
- **3 Months** — 99 USDC / €85.70 / every 3 months
- **One Year** — 210 USDC / €181.79 / year
- Coupon `circle_referral_eur` + promotion code `REFERRALEUR` (€17.31 off once; `REFERRAL20` maps to it at checkout)

Copy the printed `STRIPE_PRICE_*` values into `.env.local` / `.dev.vars`.
Also set `USD_TO_EUR_RATE` when refreshing FX.

## 2. Tax

1. Dashboard → **Tax** → add registrations where you must collect.
2. Confirm status is **Collecting**.
3. Checkout already sends `automatic_tax: { enabled: true }`.

Without an active registration, Checkout will not collect tax (and will not error).

Suggested product tax code (confirm with your advisor): digitally supplied services — seed script applies `txcd_10000000` when available. Prefer a more specific code from Stripe’s tax code list for your jurisdiction.

## 3. Customer Portal

Dashboard → Settings → Billing → Customer portal:

- Allow customers to cancel subscriptions
- Allow payment method updates
- Optionally allow plan switches later

## 4. Webhooks

Endpoint: `https://rokitg.com/api/webhooks/stripe`

Subscribe at minimum:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

Set `STRIPE_WEBHOOK_SECRET` from the endpoint’s signing secret (`wrangler secret put STRIPE_WEBHOOK_SECRET`).

Claim-link checkouts also finalize on the `/success` page and self-heal when the claim URL is opened after payment, so a missed webhook cannot leave the invite reusable. Paid Telegram usernames land in KV `telegram:paid-whitelist` for Circle Guard.

## 5. Invoicing (one-off VIP bills)

- Settings → Branding (logo, color)
- Create an invoice rendering template for repeated presentation
- Send invoices from Dashboard; customers pay on the Hosted Invoice Page
- Enable `automatic_tax` on invoices when the customer has an address

## 6. Revenue recovery

Enable Smart Retries + email dunning in Billing settings (no code required).

**App-level renewal warnings (manual now):** Monetise → Memberships → Payments due lists Stripe period ends and Whop last-paid+30d estimates so you can message members on Telegram/email yourself.

**Later:** The Circle Guard bot + optional app email for N-days-before-due and past-due nudges. Stripe dunning covers card declines on native subscriptions; app warnings cover access/renewal outreach (especially Whop migrants without Stripe Billing). See README → Payments due.
