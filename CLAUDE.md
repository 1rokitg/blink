# Blink — Hyperliquid Frontend Exchange

## Project Overview

Blink is a frontend trading exchange powered by Hyperliquid builder codes. It is built as a Turborepo monorepo targeting a social-first, consumer-grade trading experience similar to [fomo.family](https://fomo.family).

## Reference Product: fomo.family

**URL:** https://fomo.family  
**Tagline:** "where traders become legends."  
**Description:** Social-first crypto trading app for memecoins, altcoins, and stablecoins. 500k+ users.

### Key UX patterns to reference:
- **Social feed** — discover and follow top traders
- **Leaderboard** — gamified ranking of top performers
- **Alerts** — real-time notifications when followed traders buy
- **Easy onboarding** — account creation in seconds (Privy-style)
- **Gasless & multichain** — zero complexity for end users
- **Apple Pay / one-click funding**
- **Cross-device continuity** — open on phone, close on desktop
- **Dark theme** — deep space aesthetic (`#060510` brand bg)

This is the design and product north star for the Blink exchange UI.

## Monorepo Structure

```
apps/
  nextjs/         # Main Next.js 15 + React 19 app (the exchange frontend)
packages/
  api/            # oRPC v1.0 — typesafe API server & client
  auth/           # Better-Auth authentication
  db/             # Drizzle ORM — typesafe DB calls
  ui/             # Shared UI components (shadcn/ui)
  validators/     # Shared Zod validators
tooling/
  biome/          # Lint + format
  tailwind/       # Shared Tailwind config
  typescript/     # Shared tsconfig
```

## Key Dependencies

| Package | Purpose |
|---|---|
| `@nktkas/hyperliquid` | Hyperliquid SDK (REST + WebSocket) |
| `@privy-io/react-auth` | Wallet/social auth (Privy) |
| `@xstate/react` + `@xstate/store` | State machines for trading flows |
| `@tanstack/react-query` | Data fetching & caching |
| `react-grid-layout` | Draggable dashboard panels |
| `oRPC` | End-to-end typesafe API |
| `better-auth` | Auth backend |
| `drizzle` | Database ORM |

## Hyperliquid Builder Codes

This frontend uses Hyperliquid builder codes to route trades and earn referral fees. Key docs:
- Official docs MCP: `hyperliquid-docs` (https://hyperliquid.gitbook.io/hyperliquid-docs)
- SDK reference MCP: `hyperliquid` (https://nktkas.gitbook.io/hyperliquid)

## Tech Stack

- **Framework:** Next.js 15 (App Router, Turbopack)
- **UI:** React 19, Tailwind CSS, shadcn/ui
- **API:** oRPC + tRPC + React Query
- **Auth:** Privy (wallet + social) + Better-Auth
- **State:** XState v5 machines + stores
- **DB:** Drizzle ORM
- **Monorepo:** Turborepo + pnpm workspaces
- **Linting:** Biome

## Cloudflare + database (production)

- Timestamps from Hyperdrive may be **strings**, not `Date` — use `toIsoTimestamp()` from `@acme/db/serialize-timestamp` before server actions / JSON (never raw `.toISOString()` on row fields).
- `*.server.ts` uses `import "server-only"`; `"use server"` only in `src/app/actions/`.
- See `.cursor/rules/cloudflare-db.mdc` for internal tools + Resend patterns.

## Development

```bash
pnpm dev          # Start all apps
pnpm dev:next     # Start Next.js only
pnpm ui-add       # Add shadcn/ui components
pnpm db:push      # Push DB schema
pnpm db:studio    # Open Drizzle Studio
```

Requires `.env` at repo root (see apps with `pnpm with-env`).
