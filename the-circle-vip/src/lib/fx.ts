/**
 * USD → EUR conversion for card billing.
 * Crypto rails stay in USDC (1:1 with the USD list price).
 *
 * Rate snapshot: ECB-derived via open.er-api.com (2026-08-06).
 * Override with env `USD_TO_EUR_RATE` when redeploying.
 */

/** Fallback when env is unset — do not invent live FX at request time. */
export const DEFAULT_USD_TO_EUR_RATE = 0.865682;

export function usdToEurRate() {
  const raw = process.env.USD_TO_EUR_RATE?.trim();
  const n = raw ? Number(raw) : DEFAULT_USD_TO_EUR_RATE;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_USD_TO_EUR_RATE;
}

/** Convert a USD list price to EUR (2 decimal places). */
export function usdToEur(amountUsd: number, rate = usdToEurRate()) {
  return Math.round(amountUsd * rate * 100) / 100;
}

/** Stripe expects integer minor units. */
export function usdToEurCents(amountUsd: number, rate = usdToEurRate()) {
  return Math.round(amountUsd * rate * 100);
}

export const CARD_CURRENCY = "eur" as const;
export const CRYPTO_CURRENCY_LABEL = "USDC" as const;
