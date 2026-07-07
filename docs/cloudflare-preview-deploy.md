# Cloudflare preview deployments (blinkperps)

Production deploy (size limits, paid plan, dashboard deploy command): **[cloudflare-workers-deploy.md](./cloudflare-workers-deploy.md)**.

## Privy wallet connect

Set **both** in Workers → blinkperps → Settings → **Variables** (for builds):

| Variable | Value |
|----------|--------|
| `NEXT_PUBLIC_PRIVY_APP_ID` | `cmpiqa62z001u0ck2clr1ic8p` |
| `NEXT_PUBLIC_PRIVY_CLIENT_ID` | `client-WY6ZYq2Ve9d4cAN4A4kvRV26jJwsodGMA8JrAk7XriopW` |

Use the **Web Client ID** (`client-…`), not the App ID (`cm…`). In Privy → Allowed origins, add `https://blinkperps.xyz` and your `*.workers.dev` preview URL.

## Fastest: push branch (recommended)

1. **Workers → blinkperps → Settings → Build**
   - Root directory: `apps/nextjs`
   - Build: `pnpm run build`
   - **Builds for non-production branches:** ON
   - Non-production deploy:
     ```bash
     node scripts/ensure-wrangler-hyperdrive.mjs && npx wrangler versions upload --preview-alias $WORKERS_CI_BRANCH --minify
     ```
2. Push your branch → Cloudflare builds automatically.
3. Open **Deployments** → branch build → copy **preview URL**.

`$WORKERS_CI_BRANCH` is **only set on Cloudflare**, not on your Mac.

## Manual preview from laptop

Requires **Node 22+** and `wrangler login`.

```bash
cd apps/nextjs
nvm use 22   # or fnm / volta

pnpm run build

# Alias = branch name with / replaced by - (slashes break the flag)
npx wrangler versions upload --preview-alias pintosdsgn-rok-46-lighter-builder-code
```

Preview URL pattern:

`https://pintosdsgn-rok-46-lighter-builder-code-blinkperps.pintosdsgn.workers.dev`

(Exact hostname shown in terminal after upload.)

## Common mistakes

| Mistake | Fix |
|---------|-----|
| `npx wrangler versions upload --preview-alias $WORKERS_CI_BRANCH` locally | `$WORKERS_CI_BRANCH` is empty → pass a real alias string |
| Run from repo root without build | `cd apps/nextjs && pnpm run build` first |
| Node 20 | `nvm use 22` — Wrangler 4.95+ requires Node 22 |
| Expect preview on `blinkperps.xyz` | Previews use `*.workers.dev` only |

## Production vs preview

| Branch | Deploy command |
|--------|----------------|
| `main` | `pnpm run deploy:cloudflare` — or — `node scripts/ensure-wrangler-hyperdrive.mjs && npx wrangler deploy --minify` |
| Feature branches | `node scripts/ensure-wrangler-hyperdrive.mjs && npx wrangler versions upload --preview-alias $WORKERS_CI_BRANCH --minify` |
