"use server";

import { count, desc } from "drizzle-orm";

import { db } from "@acme/db/client";
import { BuilderApproval } from "@acme/db/schema";

export interface AdminStats {
  totalApprovals: number;
  approvalsSince24h: number;
  approvalsSince7d: number;
  recentApprovals: Array<{
    walletAddress: string;
    maxFeeRate: string;
    approvedAt: string;
  }>;
}

export async function getAdminStats(): Promise<AdminStats> {
  const now = Date.now();
  const ms24h = 24 * 60 * 60 * 1000;
  const ms7d = 7 * ms24h;

  const [totalRows, allApprovals] = await Promise.all([
    db.select({ c: count() }).from(BuilderApproval),
    db
      .select({
        walletAddress: BuilderApproval.walletAddress,
        maxFeeRate: BuilderApproval.maxFeeRate,
        approvedAt: BuilderApproval.approvedAt,
      })
      .from(BuilderApproval)
      .orderBy(desc(BuilderApproval.approvedAt))
      .limit(50),
  ]);

  const total = totalRows[0]?.c ?? 0;

  const approvalsSince24h = allApprovals.filter(
    (a) => new Date(a.approvedAt).getTime() > now - ms24h,
  ).length;

  const approvalsSince7d = allApprovals.filter(
    (a) => new Date(a.approvedAt).getTime() > now - ms7d,
  ).length;

  return {
    totalApprovals: Number(total),
    approvalsSince24h,
    approvalsSince7d,
    recentApprovals: allApprovals.slice(0, 10).map((a) => ({
      walletAddress: a.walletAddress,
      maxFeeRate: a.maxFeeRate,
      approvedAt: new Date(a.approvedAt).toISOString(),
    })),
  };
}
