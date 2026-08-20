#!/usr/bin/env node
/**
 * Creates The Circle Stripe catalog copied from Pastel Alpha:
 * - 1 Month  200 USDC → $200 / month
 * - 3 Months 540 USDC → $540 / every 3 months (Save 10%)
 * - 6 Months 1020 USDC → $1020 / every 6 months (Save 15%)
 * - $20-off referral coupon + REFERRAL20 (Pastel checkout “$20 off”)
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_test_... node scripts/seed-stripe.mjs
 */

import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
if (!secretKey) {
  console.error("Set STRIPE_SECRET_KEY before running this script.");
  process.exit(1);
}

const stripe = new Stripe(secretKey, {
  apiVersion: "2026-07-29.dahlia",
});

/** Prefer a specific digital services tax code when available. */
async function resolveTaxCode() {
  const preferred = [
    "txcd_10000000", // General - Electronically Supplied Services
  ];
  for (const id of preferred) {
    try {
      await stripe.taxCodes.retrieve(id);
      return id;
    } catch {
      // try next
    }
  }
  return undefined;
}

/** Exact Pastel Alpha plan ladder (joinpastel.com). */
const plans = [
  {
    key: "MONTHLY",
    name: "1 Month",
    description:
      "Pastel Alpha–matched membership: 200 USDC / 1 month. The Circle Telegram group access.",
    unitAmount: 20000,
    intervalCount: 1,
    pastelLabel: "200 USDC",
  },
  {
    key: "QUARTERLY",
    name: "3 Months",
    description:
      "Pastel Alpha–matched membership: 540 USDC / 3 months (Save 10%). The Circle Telegram group access.",
    unitAmount: 54000,
    intervalCount: 3,
    pastelLabel: "540 USDC",
  },
  {
    key: "SEMIANNUAL",
    name: "6 Months",
    description:
      "Pastel Alpha–matched membership: 1020 USDC / 6 months (Save 15%). The Circle Telegram group access.",
    unitAmount: 102000,
    intervalCount: 6,
    pastelLabel: "1020 USDC",
  },
];

async function findExistingProduct(name) {
  const products = await stripe.products.search({
    query: `name:"${name}" AND active:"true"`,
    limit: 1,
  });
  return products.data[0] ?? null;
}

async function main() {
  const taxCode = await resolveTaxCode();
  const priceEnv = {};

  console.log("Seeding Pastel Alpha pricing into Stripe (USD 1:1 with USDC)…\n");

  for (const plan of plans) {
    let product = await findExistingProduct(plan.name);
    if (!product) {
      // Also try Circle-branded legacy name from earlier seed
      const legacy = await findExistingProduct(
        `The Circle — ${plan.name}`,
      );
      product = legacy;
    }

    if (!product) {
      product = await stripe.products.create({
        name: plan.name,
        description: plan.description,
        ...(taxCode ? { tax_code: taxCode } : {}),
        metadata: {
          app: "the-circle-vip",
          planKey: plan.key,
          pastelLabel: plan.pastelLabel,
          source: "joinpastel.com",
        },
      });
      console.log(`Created product ${product.id} (${plan.name} · ${plan.pastelLabel})`);
    } else {
      await stripe.products.update(product.id, {
        name: plan.name,
        description: plan.description,
        ...(taxCode ? { tax_code: taxCode } : {}),
        metadata: {
          app: "the-circle-vip",
          planKey: plan.key,
          pastelLabel: plan.pastelLabel,
          source: "joinpastel.com",
        },
      });
      console.log(`Updated product ${product.id} (${plan.name} · ${plan.pastelLabel})`);
    }

    const existingPrices = await stripe.prices.list({
      product: product.id,
      active: true,
      limit: 10,
    });
    let price = existingPrices.data.find(
      (item) =>
        item.unit_amount === plan.unitAmount &&
        item.recurring?.interval === "month" &&
        item.recurring?.interval_count === plan.intervalCount &&
        item.currency === "usd",
    );

    if (!price) {
      price = await stripe.prices.create({
        product: product.id,
        unit_amount: plan.unitAmount,
        currency: "usd",
        tax_behavior: "exclusive",
        recurring: {
          interval: "month",
          interval_count: plan.intervalCount,
        },
        metadata: {
          app: "the-circle-vip",
          planKey: plan.key,
          pastelLabel: plan.pastelLabel,
          source: "joinpastel.com",
        },
      });
      console.log(`Created price ${price.id} ($${plan.unitAmount / 100} · ${plan.pastelLabel})`);
    } else {
      console.log(`Reusing price ${price.id} ($${plan.unitAmount / 100} · ${plan.pastelLabel})`);
    }

    priceEnv[`STRIPE_PRICE_${plan.key}`] = price.id;
  }

  // Pastel checkout shows “Discount applied: $20 off”
  let coupon;
  const coupons = await stripe.coupons.list({ limit: 100 });
  coupon = coupons.data.find(
    (item) =>
      item.id === "circle_referral_20" ||
      item.id === "pastel_referral_20" ||
      item.name === "Referral $20",
  );
  if (!coupon) {
    coupon = await stripe.coupons.create({
      id: "circle_referral_20",
      name: "Referral $20",
      amount_off: 2000,
      currency: "usd",
      duration: "once",
      metadata: {
        app: "the-circle-vip",
        source: "joinpastel.com",
        note: "Matches Pastel checkout referral discount",
      },
    });
    console.log(`Created coupon ${coupon.id}`);
  } else {
    console.log(`Reusing coupon ${coupon.id}`);
  }

  const promos = await stripe.promotionCodes.list({
    code: "REFERRAL20",
    limit: 1,
  });
  let promo = promos.data[0];
  if (!promo) {
    promo = await stripe.promotionCodes.create({
      promotion: { type: "coupon", coupon: coupon.id },
      code: "REFERRAL20",
      active: true,
      metadata: { app: "the-circle-vip", source: "joinpastel.com" },
    });
    console.log(`Created promotion code ${promo.code}`);
  } else {
    console.log(`Reusing promotion code ${promo.code}`);
  }

  console.log("\nPastel Alpha → Stripe catalog ready. Add to .env.local:\n");
  for (const [key, value] of Object.entries(priceEnv)) {
    console.log(`${key}=${value}`);
  }
  console.log("\nReferral promotion code: REFERRAL20 ($20 off once, per Pastel)");
  console.log(
    "\nDashboard reminders:\n- Enable Stripe Tax + add active registrations\n- Configure Customer Portal (cancel + payment method update)\n- Add webhook endpoint → /api/webhooks/stripe\n- Brand invoices under Settings → Branding",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
