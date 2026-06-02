import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { env } from "~/env";
import {
  applyStripeCheckoutSession,
  upsertMembershipFromStripeSubscription,
} from "~/lib/blink/stripe-membership-sync.server";
import { getStripeClient } from "~/lib/blink/stripe.server";

export const runtime = "nodejs";

async function handleStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      await applyStripeCheckoutSession(session);
      return;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      await upsertMembershipFromStripeSubscription(subscription);
      return;
    }
    default:
      return;
  }
}

export async function POST(request: Request) {
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET.trim();
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Stripe webhooks are not configured." },
      { status: 500 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  const payload = await request.text();
  const stripe = getStripeClient();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    console.error("[stripe] webhook signature verification failed", error);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    await handleStripeEvent(event);
  } catch (error) {
    console.error("[stripe] webhook handler failed", {
      type: event.type,
      error,
    });
    return NextResponse.json(
      { error: "Webhook handler failed." },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}
