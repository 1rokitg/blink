import { and, desc, eq, gte, isNotNull } from "drizzle-orm";

import { db } from "@acme/db/client";
import { BuilderApproval, MetricEvent, Referral } from "@acme/db/schema";

import {
  BUILDER_ADDRESS,
  builderMaxFeeRate,
  getApprovedBuilderFeeUnits,
} from "./builder";

const BUILDER_ADDRESS_LOWER = BUILDER_ADDRESS.toLowerCase();

export async function syncRecentBuilderApprovalsFromChain(options?: {
  lookbackDays?: number;
  maxWallets?: number;
  extraWallets?: string[];
}) {
  const lookbackDays = Math.max(1, Math.min(options?.lookbackDays ?? 7, 30));
  const maxWallets = Math.max(5, Math.min(options?.maxWallets ?? 50, 120));
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

  const [metricWallets, referralWallets] = await Promise.all([
    db
      .select({ walletAddress: MetricEvent.walletAddress })
      .from(MetricEvent)
      .where(
        and(
          gte(MetricEvent.createdAt, since),
          isNotNull(MetricEvent.walletAddress),
        ),
      )
      .orderBy(desc(MetricEvent.createdAt))
      .limit(400),
    db
      .select({ walletAddress: Referral.referredAddress })
      .from(Referral)
      .where(gte(Referral.createdAt, since))
      .orderBy(desc(Referral.createdAt))
      .limit(200),
  ]);

  const walletSet = new Set<string>();

  for (const row of [...metricWallets, ...referralWallets]) {
    const wallet = row.walletAddress?.toLowerCase();
    if (wallet?.startsWith("0x")) {
      walletSet.add(wallet);
    }
  }

  for (const wallet of options?.extraWallets ?? []) {
    const normalized = wallet.trim().toLowerCase();
    if (/^0x[0-9a-f]{40}$/.test(normalized)) {
      walletSet.add(normalized);
    }
  }

  const wallets = Array.from(walletSet).slice(0, maxWallets);
  if (wallets.length === 0) {
    return { scanned: 0, inserted: 0 };
  }

  const existingRows = await db
    .select({ walletAddress: BuilderApproval.walletAddress })
    .from(BuilderApproval)
    .where(eq(BuilderApproval.builderAddress, BUILDER_ADDRESS_LOWER));

  const existingWallets = new Set(
    existingRows.map((row) => row.walletAddress.toLowerCase()),
  );

  let inserted = 0;
  const maxFeeRate = builderMaxFeeRate();

  for (const walletAddress of wallets) {
    if (existingWallets.has(walletAddress)) {
      continue;
    }

    try {
      const approvedUnits = await getApprovedBuilderFeeUnits(
        walletAddress as `0x${string}`,
      );
      if (approvedUnits <= 0) {
        continue;
      }

      await db.insert(BuilderApproval).values({
        walletAddress,
        builderAddress: BUILDER_ADDRESS_LOWER,
        maxFeeRate,
        status: "approved",
      });

      existingWallets.add(walletAddress);
      inserted += 1;
    } catch (error) {
      console.warn("[sync-builder-approvals] wallet sync failed", {
        walletAddress,
        error,
      });
    }
  }

  return { scanned: wallets.length, inserted };
}
