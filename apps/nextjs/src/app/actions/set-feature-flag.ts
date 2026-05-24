"use server";

import { z } from "zod";

import { setFeatureFlag, type BlinkFeatureFlagKey } from "~/lib/blink/feature-flags.server";

const schema = z.object({
  key: z.enum([
    "growth-mode",
    "zero-fee-core-markets",
    "discounted-pro-plans",
    "boosted-referrals",
  ]),
  enabled: z.boolean(),
  walletAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
});

function readAdminAllowlist() {
  const source = process.env.NEXT_PUBLIC_ADMIN_WALLET_ALLOWLIST ?? "";
  return source
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export async function setFeatureFlagAction(input: unknown) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new Error("Invalid feature flag payload");
  }

  const wallet = parsed.data.walletAddress.toLowerCase();
  if (!readAdminAllowlist().includes(wallet)) {
    throw new Error("Unauthorized");
  }

  await setFeatureFlag(
    parsed.data.key as BlinkFeatureFlagKey,
    parsed.data.enabled,
    wallet,
  );

  return { ok: true };
}

