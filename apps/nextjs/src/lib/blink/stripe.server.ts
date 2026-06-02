import Stripe from "stripe";

/** Read at runtime so Cloudflare Worker secrets apply without a rebuild. */
export function getStripeSecretKey() {
  return process.env.STRIPE_SECRET_KEY?.trim() ?? "";
}

export function isStripeConfigured() {
  return Boolean(getStripeSecretKey());
}

let stripeClient: Stripe | null = null;

export function getStripeClient() {
  const secretKey = getStripeSecretKey();
  if (!secretKey) {
    throw new Error("Stripe is not configured.");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey);
  }

  return stripeClient;
}
