"use server";

import { trackMetricEvent } from "~/lib/blink/internal-metrics.server";

/** Step 1 of onboarding — builder fee only (before approveAgent). */
export async function recordBuilderFeeApproved(
  walletAddress: string,
  builderAddress: string,
  maxFeeRate: string,
) {
  try {
    await trackMetricEvent({
      eventType: "builder_fee_approved",
      walletAddress,
      source: "builder-setup",
      metadata: { builderAddress, maxFeeRate },
    });
  } catch (err) {
    console.error("[recordBuilderFeeApproved] failed:", err);
  }
}
