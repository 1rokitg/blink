"use server";

import { db } from "@acme/db/client";
import { BuilderApproval } from "@acme/db/schema";

import { trackMetricEvent } from "~/lib/blink/internal-metrics.server";

/**
 * Legacy path — builder fee row without agent. Prefer recordTradingEnabled
 * after approveAgent({ agentName: "blink-web" }).
 */
export async function recordBuilderApproval(
  walletAddress: string,
  builderAddress: string,
  maxFeeRate: string,
) {
  try {
    await db.insert(BuilderApproval).values({
      walletAddress: walletAddress.toLowerCase(),
      builderAddress: builderAddress.toLowerCase(),
      maxFeeRate,
      status: "approved",
    });
    await trackMetricEvent({
      eventType: "builder_approved",
      walletAddress,
      source: "builder-setup",
      metadata: { builderAddress, maxFeeRate, legacy: true },
    });
  } catch (err) {
    // Non-critical — don't surface DB errors to the user.
    // The on-chain approval is what matters; this is just tracking.
    console.error("[recordBuilderApproval] DB write failed:", err);
  }
}
