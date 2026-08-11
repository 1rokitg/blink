import { NextResponse } from "next/server";

import { getTelegramSession } from "@/lib/telegram-session";
import {
  getAppUrl,
  getStripe,
  isStripeConfigured,
} from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST() {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe is not configured." },
      { status: 500 },
    );
  }

  const telegram = await getTelegramSession();
  if (!telegram) {
    return NextResponse.json(
      { error: "Connect Telegram to manage billing." },
      { status: 401 },
    );
  }

  const stripe = getStripe();
  let customerId: string | undefined;

  try {
    const customers = await stripe.customers.search({
      query: `metadata["telegramUserId"]:"${telegram.id}"`,
      limit: 1,
    });
    customerId = customers.data[0]?.id;
  } catch {
    // fall through
  }

  if (!customerId) {
    return NextResponse.json(
      {
        error:
          "No Stripe customer found for this Telegram account. Complete checkout first.",
      },
      { status: 404 },
    );
  }

  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${getAppUrl()}/dashboard`,
  });

  return NextResponse.json({ url: portal.url });
}
