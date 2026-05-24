import { NextResponse } from "next/server";

import Stripe from "stripe";
import { z } from "zod";

import { env } from "~/env";

export const runtime = "nodejs";

const checkoutSchema = z.object({
  tier: z.enum(["basic", "preferred", "premium"]),
  billing: z.enum(["monthly", "yearly"]),
  paymentMethod: z.enum(["card", "crypto"]).default("card"),
  walletAddress: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/)
    .optional(),
});

const PRICING: Record<
  "basic" | "preferred" | "premium",
  { monthly: number; yearly: number }
> = {
  basic: { monthly: 19, yearly: 190 },
  preferred: { monthly: 79, yearly: 790 },
  premium: { monthly: 249, yearly: 2490 },
};

const CRYPTO_DISCOUNT_RATE = 0.15;

function resolveAppUrl(request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost ?? request.headers.get("host");
  const proto =
    request.headers.get("x-forwarded-proto") ??
    (host?.includes("localhost") ? "http" : "https");

  if (host) {
    return `${proto}://${host}`;
  }

  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) {
    return `https://${vercelUrl}`;
  }

  return env.NEXT_PUBLIC_APP_URL;
}

export async function POST(request: Request) {
  if (!env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Stripe is not configured yet." },
      { status: 500 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid checkout payload." },
      { status: 400 },
    );
  }

  const { tier, billing, paymentMethod, walletAddress } = parsed.data;
  const baseAmount = PRICING[tier][billing];
  const amount =
    paymentMethod === "crypto"
      ? Math.round(baseAmount * (1 - CRYPTO_DISCOUNT_RATE))
      : baseAmount;
  const stripe = new Stripe(env.STRIPE_SECRET_KEY);
  const appUrl = resolveAppUrl(request);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      success_url: `${appUrl}/pro?checkout=success`,
      cancel_url: `${appUrl}/pro?checkout=cancel`,
      allow_promotion_codes: true,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            product_data: {
              name: `Blink Pro ${tier.charAt(0).toUpperCase()}${tier.slice(1)}`,
              description: "Blink Pro membership for Hyperliquid perp traders",
            },
            unit_amount: amount * 100,
            recurring: {
              interval: billing === "monthly" ? "month" : "year",
            },
          },
        },
      ],
      metadata: {
        product: "blink_pro",
        tier,
        billing,
        paymentMethod,
        walletAddress: walletAddress ?? "",
      },
      subscription_data: {
        trial_period_days: 7,
        metadata: {
          product: "blink_pro",
          tier,
          billing,
          paymentMethod,
          walletAddress: walletAddress ?? "",
        },
      },
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Could not create Stripe checkout URL." },
        { status: 500 },
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[stripe] checkout session failed", error);
    return NextResponse.json(
      { error: "Failed to create checkout session." },
      { status: 500 },
    );
  }
}
