import {
  CRYPTO_CURRENCY_LABEL,
  DEFAULT_USD_TO_EUR_RATE,
  usdToEur,
  usdToEurRate,
} from "@/lib/fx";

export type PlanId = "month" | "quarter" | "year";

export type Plan = {
  id: PlanId;
  label: string;
  /**
   * Base USD list price — also the USDC amount charged on crypto rails.
   * Never overwrite this with a EUR Stripe `unit_amount`.
   */
  amountUsd: number;
  /** Card / Stripe amount in EUR (converted from `amountUsd`). */
  amountEur: number;
  /** FX used for `amountEur`. */
  fxUsdToEur: number;
  /** Fiat display unit for card checkout. */
  currencyLabel: "EUR";
  /** Crypto display unit. */
  cryptoLabel: typeof CRYPTO_CURRENCY_LABEL;
  interval: "month" | "year";
  intervalCount: number;
  saveLabel?: string;
  description: string;
  envPriceId: string;
  /** Active Stripe Price ID (EUR after currency switch). */
  priceId?: string;
};

export const PLAN_ENV_KEYS: Record<PlanId, string> = {
  month: "STRIPE_PRICE_MONTHLY",
  quarter: "STRIPE_PRICE_QUARTERLY",
  year: "STRIPE_PRICE_SEMIANNUAL",
};

function buildFallback(
  id: PlanId,
  label: string,
  amountUsd: number,
  interval: "month" | "year",
  intervalCount: number,
  descriptionUsd: string,
  saveLabel?: string,
): Plan {
  const rate = DEFAULT_USD_TO_EUR_RATE;
  const amountEur = usdToEur(amountUsd, rate);
  return {
    id,
    label,
    amountUsd,
    amountEur,
    fxUsdToEur: rate,
    currencyLabel: "EUR",
    cryptoLabel: CRYPTO_CURRENCY_LABEL,
    interval,
    intervalCount,
    saveLabel,
    description: descriptionUsd,
    envPriceId: PLAN_ENV_KEYS[id],
  };
}

/**
 * Fallback catalog used when Stripe is unavailable at render time.
 * Prefer live Stripe product name / description via getPlansFromStripe().
 */
export const FALLBACK_PLANS: Record<PlanId, Plan> = {
  month: buildFallback(
    "month",
    "1 Month",
    50,
    "month",
    1,
    "50 USDC / €43.28 · 1 month. The Circle Telegram group access.",
  ),
  quarter: buildFallback(
    "quarter",
    "3 Months",
    99,
    "month",
    3,
    "99 USDC / €85.70 · 3 months. The Circle Telegram group access.",
    "Save 34%",
  ),
  year: buildFallback(
    "year",
    "One Year",
    210,
    "year",
    1,
    "210 USDC / €181.79 · year. The Circle Telegram group access.",
    "Save 65%",
  ),
};

export const PLAN_ORDER: PlanId[] = ["month", "quarter", "year"];

/** Pastel-style referral checkout discount (USD base → EUR for cards). */
export const REFERRAL_CHECKOUT_DISCOUNT_USD = 20;
export const REFERRAL_CHECKOUT_DISCOUNT_EUR = usdToEur(
  REFERRAL_CHECKOUT_DISCOUNT_USD,
  DEFAULT_USD_TO_EUR_RATE,
);

export function getPlan(
  planId: string,
  plans: Record<PlanId, Plan> = FALLBACK_PLANS,
): Plan | null {
  if (planId in plans) {
    return plans[planId as PlanId];
  }
  return null;
}

export function getPriceIdForPlan(planId: PlanId): string {
  const envKey = PLAN_ENV_KEYS[planId];
  const priceId = process.env[envKey]?.trim();
  if (!priceId) {
    throw new Error(
      `Missing ${envKey}. Set the Stripe price ID in .env.local.`,
    );
  }
  return priceId;
}

/** Card / public list price label (EUR). */
export function formatPlanAmount(plan: Plan) {
  return formatEur(plan.amountEur);
}

/** Crypto rail label (USDC). */
export function formatPlanCryptoAmount(plan: Plan) {
  return `${plan.amountUsd} ${plan.cryptoLabel}`;
}

export function formatEur(amount: number) {
  if (!Number.isFinite(amount)) return "€0";
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function saveLabelForPlan(plan: Plan, monthlyUsd: number): string | undefined {
  if (plan.id === "month" || monthlyUsd <= 0) {
    return undefined;
  }
  const months =
    plan.interval === "year"
      ? 12 * plan.intervalCount
      : plan.intervalCount;
  const fullPrice = monthlyUsd * months;
  if (fullPrice <= plan.amountUsd) {
    return undefined;
  }
  const pct = Math.round((1 - plan.amountUsd / fullPrice) * 100);
  return pct > 0 ? `Save ${pct}%` : undefined;
}

export function withLiveFx(plan: Plan, rate = usdToEurRate()): Plan {
  return {
    ...plan,
    amountEur: usdToEur(plan.amountUsd, rate),
    fxUsdToEur: rate,
  };
}
