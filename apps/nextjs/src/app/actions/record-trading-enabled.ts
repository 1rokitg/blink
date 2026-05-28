"use server";

import { eq } from "drizzle-orm";

import { db } from "@acme/db/client";
import { BuilderApproval } from "@acme/db/schema";

import { BLINK_WEB_AGENT_NAME } from "~/lib/blink/blink-agent";
import { trackMetricEvent } from "~/lib/blink/internal-metrics.server";

/**
 * Persists full Blink activation after approveAgent({ agentName: "blink-web" }).
 * This is the production ground-truth companion to builder fee approval.
 */
export async function recordTradingEnabled(
  walletAddress: string,
  builderAddress: string,
  maxFeeRate: string,
  agentAddress: string,
) {
  const wallet = walletAddress.toLowerCase();
  const builder = builderAddress.toLowerCase();
  const agent = agentAddress.toLowerCase();

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
          agentName: BLINK_WEB_AGENT_NAME,
          agentAddress: agent,
        })
        .where(eq(BuilderApproval.id, existing[0].id));
    } else {
      await db.insert(BuilderApproval).values({
        walletAddress: wallet,
        builderAddress: builder,
        maxFeeRate,
        status: "approved",
        agentName: BLINK_WEB_AGENT_NAME,
        agentAddress: agent,
      });
    }

    await trackMetricEvent({
      eventType: "trading_enabled",
      walletAddress: wallet,
      source: "builder-setup",
      metadata: {
        agentName: BLINK_WEB_AGENT_NAME,
        agentAddress: agent,
        builderAddress: builder,
        maxFeeRate,
      },
    });
  } catch (err) {
    console.error("[recordTradingEnabled] DB write failed:", err);
  }
}
