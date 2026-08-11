#!/usr/bin/env bash
# Deploy The Circle to the MAIN Cloudflare account only.
# Never uses --temporary.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f "$ROOT/.cf-credentials.env" ]]; then
  # shellcheck disable=SC1091
  set -a
  source "$ROOT/.cf-credentials.env"
  set +a
fi

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" || -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
  echo "Missing CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID."
  echo "Put them in .cf-credentials.env (gitignored) or export them."
  exit 1
fi

if [[ "$CLOUDFLARE_ACCOUNT_ID" != "72265998f8cf66e3ab4d88575895dd0d" ]]; then
  echo "Refusing to deploy: unexpected CLOUDFLARE_ACCOUNT_ID=$CLOUDFLARE_ACCOUNT_ID"
  echo "Expected main account 72265998f8cf66e3ab4d88575895dd0d"
  exit 1
fi

# Stale shell NEXT_PUBLIC_* values override .env.local during `next build`
# (e.g. old tunnel URL or bare https://t.me/). Prefer .dev.vars / .env.local.
if [[ -f "$ROOT/.dev.vars" ]]; then
  # shellcheck disable=SC1091
  set -a
  # shellcheck disable=SC1090
  source "$ROOT/.dev.vars"
  set +a
elif [[ -f "$ROOT/.env.local" ]]; then
  # shellcheck disable=SC1091
  set -a
  # shellcheck disable=SC1090
  source "$ROOT/.env.local"
  set +a
fi

: "${NEXT_PUBLIC_APP_URL:=https://rokitg.com}"
: "${NEXT_PUBLIC_TELEGRAM_INVITE_URL:=https://t.me/rokitgg}"
export NEXT_PUBLIC_APP_URL NEXT_PUBLIC_TELEGRAM_INVITE_URL

echo "Deploy build env: APP_URL=$NEXT_PUBLIC_APP_URL INVITE=$NEXT_PUBLIC_TELEGRAM_INVITE_URL"

pnpm build:cloudflare
pnpm exec wrangler deploy --minify
echo "Live: https://rokitg.com (www.rokitg.com · workers.dev backup)"
