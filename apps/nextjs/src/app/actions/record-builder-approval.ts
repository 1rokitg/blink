"use server";

import { db } from "@acme/db/client";
import { BuilderApproval } from "@acme/db/schema";

/**
 * Persists a successful builder fee approval to the database.
 * Called from BuilderSetupScreen after approveBuilderFee() resolves.
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
  } catch (err) {
    // Non-critical — don't surface DB errors to the user.
    // The on-chain approval is what matters; this is just tracking.
    console.error("[recordBuilderApproval] DB write failed:", err);
  }
}
