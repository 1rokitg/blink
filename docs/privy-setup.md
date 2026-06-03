# Privy setup (Blink production)

Production app in Privy (state: **In production**).

## Credentials (client-side)

| Blink env var | Privy dashboard | Value |
|---------------|-----------------|--------|
| `NEXT_PUBLIC_PRIVY_APP_ID` | Settings → API keys → **App ID** | `cmpiqa62z001u0ck2clr1ic8p` |
| `NEXT_PUBLIC_PRIVY_CLIENT_ID` | Clients → **Web** → Client ID | `client-WY6ZYq2Ve9d4cAN4A4kvRV26jJwsodGMA8JrAk7XriopW` |

Set both in **Cloudflare Workers** (`blinkperps`) → Settings → Variables for production and preview builds.

**Do not** use the App ID as the Client ID.

## Dashboard checklist (you must click Save)

### Domains → Allowed origins

Remove placeholder `https://domain.com`. Add:

- `https://blinkperps.xyz`
- `https://www.blinkperps.xyz`
- Each preview host, e.g. `https://pintosdsgn-rok-46-lighter-builder-code-blinkperps.pintosdsgn.workers.dev`

### Domains → App domain (HttpOnly cookies)

Already correct: `blinkperps.xyz`

Optional DNS (if using HttpOnly cookies fully):

| Type | Name | Value |
|------|------|--------|
| CNAME | `privy` | `cmpiqa62z001u0ck2clr1ic8p.api.privy.systems` |

### Advanced → Allowed OAuth redirect URLs

Remove `https://domain.com/safe_url` unless used. Add paths you need, e.g.:

- `https://blinkperps.xyz/api/twitter/callback`

Base domain must match an allowed origin.

## After changes

1. Update Cloudflare env vars if they still reference the old app id (`cmphrowed…`).
2. Redeploy `main` (or push this repo update).
3. Hard-refresh the site; allow ~1–2 min for Privy origin propagation.

## Old app id

`cmphrowed00j20cjuned0ftmt` was a dev/stale id — **not** the production app above.
