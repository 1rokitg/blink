import Stripe from "stripe";

import { env } from "~/env";

let stripeClient: Stripe | null = null;

export function isStripeConfigured() {
  return Boolean(env.STRIPE_SECRET_KEY.trim());
}

export function getStripeClient() {
  if (!isStripeConfigured()) {
    throw new Error("Stripe is not configured.");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(env.STRIPE_SECRET_KEY);
  }

  return stripeClient;
}
