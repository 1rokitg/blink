"use server";

import { eq } from "drizzle-orm";

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
  const wallet = walletAddress.toLowerCase();
  const builder = builderAddress.toLowerCase();

  try {
    const existing = await db
      .select({ id: BuilderApproval.id })
      .from(BuilderApproval)
      .where(eq(BuilderApproval.walletAddress, wallet))
      .limit(1);

    if (existing[0]) {
      await db
        .update(BuilderApproval)
        .set({
          builderAddress: builder,
          maxFeeRate,
          status: "approved",
        })
        .where(eq(BuilderApproval.id, existing[0].id));
    } else {
      await db.insert(BuilderApproval).values({
        walletAddress: wallet,
        builderAddress: builder,
        maxFeeRate,
        status: "approved",
      });
    }
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
