import { NextResponse } from "next/server";
import { z } from "zod";

import {
  recordAffiliateConversion,
  recordAffiliateSignup,
} from "@/lib/affiliates.server";
import {
  attributionToStripeMetadata,
  sanitizeAttribution,
  type Attribution,
} from "@/lib/attribution";
import { getTelegramSession } from "@/lib/telegram-session";
import { getPlan, type PlanId } from "@/lib/plans";
import { resolvePriceId } from "@/lib/store-config.server";
import { getPlansFromStripe } from "@/lib/stripe-catalog";
import {
  getAppUrl,
  getStripe,
  isStripeConfigured,
  randomIntegrationSuffix,
} from "@/lib/stripe";

export const runtime = "nodejs";

const attributionSchema = z
  .object({
    channel: z.string().trim().max(64).optional(),
    utmSource: z.string().trim().max(64).optional().nullable(),
    utmMedium: z.string().trim().max(64).optional().nullable(),
    utmCampaign: z.string().trim().max(128).optional().nullable(),
    utmContent: z.string().trim().max(128).optional().nullable(),
    utmTerm: z.string().trim().max(128).optional().nullable(),
    referrer: z.string().trim().max(240).optional().nullable(),
    capturedAt: z.string().trim().max(40).optional().nullable(),
  })
  .optional()
  .nullable();

const checkoutSchema = z.object({
  planId: z.enum(["month", "quarter", "year"]),
  referralCode: z.string().trim().max(64).optional(),
  telegramUsername: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^@?[a-zA-Z0-9_]{2,64}$/)
    .optional(),
  attribution: attributionSchema,
});

async function findOrCreateCustomer(
  stripe: ReturnType<typeof getStripe>,
  identity: { id: string; username: string } | null,
) {
  if (identity) {
    try {
      const existing = await stripe.customers.search({
        query: `metadata["telegramUserId"]:"${identity.id}"`,
        limit: 1,
      });
      if (existing.data[0]) {
        return existing.data[0];
      }
    } catch {
      // fall through
    }

    return stripe.customers.create({
      name: identity.username,
      metadata: {
        telegramUserId: identity.id,
        telegramUsername: identity.username,
        app: "the-circle-vip",
      },
    });
  }

  return stripe.customers.create({
    metadata: {
      app: "the-circle-vip",
      source: "guest_checkout",
    },
  });
}

function manualTelegramId(username: string) {
  return `manual:${username.replace(/^@/, "").toLowerCase()}`;
}

/** Map legacy USD referral codes onto the EUR promo when needed. */
function referralPromoCandidates(code: string) {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return [];
  if (normalized === "REFERRAL20" || normalized === "REFERRALEUR") {
    return ["REFERRALEUR", "REFERRAL20"];
  }
  return [normalized];
}

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe is not configured yet. Set STRIPE_SECRET_KEY." },
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

  const sessionTelegram = await getTelegramSession();
  const manualUsername = parsed.data.telegramUsername
    ?.trim()
    .replace(/^@/, "");

  const telegram = sessionTelegram
    ? {
        id: sessionTelegram.id,
        username:
          sessionTelegram.username ||
          sessionTelegram.firstName ||
          sessionTelegram.id,
      }
    : manualUsername
      ? {
          id: manualTelegramId(manualUsername),
          username: manualUsername,
        }
      : null;

  const planId = parsed.data.planId as PlanId;
  const catalog = await getPlansFromStripe();
  const plan = getPlan(planId, catalog);
  if (!plan) {
    return NextResponse.json({ error: "Unknown plan." }, { status: 400 });
  }

  let priceId: string;
  try {
    priceId = plan.priceId || (await resolvePriceId(planId));
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Stripe price IDs are not configured.",
      },
      { status: 500 },
    );
  }

  const referralCode = parsed.data.referralCode?.trim() || undefined;
  const attribution = sanitizeAttribution(
    parsed.data.attribution as Partial<Attribution> | null | undefined,
  );
  const appUrl = getAppUrl();
  const stripe = getStripe();
  const customer = await findOrCreateCustomer(stripe, telegram);

  const metadata = {
    planId,
    ...(telegram
      ? {
          telegramUserId: telegram.id,
          telegramUsername: telegram.username,
        }
      : {}),
    ...(referralCode ? { referralCode } : {}),
    ...attributionToStripeMetadata(attribution),
  };

  const sessionParams: Parameters<typeof stripe.checkout.sessions.create>[0] = {
    mode: "subscription",
    customer: customer.id,
    customer_update: { address: "auto", name: "auto" },
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/cancel`,
    automatic_tax: { enabled: true },
    allow_promotion_codes: true,
    ...(telegram ? { client_reference_id: telegram.id.slice(0, 200) } : {}),
    metadata,
    subscription_data: {
      metadata,
      description: plan.description,
    },
    integration_identifier: `circle-vip-hosted_${randomIntegrationSuffix()}`,
  };

  if (referralCode) {
    const candidates = referralPromoCandidates(referralCode);
    let promo: { id: string } | undefined;
    for (const code of candidates) {
      const promotionCodes = await stripe.promotionCodes.list({
        code,
        active: true,
        limit: 1,
      });
      if (promotionCodes.data[0]) {
        promo = promotionCodes.data[0];
        break;
      }
    }
    if (promo) {
      sessionParams.discounts = [{ promotion_code: promo.id }];
      delete sessionParams.allow_promotion_codes;
    }
  }

  try {
    const session = await stripe.checkout.sessions.create(sessionParams);

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe did not return a Checkout URL." },
        { status: 500 },
      );
    }

    if (referralCode) {
      try {
        const signup = await recordAffiliateSignup(referralCode);
        if (signup) {
          await recordAffiliateConversion({
            code: referralCode,
            amountUsd: plan.amountUsd,
          });
        }
      } catch (error) {
        console.error("[checkout] affiliate attribution", error);
      }
    }

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error("[checkout]", error);
    const message =
      error instanceof Error ? error.message : "Failed to create Checkout.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
