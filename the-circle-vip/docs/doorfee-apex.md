# Apex `rokitg.com` → Doorfee

Marketing landing for **https://rokitg.com** (apex only) is hosted on Doorfee:

**https://doorfee.io/p/rokitg**

`www.rokitg.com`, `internal.rokitg.com`, and `indicators.rokitg.com` stay on the `the-circle-vip` Worker.

## Why not a Worker custom domain on apex?

Workers Custom Domains create DNS that points the hostname at the Worker. That blocks Doorfee’s required apex CNAME. `wrangler.jsonc` therefore **must not** list `rokitg.com` as a custom domain.

## DNS (Cloudflare CNAME flattening)

Zone: **rokitg.com** (`CF_ZONE_ID` in `wrangler.jsonc`).

1. Deploy this repo so the Worker drops the apex custom domain (`pnpm deploy` in `the-circle-vip`).
2. In **DNS → Records** for `rokitg.com`:
   - Delete any leftover Worker-managed apex `A` / `AAAA` / `CNAME` for `@` that still points at the Worker (if present after deploy).
   - Add:
     | Type | Host / Name | Target / Content | Proxy |
     |------|-------------|------------------|-------|
     | **CNAME** | `@` (or blank) | **`doorfee.io`** | Proxied (orange cloud) |
3. Confirm Doorfee has `rokitg.com` as a custom domain for project `rokitg` (their dashboard).
4. Wait for propagation (often minutes; up to 48h).

Cloudflare flattens apex CNAMEs automatically.

### Script (optional)

With `CLOUDFLARE_API_TOKEN` that can edit DNS on this zone:

```bash
cd the-circle-vip
pnpm doorfee:apex-dns
```

Creates/updates the apex CNAME → `doorfee.io` (proxied). Deploy the Worker first so the custom domain is gone.

## App / Stripe after cutover

| Surface | Host |
|---------|------|
| Marketing landing | `https://rokitg.com` → Doorfee |
| Join / checkout / app | `https://www.rokitg.com` |
| Stripe webhook | `https://www.rokitg.com/api/webhooks/stripe` |
| Internal ops | `https://internal.rokitg.com` |
| Indicators | `https://indicators.rokitg.com` |

Set Worker secret / build var:

```bash
NEXT_PUBLIC_APP_URL=https://www.rokitg.com
```

Update the Stripe webhook endpoint in the Stripe Dashboard to the `www` URL above.

## Verify

```bash
dig +short rokitg.com CNAME   # may be empty (flattened)
dig +short rokitg.com A       # Cloudflare anycast IPs
curl -sI https://rokitg.com | head -20   # Doorfee / their stack, not x-opennext
curl -sI https://www.rokitg.com | head -10  # still x-opennext / Next
```
