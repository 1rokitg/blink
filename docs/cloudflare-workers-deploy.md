# Cloudflare Workers production deploy (blinkperps)

Blink runs on **Cloudflare Workers** via `@opennextjs/cloudflare` (OpenNext), not Cloudflare Pages.

## Dashboard settings (Workers Builds)

In **Workers & Pages → blinkperps → Settings → Build**:

| Setting | Value |
|---------|--------|
| **Root directory** | `apps/nextjs` |
| **Build command** | `pnpm run build` |
| **Builds for non-production branches** | ON (optional; see [preview doc](./cloudflare-preview-deploy.md)) |

### Production deploy command (`main`)

Set **Deploy command** (production branch) to **one** of:

```bash
pnpm run deploy:cloudflare
```

```bash
node scripts/ensure-wrangler-hyperdrive.mjs && npx wrangler deploy --minify
```

Both run the Hyperdrive ID patch script and minify the worker bundle.

**Do not use** bare `npx wrangler deploy` — it skips the Hyperdrive script and (without `minify = true` in an older config) can upload an ~18 MiB unminified bundle and fail on the free tier.

### Non-production deploy command (preview branches)

```bash
node scripts/ensure-wrangler-hyperdrive.mjs && npx wrangler versions upload --preview-alias $WORKERS_CI_BRANCH --minify
```

`$WORKERS_CI_BRANCH` is injected by Cloudflare CI only — do not run this locally with an empty alias.

## Worker size limits (paid plan)

OpenNext bundles the Next.js server into `.open-next/server-functions/default/handler.mjs`. For this monorepo, the **unminified** handler is typically **~18 MiB**.

| Plan | Worker script limit |
|------|---------------------|
| Workers **Free** | 3 MiB |
| Workers **Paid** ($5/mo per account) | 10 MiB |

Minification (`minify = true` in `wrangler.toml` and/or `--minify` on deploy) is **required**; it usually brings the bundle under 10 MiB but **still above 3 MiB**.

**You almost certainly need [Cloudflare Workers Paid](https://developers.cloudflare.com/workers/platform/pricing/)** ($5/month, billed by Cloudflare — separate from Vercel or any other host). Enable it in the Cloudflare dashboard under **Workers & Pages → Overview → Upgrade**.

If deploy still fails after minify + Paid:

1. Confirm deploy command matches this doc (not default `npx wrangler deploy`).
2. Check **Deployments** build logs for `handler.mjs` size after minify.
3. See [OpenNext bundle troubleshooting](https://github.com/opennextjs/opennextjs-cloudflare/issues/659) and consider `serverExternalPackages` in `apps/nextjs/next.config.js` for build-time-only deps.

## Local deploy

Requires **Node 22+** and `wrangler login`.

```bash
cd apps/nextjs
pnpm run build
pnpm run deploy:cloudflare
```

From repo root:

```bash
pnpm run deploy:cloudflare
```

## Related docs

- [Preview deployments](./cloudflare-preview-deploy.md)
- [Privy env vars on Workers](./cloudflare-preview-deploy.md#privy-wallet-connect)
- Hyperdrive + DB patterns: `.cursor/rules/cloudflare-db.mdc`
