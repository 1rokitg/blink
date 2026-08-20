import "server-only";

import { CRYPTO_CURRENCY_LABEL, usdToEur, usdToEurRate } from "@/lib/fx";
import {
  FALLBACK_PLANS,
  PLAN_ENV_KEYS,
  PLAN_ORDER,
  saveLabelForPlan,
  type Plan,
  type PlanId,
} from "@/lib/plans";
import { resolvePriceId } from "@/lib/store-config.server";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

function extractUsdcAmount(description: string | null | undefined) {
  if (!description) {
    return null;
  }
  const match = description.match(/(\d+(?:\.\d+)?)\s*USDC/i);
  if (!match) {
    return null;
  }
  return Number(match[1]);
}

function extractUsdBaseFromMetadata(
  metadata: Record<string, string> | null | undefined,
) {
  const raw = metadata?.base_amount_usd?.trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function mapPlanIdFromEnvKey(envKey: string): PlanId | null {
  for (const id of PLAN_ORDER) {
    if (PLAN_ENV_KEYS[id] === envKey) {
      return id;
    }
  }
  return null;
}

/**
 * Load plan cards from live Stripe Prices/Products.
 * Stripe prices are EUR for card billing; `amountUsd` stays the USDC list price.
 */
export async function getPlansFromStripe(): Promise<Record<PlanId, Plan>> {
  if (!isStripeConfigured()) {
    return FALLBACK_PLANS;
  }

  const stripe = getStripe();
  const plans = { ...FALLBACK_PLANS } as Record<PlanId, Plan>;
  const rate = usdToEurRate();

  for (const planId of PLAN_ORDER) {
    const envKey = PLAN_ENV_KEYS[planId];
    let priceId: string | null = null;
    try {
      priceId = await resolvePriceId(planId);
    } catch {
      priceId = process.env[envKey]?.trim() || null;
    }
    if (!priceId) {
      continue;
    }

    try {
      const price = await stripe.prices.retrieve(priceId, {
        expand: ["product"],
      });
      const product =
        typeof price.product === "object" && price.product && !price.product.deleted
          ? price.product
          : null;

      const unitAmount =
        typeof price.unit_amount === "number" ? price.unit_amount / 100 : null;
      const currency = (price.currency || "eur").toLowerCase();

      // USDC / USD list price — never take EUR unit_amount as USDC.
      const fromMeta = extractUsdBaseFromMetadata(price.metadata);
      const fromDescription = extractUsdcAmount(product?.description);
      const amountUsd =
        fromMeta ??
        fromDescription ??
        (currency === "usd" && unitAmount != null
          ? unitAmount
          : plans[planId].amountUsd);

      const amountEur =
        currency === "eur" && unitAmount != null
          ? unitAmount
          : usdToEur(amountUsd, rate);

      const interval = price.recurring?.interval === "year" ? "year" : "month";
      const intervalCount = price.recurring?.interval_count ?? 1;

      plans[planId] = {
        id: planId,
        label: product?.name?.trim() || plans[planId].label,
        amountUsd,
        amountEur,
        fxUsdToEur: rate,
        currencyLabel: "EUR",
        cryptoLabel: CRYPTO_CURRENCY_LABEL,
        interval,
        intervalCount,
        description:
          product?.description?.trim() || plans[planId].description,
        envPriceId: envKey,
        priceId: price.id,
      };
    } catch (error) {
      console.error(`[stripe-catalog] Failed to load ${envKey}`, error);
    }
  }

  const monthly = plans.month.amountUsd;
  for (const planId of PLAN_ORDER) {
    plans[planId] = {
      ...plans[planId],
      saveLabel: saveLabelForPlan(plans[planId], monthly),
    };
  }

  return plans;
}

export async function getOrderedPlans(): Promise<Plan[]> {
  const plans = await getPlansFromStripe();
  return PLAN_ORDER.map((id) => plans[id]);
}

export { mapPlanIdFromEnvKey };
