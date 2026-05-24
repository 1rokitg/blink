/**
 * Blink builder-code constants and helpers.
 *
 * Values come from validated env vars (see src/env.ts):
 *   NEXT_PUBLIC_BUILDER_ADDRESS   – rokitg.eth → 0xc7BcB2EeE9BbFbf875499960746Bc52B2E1A75C6
 *   NEXT_PUBLIC_BUILDER_FEE_BPS  – fee in 0.1bps units (default 100 = 0.01%)
 */

import { getAddress } from "viem";

import { env } from "~/env";

import { infoClient } from "./hyperliquid";

/** Builder address (rokitg.eth resolved) — EIP-55 checksummed. */
export const BUILDER_ADDRESS = getAddress(env.NEXT_PUBLIC_BUILDER_ADDRESS);

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
 * Hyperliquid's maxBuilderFee can be returned in different forms depending on client/runtime.
 * We normalize to builder fee units (0.1 bps units), where 100 = 0.01%.
 */
function normalizeToBuilderFeeUnits(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  // If value is fractional (< 1), treat as percent and convert:
  // 0.01 (%) => 100 units
  if (raw < 1) {
    return Math.max(0, Math.round(raw / 0.0001));
  }
  // Otherwise treat as already being units.
  return Math.max(0, Math.round(raw));
}

/**
 * Check how much builder fee the user has already approved for Blink.
 * Returns 0 if none, or approved fee in 0.1 bps units.
 */
export async function getApprovedBuilderFeeUnits(
  userAddress: `0x${string}`,
): Promise<number> {
  try {
    const approvedRaw = await infoClient.maxBuilderFee({
      user: userAddress,
      builder: BUILDER_ADDRESS,
    });
    return normalizeToBuilderFeeUnits(Number(approvedRaw ?? 0));
  } catch {
    return 0;
  }
}

/**
 * Returns true if the user already has a sufficient builder fee approval.
 * Considers the approval valid if approved units ≥ required units.
 */
export async function isBuilderApproved(
  userAddress: `0x${string}`,
  requiredFeeUnits: number = BUILDER_FEE_UNITS,
): Promise<boolean> {
  const approvedUnits = await getApprovedBuilderFeeUnits(userAddress);
  return approvedUnits >= Math.max(0, Math.round(requiredFeeUnits));
}
