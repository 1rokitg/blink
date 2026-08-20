# Cloudflare Workers deploy — The Circle

Runs on **your main Cloudflare account** (`pintosdsgn`, same account as Blink) via `@opennextjs/cloudflare`.

**Stable marketing URL (apex):** https://rokitg.com → **Doorfee** ([setup](./doorfee-apex.md))  
**App / checkout:** https://www.rokitg.com · backup https://the-circle-vip.pintosdsgn.workers.dev  
**Also:** https://internal.rokitg.com · https://indicators.rokitg.com  
**Worker name:** `the-circle-vip`  
**Account ID:** `72265998f8cf66e3ab4d88575895dd0d`  
**Zone:** `rokitg.com`

Do **not** use `wrangler deploy --temporary`. All updates redeploy this same Worker.

## One-time credentials (local only)

Create gitignored `.cf-credentials.env` in `the-circle-vip/`:

```bash
CLOUDFLARE_API_TOKEN=cfat_...
CLOUDFLARE_ACCOUNT_ID=72265998f8cf66e3ab4d88575895dd0d
```

Or export those env vars in your shell / CI.

## Deploy (always the same instance)

```bash
cd the-circle-vip
pnpm deploy          # = scripts/deploy-main.sh
# or
pnpm deploy:main
```

This builds OpenNext and runs `wrangler deploy --minify` against the main account + existing `CRYPTO_PAYMENTS` KV.

## Secrets

Dashboard → Workers → `the-circle-vip` → Settings → Variables, or:

```bash
pnpm exec wrangler secret bulk .dev.vars.json
```

Required: Stripe keys/prices, `SESSION_SECRET`, `NEXT_PUBLIC_APP_URL=https://www.rokitg.com`, interim `NEXT_PUBLIC_TELEGRAM_INVITE_URL=https://t.me/rokitgg`.

Optional: `PROPR_BEARER_TOKEN` — short-lived Propr app session JWT for live referral sync. Prefer pasting a fresh token in **Earnings → Referrals → Sync now** (stored in KV until JWT expiry). CSV seed remains the offline fallback.

`NEXT_PUBLIC_*` must also be available at **build** time (`.dev.vars` / Workers Builds vars).

## Domain

| Host | Origin |
|------|--------|
| `rokitg.com` (apex) | **Doorfee** — CNAME `@` → `doorfee.io` (see [doorfee-apex.md](./doorfee-apex.md)) |
| `www.rokitg.com` | Worker custom domain |
| `internal.rokitg.com` | Worker custom domain |
| `indicators.rokitg.com` | Worker custom domain |

Configured in `wrangler.jsonc` `routes` (apex is intentionally **not** a Worker custom domain). Set Stripe webhook to `https://www.rokitg.com/api/webhooks/stripe`.

## Workers Builds (optional Git CI)

| Setting | Value |
|---------|--------|
| Root directory | `the-circle-vip` |
| Build command | `pnpm run build:cloudflare` |
| Deploy command | `pnpm run deploy:cloudflare` |

Use the same account API token as a CI secret. Never enable temporary preview accounts for production.
