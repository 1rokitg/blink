import { and, eq, inArray } from "drizzle-orm";

import { db } from "@acme/db/client";
import { BuilderApproval, MetricEvent } from "@acme/db/schema";

import { BLINK_WEB_AGENT_NAME } from "./blink-agent";

/**
 * Wallets with full Blink activation (builder fee + blink-web agent).
 * Falls back when builder_approval.agent_name is not migrated yet.
 */
export async function fetchBlinkActivatedWalletSet(
  walletAddresses: string[],
): Promise<Set<string>> {
  if (walletAddresses.length === 0) return new Set();

  const normalized = walletAddresses.map((wallet) => wallet.toLowerCase());
  const activated = new Set<string>();

  try {
    const rows = await db
      .select({ walletAddress: BuilderApproval.walletAddress })
      .from(BuilderApproval)
      .where(
        and(
          inArray(BuilderApproval.walletAddress, normalized),
          eq(BuilderApproval.agentName, BLINK_WEB_AGENT_NAME),
        ),
      );

    for (const row of rows) {
      activated.add(row.walletAddress.toLowerCase());
    }
    return activated;
  } catch (error) {
    console.warn(
      "[builder-approval] agent_name column unavailable; using legacy activation query",
      error,
    );
  }

  const [approvalRows, tradingEnabledRows] = await Promise.all([
    db
      .select({ walletAddress: BuilderApproval.walletAddress })
      .from(BuilderApproval)
      .where(inArray(BuilderApproval.walletAddress, normalized)),
    db
      .select({ walletAddress: MetricEvent.walletAddress })
      .from(MetricEvent)
      .where(
        and(
          inArray(MetricEvent.walletAddress, normalized),
          eq(MetricEvent.eventType, "trading_enabled"),
        ),
      ),
  ]);

  for (const row of approvalRows) {
    activated.add(row.walletAddress.toLowerCase());
  }
  for (const row of tradingEnabledRows) {
    if (row.walletAddress) {
      activated.add(row.walletAddress.toLowerCase());
    }
  }

  return activated;
}
