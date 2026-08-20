import "server-only";

import Stripe from "stripe";

export function getStripeSecretKey() {
  return process.env.STRIPE_SECRET_KEY?.trim() ?? "";
}

export function isStripeConfigured() {
  return Boolean(getStripeSecretKey());
}

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  const secretKey = getStripeSecretKey();
  if (!secretKey) {
    throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY.");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey, {
      apiVersion: "2026-07-29.dahlia",
      typescript: true,
    });
  }

  return stripeClient;
}

export function getAppUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") ||
    "https://www.rokitg.com"
  );
}

/** Random 8-letter suffix for Checkout integration_identifier. */
export function randomIntegrationSuffix() {
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  let out = "";
  for (let i = 0; i < 8; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}
