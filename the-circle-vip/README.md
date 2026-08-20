# The Circle

Pastel Alpha–style membership landing for **The Circle** — Telegram group access billed through Stripe.

## Pricing (live Stripe catalog)

Landing page loads names, descriptions, and amounts from your Stripe Products/Prices.

| Plan | Amount | Interval |
|------|--------|----------|
| 1 Month | 50 USDC | monthly |
| 3 Months | 99 USDC | every 3 months |
| One Year | 210 USDC | yearly |

Flow: pick plan → pay with **USDC** (preferred, one wallet click) or **card** (one click to Stripe Checkout) → private Telegram invite link. Telegram handle is optional.

### Crypto (USDC only)

| Network | Token | Treasury |
|---------|-------|----------|
| Base | USDC | `0xc7BcB2EeE9BbFbf875499960746Bc52B2E1A75C6` |
| Arbitrum | USDC | `0xc7BcB2EeE9BbFbf875499960746Bc52B2E1A75C6` |
| Ethereum | USDC | `0xc7BcB2EeE9BbFbf875499960746Bc52B2E1A75C6` |
| Solana | USDC | `FZsywzt85ZUo9vhQWKqC79BhFzg1cNCHsc84BMEdKaxw` |

EVM wallets can send via browser wallet; Solana is send-then-paste signature. `/api/crypto/verify` checks the transfer on-chain before issuing an invite.

## Stack

- Next.js 15 (App Router) + React 19 + Tailwind CSS 4
- **Cloudflare Workers** via `@opennextjs/cloudflare` (OpenNext)
- Stripe Billing + hosted Checkout + Tax + Customer Portal
- Telegram Login Widget + Bot API invite links / ban-on-cancel (Circle Guard later)

## Quick start

```bash
pnpm install
cp .env.example .env.local
# fill Stripe + Telegram values
pnpm stripe:seed
pnpm dev
```

### Cloudflare hosted deploy

Uses your **main** Cloudflare account — Worker `the-circle-vip` on **https://rokitg.com**.

```bash
# once: put CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID in .cf-credentials.env
pnpm deploy
```

Manage domains from that Worker’s **Domains** tab. Full guide: [`docs/cloudflare-deploy.md`](docs/cloudflare-deploy.md).

### Telegram access (interim)

Until **The Circle Guard** bot is live, paid members are directed to [`t.me/rokitgg`](https://t.me/rokitgg) (`NEXT_PUBLIC_TELEGRAM_INVITE_URL`).

### Whop → Circle claim

Former Whop members hit the orange top banner → `/claim`. The form posts to `/api/claim`, which proxies to your proprietary verifier:

```bash
CLAIM_BACKEND_URL=https://your-claim-api.example/v1/claim
CLAIM_BACKEND_API_KEY=...   # optional Bearer token
```

Backend contract: `POST { email, telegramUsername?, whopReceipt? }` → `{ inviteLink }` (or `{ error }`).
Without `CLAIM_BACKEND_URL`, the form returns a soft “not online yet” message pointing people to `@rokitgg`.

### Internal analytics (`internal.rokitg.com`)

Owner-only Whop-style monetise dashboard on Cloudflare (same Worker):

```bash
INTERNAL_USERNAME=rokitg
INTERNAL_PASSWORD=...strong...
CF_ACCOUNT_ID=72265998f8cf66e3ab4d88575895dd0d
CF_ZONE_ID=f285c305e0e75ad3c8f385e8e3e6273f   # rokitg.com
CF_TRAFFIC_HOSTS=rokitg.com,www.rokitg.com
CF_ANALYTICS_API_TOKEN=...   # user API token — see below
```

**Traffic source of truth = Cloudflare Zone Analytics (GraphQL)**  
Monetise → Traffic History polls `https://api.cloudflare.com/client/v4/graphql` with host filter `rokitg.com` / `www.rokitg.com` (same as the Cloudflare dashboard Traffic view). Live fingerprint maps stay first-party (KV).

`CF_ANALYTICS_API_TOKEN` must be a **user** API token with:
1. **Zone → Analytics → Read** (required for Traffic SoT / GraphQL `httpRequestsAdaptiveGroups`)
2. Optional: Account → Account Analytics → Read (Workers Analytics Engine SQL)

Account-owned `cfat_` deploy tokens are **not** enough for Zone Analytics.

**Storage split (budget now → scale later):**

| Layer | What | Why |
|---|---|---|
| **Cloudflare GraphQL (SoT)** | Zone Traffic: requests, bandwidth, visits, page views, uniques, countries, paths, status | Matches dashboard with host filter |
| **KV (live now)** | Live minute buckets, map pins, payments, price overrides, visitor enrichments | Fingerprint visor + CRM |
| **Analytics Engine (disabled)** | `circle_events` pageviews + crypto funnel | Off until Workers Paid + dashboard enable |

AE is intentionally off (`analyticsEngineEnabled: false` + no `CIRCLE_EVENTS` binding). Traffic/crypto use KV + Zone Analytics. To turn back on later: enable AE in the [dashboard](https://dash.cloudflare.com/72265998f8cf66e3ab4d88575895dd0d/workers/analytics-engine) → set `analyticsEngineEnabled: true` → uncomment `analytics_engine_datasets` in `wrangler.jsonc` → redeploy.

Knobs live in `src/lib/analytics-budget.ts`.

- Login at https://internal.rokitg.com/login (also `/internal` on the public domain)
- Stripe: today gross, balance, MRR, ARR, subscription breakdown
- Traffic: Cloudflare Zone Analytics SoT + first-party live visor

### Payments due (manual now → automate later)

Memberships → **Payments due** lists members who are overdue or renewing within 7/14/30 days so you can warn them yourself via Telegram or email.

| Source | Due date |
|--------|----------|
| Native Stripe subscriptions | `current_period_end` |
| Whop migrants (no Stripe sub yet) | **Estimate**: last paid Whop invoice + 30 days (Season Pass cycle) — labeled in UI |

**Later (not built yet):**
1. Automated Telegram DM / group nudge from **The Circle Guard** N days before due
2. Automated renewal / past-due email (beyond Stripe Billing dunning)
3. Persist real `whop_renewal_at` on import if a future Whop export includes renewal timestamps
4. Cron or Queue job that refreshes the due list and posts a daily digest to an ops Telegram chat

Until then: use **Copy TG / Open TG / Copy email / Email** on the Payments due board.

### The Circle Guard bot (later)

1. Create **The Circle Guard** with [@BotFather](https://t.me/BotFather) → `TELEGRAM_BOT_TOKEN`
2. Set `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` (without `@`)
3. Add the bot as **admin** of the Telegram group with invite + ban rights
4. Set `TELEGRAM_CHAT_ID` (private supergroups look like `-100xxxxxxxxxx`)
5. In BotFather → Bot Settings → Domain → add your production domain (Login Widget)

Goal: auto-issue invite links after payment, send renewal / past-due warnings, and kick unpaid / cancelled members.

Without bot env vars, checkout still works; members message [`t.me/rokitgg`](https://t.me/rokitgg) until configured.

### Stripe

```bash
export STRIPE_SECRET_KEY=rk_live_...
pnpm stripe:seed
```

Creates Pastel Products/Prices + `REFERRAL20` ($20 off).

Local webhooks:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

## Environment

See [`.env.example`](.env.example).

| Variable | Purpose |
|----------|---------|
| `STRIPE_SECRET_KEY` | Prefer restricted key (`rk_…`) |
| `STRIPE_PRICE_*` | From `pnpm stripe:seed` |
| `TELEGRAM_BOT_TOKEN` | BotFather token |
| `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | Login Widget |
| `TELEGRAM_CHAT_ID` | Telegram group/channel id |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret |

## Access control

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Create single-use invite link; store on subscription |
| Success page | Show **Join The Circle** button |
| `customer.subscription.deleted` / inactive | Ban then unban member (kick; allows future rejoin) |

Guest checkout (no Telegram) still gets an invite link after payment. Numeric Telegram user ids (from optional Login Widget) are needed only for kick-on-cancel.

## Docs

- [`docs/cloudflare-deploy.md`](docs/cloudflare-deploy.md) — Workers + OpenNext + domain
- [`docs/stripe-setup.md`](docs/stripe-setup.md)
