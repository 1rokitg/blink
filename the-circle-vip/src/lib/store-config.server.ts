import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

import type { StorePlanRow } from "@/lib/analytics-types";
import { CARD_CURRENCY, usdToEur, usdToEurCents, usdToEurRate } from "@/lib/fx";
import {
  FALLBACK_PLANS,
  PLAN_ENV_KEYS,
  PLAN_ORDER,
  type PlanId,
} from "@/lib/plans";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

export type { StorePlanRow };

const PRICES_KEY = "config:prices";

export type PriceOverrides = Partial<Record<PlanId, string>>;

async function getKv() {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return (env as CloudflareEnv).CRYPTO_PAYMENTS ?? null;
  } catch {
    return null;
  }
}

export async function getPriceOverrides(): Promise<PriceOverrides> {
  const kv = await getKv();
  if (!kv) return {};
  return (await kv.get<PriceOverrides>(PRICES_KEY, "json")) ?? {};
}

export async function setPriceOverride(planId: PlanId, priceId: string) {
  const kv = await getKv();
  if (!kv) {
    throw new Error("KV is not available to persist price overrides.");
  }
  const current = await getPriceOverrides();
  const next = { ...current, [planId]: priceId };
  await kv.put(PRICES_KEY, JSON.stringify(next));
  return next;
}

/** Prefer KV override → env price id. */
export async function resolvePriceId(planId: PlanId): Promise<string> {
  const overrides = await getPriceOverrides();
  const fromKv = overrides[planId]?.trim();
  if (fromKv) return fromKv;
  const fromEnv = process.env[PLAN_ENV_KEYS[planId]]?.trim();
  if (fromEnv) return fromEnv;
  throw new Error(
    `Missing price for ${planId}. Set ${PLAN_ENV_KEYS[planId]} or update Store.`,
  );
}

function monthlyFromAmount(
  amount: number,
  interval: string,
  intervalCount: number,
) {
  const count = intervalCount || 1;
  if (interval === "year") return amount / (12 * count);
  if (interval === "week") return (amount / count) * (52 / 12);
  if (interval === "day") return (amount / count) * (365 / 12);
  return amount / count;
}

function baseUsdFromPrice(
  price: {
    currency?: string | null;
    unit_amount?: number | null;
    metadata?: Record<string, string> | null;
  },
  fallbackUsd: number,
) {
  const meta = price.metadata?.base_amount_usd?.trim();
  if (meta) {
    const n = Number(meta);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const currency = (price.currency || CARD_CURRENCY).toLowerCase();
  if (currency === "usd" && typeof price.unit_amount === "number") {
    return price.unit_amount / 100;
  }
  return fallbackUsd;
}

export async function getStoreCatalog(options?: {
  pathCounts?: { path: string; pageviews: number }[];
  subscriptionPlanCounts?: Partial<
    Record<PlanId, { subscribers: number; mrr: number }>
  >;
}): Promise<StorePlanRow[]> {
  const overrides = await getPriceOverrides();
  const stripeReady = isStripeConfigured();
  const stripe = stripeReady ? getStripe() : null;
  const rows: StorePlanRow[] = [];
  const rate = usdToEurRate();

  // Approximate "interest" by homepage + checkout hash traffic
  const checkoutStarts =
    options?.pathCounts
      ?.filter(
        (row) =>
          row.path === "/" ||
          row.path.startsWith("/en") ||
          row.path.startsWith("/es") ||
          row.path.includes("checkout"),
      )
      .reduce((sum, row) => sum + row.pageviews, 0) ?? 0;

  for (const planId of PLAN_ORDER) {
    const fallback = FALLBACK_PLANS[planId];
    const envPrice = process.env[PLAN_ENV_KEYS[planId]]?.trim() || null;
    const priceId = overrides[planId]?.trim() || envPrice;
    const stats = options?.subscriptionPlanCounts?.[planId] ?? {
      subscribers: 0,
      mrr: 0,
    };

    if (!stripe || !priceId) {
      rows.push({
        id: planId,
        label: fallback.label,
        description: fallback.description,
        amountUsd: fallback.amountUsd,
        amountEur: fallback.amountEur,
        currency: CARD_CURRENCY,
        interval: fallback.interval,
        intervalCount: fallback.intervalCount,
        priceId,
        productId: null,
        active: Boolean(priceId),
        envKey: PLAN_ENV_KEYS[planId],
        override: Boolean(overrides[planId]),
        subscribers: stats.subscribers,
        mrr: stats.mrr,
        checkoutStarts,
      });
      continue;
    }

    try {
      const price = await stripe.prices.retrieve(priceId, {
        expand: ["product"],
      });
      const product =
        typeof price.product === "object" &&
        price.product &&
        !price.product.deleted
          ? price.product
          : null;
      const currency = (price.currency || CARD_CURRENCY).toLowerCase();
      const unit =
        typeof price.unit_amount === "number" ? price.unit_amount / 100 : null;
      const amountUsd = baseUsdFromPrice(price, fallback.amountUsd);
      const amountEur =
        currency === "eur" && unit != null ? unit : usdToEur(amountUsd, rate);
      const interval = price.recurring?.interval ?? fallback.interval;
      const intervalCount =
        price.recurring?.interval_count ?? fallback.intervalCount;

      rows.push({
        id: planId,
        label: product?.name?.trim() || fallback.label,
        description: product?.description?.trim() || fallback.description,
        amountUsd,
        amountEur,
        currency,
        interval,
        intervalCount,
        priceId: price.id,
        productId: product?.id ?? null,
        active: price.active && (product?.active ?? true),
        envKey: PLAN_ENV_KEYS[planId],
        override: Boolean(overrides[planId]),
        subscribers: stats.subscribers,
        mrr: stats.mrr,
        checkoutStarts,
      });
    } catch {
      rows.push({
        id: planId,
        label: fallback.label,
        description: fallback.description,
        amountUsd: fallback.amountUsd,
        amountEur: fallback.amountEur,
        currency: CARD_CURRENCY,
        interval: fallback.interval,
        intervalCount: fallback.intervalCount,
        priceId,
        productId: null,
        active: false,
        envKey: PLAN_ENV_KEYS[planId],
        override: Boolean(overrides[planId]),
        subscribers: stats.subscribers,
        mrr: stats.mrr,
        checkoutStarts,
      });
    }
  }

  return rows;
}

export async function updateStoreProduct(input: {
  planId: PlanId;
  name?: string;
  description?: string;
}) {
  if (!isStripeConfigured()) {
    throw new Error("Stripe is not configured.");
  }
  const catalog = await getStoreCatalog();
  const row = catalog.find((item) => item.id === input.planId);
  if (!row?.productId) {
    throw new Error("No Stripe product linked to this plan.");
  }
  const stripe = getStripe();
  return stripe.products.update(row.productId, {
    ...(input.name ? { name: input.name.slice(0, 120) } : {}),
    ...(input.description !== undefined
      ? { description: input.description.slice(0, 500) }
      : {}),
  });
}

/**
 * Push a new Stripe price. `amountUsd` is the USD list / USDC base;
 * card billing is created in EUR at the configured FX rate.
 */
export async function setStorePrice(input: {
  planId: PlanId;
  amountUsd: number;
}) {
  if (!isStripeConfigured()) {
    throw new Error("Stripe is not configured.");
  }
  if (!Number.isFinite(input.amountUsd) || input.amountUsd < 1) {
    throw new Error("Amount must be at least $1 USD (USDC list price).");
  }

  const catalog = await getStoreCatalog();
  const row = catalog.find((item) => item.id === input.planId);
  if (!row?.productId) {
    throw new Error("No Stripe product linked to this plan.");
  }

  const stripe = getStripe();
  const amountEurCents = usdToEurCents(input.amountUsd);
  const price = await stripe.prices.create({
    product: row.productId,
    currency: CARD_CURRENCY,
    unit_amount: amountEurCents,
    recurring: {
      interval: row.interval === "year" ? "year" : "month",
      interval_count: row.intervalCount || 1,
    },
    metadata: {
      planId: input.planId,
      plan_id: input.planId,
      base_amount_usd: String(input.amountUsd),
      app: "the-circle-vip",
      source: "internal-store",
    },
  });

  // Archive previous price so checkout can't pick it accidentally via Dashboard
  if (row.priceId && row.priceId !== price.id) {
    try {
      await stripe.prices.update(row.priceId, { active: false });
    } catch {
      // non-fatal
    }
  }

  await setPriceOverride(input.planId, price.id);
  const amountEur = amountEurCents / 100;
  return {
    priceId: price.id,
    amountUsd: input.amountUsd,
    amountEur,
    monthly: monthlyFromAmount(amountEur, row.interval, row.intervalCount),
  };
}

export async function createStorePromo(input: {
  code: string;
  amountOffUsd: number;
}) {
  if (!isStripeConfigured()) {
    throw new Error("Stripe is not configured.");
  }
  const code = input.code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  if (code.length < 3) {
    throw new Error("Promo code must be at least 3 characters.");
  }
  if (!Number.isFinite(input.amountOffUsd) || input.amountOffUsd < 1) {
    throw new Error("Discount must be at least $1 USD (converted to EUR).");
  }

  const stripe = getStripe();
  const amountOffEurCents = usdToEurCents(input.amountOffUsd);
  const coupon = await stripe.coupons.create({
    amount_off: amountOffEurCents,
    currency: CARD_CURRENCY,
    duration: "once",
    name: `Circle ${code}`,
    metadata: {
      app: "the-circle-vip",
      source: "internal-store",
      base_amount_off_usd: String(input.amountOffUsd),
    },
  });
  const promo = await stripe.promotionCodes.create({
    promotion: { type: "coupon", coupon: coupon.id },
    code,
    active: true,
  });
  return {
    couponId: coupon.id,
    promoId: promo.id,
    code: promo.code,
    amountOffEur: amountOffEurCents / 100,
  };
}
