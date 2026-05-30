import { eq, inArray } from "drizzle-orm";

import { db } from "@acme/db/client";
import { FeatureFlag } from "@acme/db/schema";

const DEFAULT_FLAGS = {
  "growth-mode": false,
  "zero-fee-core-markets": false,
  "discounted-pro-plans": false,
  "boosted-referrals": false,
} as const;

export type BlinkFeatureFlagKey = keyof typeof DEFAULT_FLAGS;

export async function getFeatureFlags() {
  const keys = Object.keys(DEFAULT_FLAGS) as BlinkFeatureFlagKey[];
  const rows = await db
    .select({
      key: FeatureFlag.key,
      enabled: FeatureFlag.enabled,
      description: FeatureFlag.description,
      updatedBy: FeatureFlag.updatedBy,
      updatedAt: FeatureFlag.updatedAt,
    })
    .from(FeatureFlag)
    .where(inArray(FeatureFlag.key, keys));

  const byKey = new Map(rows.map((r) => [r.key, r]));
  return keys.map((key) => ({
    key,
    enabled: byKey.get(key)?.enabled ?? DEFAULT_FLAGS[key],
    description:
      byKey.get(key)?.description ??
      (key === "growth-mode"
        ? "Master switch for growth-focused incentives."
        : key === "zero-fee-core-markets"
          ? "Zero builder fee for BTC/ETH/SOL/HYPE."
          : key === "discounted-pro-plans"
            ? "Apply discounted Blink Pro pricing."
            : "Increase referral reward multipliers."),
    updatedBy: byKey.get(key)?.updatedBy ?? null,
    updatedAt: byKey.get(key)?.updatedAt?.toISOString() ?? null,
  }));
}

export async function isFeatureFlagEnabled(
  key: BlinkFeatureFlagKey,
  fallback = false,
) {
  const row = await db
    .select({ enabled: FeatureFlag.enabled })
    .from(FeatureFlag)
    .where(eq(FeatureFlag.key, key))
    .limit(1);
  return row[0]?.enabled ?? fallback;
}

export async function setFeatureFlag(
  key: BlinkFeatureFlagKey,
  enabled: boolean,
  updatedBy?: string,
) {
  await db
    .insert(FeatureFlag)
    .values({
      key,
      enabled,
      updatedBy: updatedBy?.toLowerCase(),
    })
    .onConflictDoUpdate({
      target: FeatureFlag.key,
      set: {
        enabled,
        updatedBy: updatedBy?.toLowerCase(),
        updatedAt: new Date(),
      },
    });
}

