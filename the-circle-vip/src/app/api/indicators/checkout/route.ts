import { NextResponse } from "next/server";
import { z } from "zod";

import { usdToEur } from "@/lib/fx";
import { INDICATORS_SITE } from "@/lib/indicators-site";
import {
  getStripe,
  isStripeConfigured,
  randomIntegrationSuffix,
} from "@/lib/stripe";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().trim().email().optional(),
});

function resolveIndicatorsPriceId() {
  return (
    process.env[INDICATORS_SITE.envPriceId]?.trim() ||
    process.env.STRIPE_PRICE_ADDON_INDICATORS?.trim() ||
    INDICATORS_SITE.fallbackPriceId
  );
}

function indicatorsAppUrl() {
  return (
    process.env.NEXT_PUBLIC_INDICATORS_URL?.replace(/\/$/, "") ||
    `https://${INDICATORS_SITE.host}`
  );
}

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe is not configured." },
      { status: 500 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid checkout payload." },
      { status: 400 },
    );
  }

  try {
    const stripe = getStripe();
    const priceId = resolveIndicatorsPriceId();
    const appUrl = indicatorsAppUrl();

    // One-time digital pack (.zip + video + templates). If env still points at
    // a legacy recurring price, Stripe will reject — prefer STRIPE_PRICE_INDICATORS_PACK.
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${appUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/?canceled=1`,
        automatic_tax: { enabled: true },
        allow_promotion_codes: true,
        customer_email: parsed.data.email || undefined,
        invoice_creation: { enabled: true },
        metadata: {
          app: "indicators-rokitg",
          product: "indicators_pack",
          source: "indicators_site",
          billing: "one_time",
          deliverables: "zip,video,aggr_templates",
        },
        payment_intent_data: {
          description: `${INDICATORS_SITE.name} · indicators zip + setup video + aggr.trade templates`,
          metadata: {
            app: "indicators-rokitg",
            product: "indicators_pack",
            source: "indicators_site",
          },
        },
      },
      {
        idempotencyKey: `indicators_pack_${Date.now()}_${randomIntegrationSuffix()}`,
      },
    );

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe did not return a Checkout URL." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      url: session.url,
      amountLabel: `€${usdToEur(INDICATORS_SITE.amountUsd).toFixed(2)}`,
    });
  } catch (error) {
    console.error("[indicators checkout]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Checkout failed.",
      },
      { status: 500 },
    );
  }
}
