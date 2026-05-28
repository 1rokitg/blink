/**
 * Blink builder-code constants and helpers.
 *
 * Values come from validated env vars (see src/env.ts):
 *   NEXT_PUBLIC_BUILDER_ADDRESS   – rokitg.eth → 0xc7BcB2EeE9BbFbf875499960746Bc52B2E1A75C6
 *   NEXT_PUBLIC_BUILDER_FEE_BPS  – fee in HL's unit system (1 unit = 0.1bps = 0.001%)
 *                                   10 units → 0.01%  (recommended default)
 *                                   100 units → 0.1%  (HL maximum)
 *
 * Unit system note:
 *   Hyperliquid's `f` field in orders and `maxBuilderFee` info endpoint both use
 *   the same unit where 1 unit = 0.1 basis points = 0.001%.
 *   The `approveBuilderFee` action takes a human-readable percent string ("0.01%").
 *   This file bridges between the two representations.
 */

import { env } from "~/env";

import { hasBlinkWebAgent } from "./blink-agent";
import { infoClient } from "./hyperliquid";

/** Builder address (rokitg.eth resolved) — EIP-55 checksummed via env schema transform. */
export const BUILDER_ADDRESS = env.NEXT_PUBLIC_BUILDER_ADDRESS;

/**
 * Max fee rate string passed to approveBuilderFee, e.g. "0.01%".
 * Derived from NEXT_PUBLIC_BUILDER_FEE_BPS using HL's unit system:
 *   1 unit = 0.1 bps = 0.001%
 *   10 units → "0.01%"
 *   100 units → "0.1%" (maximum HL allows)
 */
export function builderMaxFeeRate(): `${string}%` {
  const pct = (env.NEXT_PUBLIC_BUILDER_FEE_BPS * 0.001)
    .toFixed(4)
    .replace(/\.?0+$/, "");
  return `${pct}%` as `${string}%`;
}

/**
 * Fee attached to each order's builder field (HL unit: 1 = 0.001%).
 * Must be ≤ the approved maxFeeRate at all times — HL rejects orders otherwise.
 * With NEXT_PUBLIC_BUILDER_FEE_BPS=10: f=10 → 0.01% per fill.
 */
export const BUILDER_FEE_UNITS = env.NEXT_PUBLIC_BUILDER_FEE_BPS;

/**
 * Hyperliquid's maxBuilderFee endpoint can return the approved rate in different
 * representations depending on SDK version / network response:
 *   - As a fractional percent decimal, e.g. 0.01 (meaning 0.01%)
 *   - As an integer in HL's unit system, e.g. 10 (meaning 10 × 0.001% = 0.01%)
 *
 * We normalize both to HL's unit system (1 unit = 0.001%) for comparison
 * against BUILDER_FEE_UNITS.
 */
function normalizeToBuilderFeeUnits(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  // Fractional value → treat as a percentage decimal (e.g. 0.01 = 0.01%).
  // Convert to HL units: 0.01% / 0.001%_per_unit = 10 units.
  if (raw < 1) {
    return Math.max(0, Math.round(raw / 0.001));
  }
  // Integer-like value → already in HL units.
  return Math.max(0, Math.round(raw));
}

/**
 * Fetch the builder fee approval stored on Hyperliquid L1 for this user.
 * Returns 0 if none, or the approved rate in HL units (1 unit = 0.001%).
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
 * Returns true if Hyperliquid L1 has a builder fee approval for this user
 * that covers at least the required fee units (defaults to BUILDER_FEE_UNITS).
 */
export async function isBuilderApproved(
  userAddress: `0x${string}`,
  requiredFeeUnits: number = BUILDER_FEE_UNITS,
): Promise<boolean> {
  const approvedUnits = await getApprovedBuilderFeeUnits(userAddress);
  return approvedUnits >= Math.max(0, Math.round(requiredFeeUnits));
}

/**
 * Full Blink onboarding: builder fee on our code + approveAgent with agentName
 * {@link BLINK_WEB_AGENT_NAME} (visible on Hyperliquid explorer).
 */
export async function isBlinkTradingEnabled(
  userAddress: `0x${string}`,
  requiredFeeUnits: number = BUILDER_FEE_UNITS,
): Promise<boolean> {
  const [feeApproved, agentApproved] = await Promise.all([
    isBuilderApproved(userAddress, requiredFeeUnits),
    hasBlinkWebAgent(userAddress),
  ]);
  return feeApproved && agentApproved;
}
