# Blink Status Monitor

Blink can post simple automatic Discord alerts when the public app health check
fails or reports a degraded state.

## What ships

- `GET /api/health` checks Blink's database connection and Hyperliquid API reachability.
- `.github/workflows/status-monitor.yml` runs every 5 minutes and can also be triggered manually.
- The workflow calls the public health endpoint and posts to Discord when the check fails or reports `degraded`.

## Required GitHub configuration

Set these values in the GitHub repository before enabling the monitor:

- Repository variable: `BLINK_STATUS_CHECK_URL`
  - Production: `https://blink.lat` (canonical user domain)
  - Interim fallback while DNS migrates off Vercel: `https://blinkperps.xyz`
- Repository secret: `DISCORD_STATUS_WEBHOOK_URL`
  - Discord webhook for the status channel

## How status is classified

- `ok`
  - public Blink URL responds
  - `/api/health` responds with healthy dependency checks
- `degraded`
  - public Blink URL is reachable
  - but `/api/health` fails or reports a dependency issue
- `outage`
  - the public Blink health endpoint does not respond successfully

## Alert behavior

- Healthy runs do not post to Discord.
- Degraded or outage runs do post to Discord.
- App-originated alerts (from `/api/health`) dedupe state transitions and send recovery pings.
- Discord alerts mention `@everyone` on incidents and never include environment variable names.
- Non-sensitive context (deploy region, BTC mid, builder balance, uptime) is attached when available.

## Operator smoke test

1. Set `BLINK_STATUS_CHECK_URL` and `DISCORD_STATUS_WEBHOOK_URL`.
2. Trigger the `Status Monitor` workflow manually from GitHub Actions.
3. Confirm that a healthy run exits without posting to Discord.
4. Temporarily point `BLINK_STATUS_CHECK_URL` at a failing URL to verify degraded or outage messaging.
5. Restore the correct URL once the smoke test is complete.
