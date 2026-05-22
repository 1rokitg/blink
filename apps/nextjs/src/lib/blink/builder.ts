/**
 * Blink builder-code constants and helpers.
 *
 * Values come from validated env vars (see src/env.ts):
 *   NEXT_PUBLIC_BUILDER_ADDRESS   – rokitg.eth → 0xc7BcB2EeE9BbFbf875499960746Bc52B2E1A75C6
 *   NEXT_PUBLIC_BUILDER_FEE_BPS  – fee in 0.1bps units (default 100 = 0.01%)
 */

import { env } from "~/env";

import { infoClient } from "./hyperliquid";

/** Builder address (rokitg.eth resolved). */
export const BUILDER_ADDRESS = env.NEXT_PUBLIC_BUILDER_ADDRESS as `0x${string}`;

/**
 * Max fee rate string passed to approveBuilderFee, e.g. "0.01%".
 * Derived from NEXT_PUBLIC_BUILDER_FEE_BPS (0.1bps units).
 * 100 units → 0.01%.
 */
export function builderMaxFeeRate(): `${string}%` {
  const pct = (env.NEXT_PUBLIC_BUILDER_FEE_BPS * 0.0001)
    .toFixed(4)
    .replace(/\.?0+$/, "");
  return `${pct}%` as `${string}%`;
}

/**
 * Fee attached to each order action (0.1bps units).
 * 100 = 0.01% per trade.
 */
export const BUILDER_FEE_UNITS = env.NEXT_PUBLIC_BUILDER_FEE_BPS;

/**
 * Check how much builder fee the user has already approved for Blink.
 * Returns 0 if none, or the approved fee in percentage (e.g. 0.01).
 */
export async function getApprovedBuilderFee(
  userAddress: `0x${string}`,
): Promise<number> {
  try {
    const approved = await infoClient.maxBuilderFee({
      user: userAddress,
      builder: BUILDER_ADDRESS,
    });
    return approved;
  } catch {
    return 0;
  }
}

/**
 * Returns true if the user already has a sufficient builder fee approval.
 * Considers the approval valid if the stored rate ≥ our configured fee rate.
 */
export async function isBuilderApproved(
  userAddress: `0x${string}`,
): Promise<boolean> {
  const approved = await getApprovedBuilderFee(userAddress);
  const requiredPct = BUILDER_FEE_UNITS * 0.0001; // convert 0.1bps units → %
  return approved >= requiredPct;
}
