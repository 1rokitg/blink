import { and, eq, gt } from "drizzle-orm";

import { db } from "@acme/db/client";
import { BlinkMembership } from "@acme/db/schema";

import { env } from "~/env";

import { BUILDER_FEE_UNITS } from "./builder";
import { GROWTH_ZERO_FEE_MARKETS, isGrowthModeEnabled } from "./growth-mode";

function parseAllowlist() {
  return env.BLINK_PRO_WALLET_ALLOWLIST.split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export async function isWalletBlinkPro(walletAddress: string) {
  const normalized = walletAddress.toLowerCase();
  if (parseAllowlist().includes(normalized)) return true;

  try {
    const rows = await db
      .select({
        id: BlinkMembership.id,
      })
      .from(BlinkMembership)
      .where(
        and(
          eq(BlinkMembership.walletAddress, normalized),
          eq(BlinkMembership.status, "active"),
          gt(BlinkMembership.currentPeriodEnd, new Date()),
        ),
      )
      .limit(1);
    return rows.length > 0;
  } catch (error) {
    console.error("[membership] failed to read Blink Pro status", error);
    return false;
  }
}

export async function getBuilderFeeUnitsForWallet(
  walletAddress: string,
  market?: string,
) {
  const isPro = await isWalletBlinkPro(walletAddress);
  const normalizedMarket = market?.toUpperCase();
  const isZeroFeeGrowthMarket =
    isGrowthModeEnabled() &&
    Boolean(
      normalizedMarket && GROWTH_ZERO_FEE_MARKETS.includes(normalizedMarket),
    );

  return {
    isPro,
    feeUnits: isZeroFeeGrowthMarket
      ? 0
      : isPro
        ? env.BLINK_PRO_BUILDER_FEE_BPS
        : BUILDER_FEE_UNITS,
  };
}
