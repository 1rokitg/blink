"use server";

import { count, desc, eq } from "drizzle-orm";

import { db } from "@acme/db/client";
import { BlinkMembership, BuilderApproval, MetricEvent, Referral } from "@acme/db/schema";

import {
  getBuilderAttributionSnapshot,
  getLiveBuilderFillFeed,
  getBuilderMetricsSnapshot,
  syncBuilderDailyMetrics,
} from "~/lib/blink/internal-metrics.server";
import { getFeatureFlags } from "~/lib/blink/feature-flags.server";

export interface AdminStats {
  totalApprovals: number;
  approvalsSince24h: number;
  approvalsSince7d: number;
  totalReferrals: number;
  activeProMembers: number;
  funnel: {
    signups: number;
    approvedBuilder: number;
    firstTrade: number;
    proStarted: number;
  };
  weeklyCohorts: Array<{
    week: string;
    signups: number;
    approvedBuilder: number;
    firstTrade: number;
    proStarted: number;
  }>;
  builder: {
    address: string;
    totalRevenueUsd: number;
    totalVolumeUsd: number;
    totalUsers: number;
    avgRevenuePerUser: number;
    fillsCount: number;
    series: Array<{
      day: string;
      revenue: number;
      volume: number;
      users: number;
      fills: number;
    }>;
    attribution: {
      byUser: Array<{
        walletAddress: string;
        source: string;
        country: string;
        volumeUsd: number;
        revenueUsd: number;
        fillsCount: number;
      }>;
      bySource: Array<{
        source: string;
        volumeUsd: number;
        revenueUsd: number;
        users: number;
        fillsCount: number;
      }>;
      byCountry: Array<{
        country: string;
        volumeUsd: number;
        revenueUsd: number;
        users: number;
        fillsCount: number;
      }>;
    };
    live: {
      windowMinutes: number;
      totals: {
        revenueUsd: number;
        notionalUsd: number;
        fillsCount: number;
      };
      fills: Array<{
        time: number;
        walletAddress: string;
        coin: string;
        side: "buy" | "sell";
        px: number;
        sz: number;
        notionalUsd: number;
        builderFeeUsd: number;
        feeUnits: number;
        tid: string;
      }>;
    };
  };
  recentApprovals: Array<{
    walletAddress: string;
    maxFeeRate: string;
    approvedAt: string;
  }>;
  featureFlags: Array<{
    key: string;
    enabled: boolean;
    description: string;
    updatedBy: string | null;
    updatedAt: Date | null;
  }>;
}

export async function getAdminStats(options?: {
  syncHyperliquid?: boolean;
  includeAttribution?: boolean;
  liveWindowMinutes?: number;
  liveLimit?: number;
}): Promise<AdminStats> {
  // Keep UI on "Today" mode but fetch 2 days so yesterday deltas remain accurate.
  const canonicalWindowDays = 2;

  if (options?.syncHyperliquid) {
    await syncBuilderDailyMetrics(canonicalWindowDays);
  }

  const now = Date.now();
  const ms24h = 24 * 60 * 60 * 1000;
  const ms7d = 7 * ms24h;

  const includeAttribution = options?.includeAttribution ?? true;
  const liveWindowMinutes = options?.liveWindowMinutes ?? 30;
  const liveLimit = options?.liveLimit ?? 120;

  const [totalRows, allApprovals, referralRows, activeProRows, metricRows, builderSnapshot, attribution, liveFeed, featureFlags] = await Promise.all([
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
    db.select({ c: count() }).from(Referral),
    db
      .select({ c: count() })
      .from(BlinkMembership)
      .where(eq(BlinkMembership.status, "active")),
    db
      .select({
        eventType: MetricEvent.eventType,
        createdAt: MetricEvent.createdAt,
      })
      .from(MetricEvent)
      .orderBy(desc(MetricEvent.createdAt))
      .limit(3000),
    getBuilderMetricsSnapshot(canonicalWindowDays),
    includeAttribution
      ? getBuilderAttributionSnapshot(canonicalWindowDays)
      : Promise.resolve({
          byUser: [],
          bySource: [],
          byCountry: [],
        }),
    getLiveBuilderFillFeed({
      minutes: liveWindowMinutes,
      limit: liveLimit,
    }),
    getFeatureFlags(),
  ]);

  const total = totalRows[0]?.c ?? 0;
  const totalReferrals = Number(referralRows[0]?.c ?? 0);
  const activeProMembers = Number(activeProRows[0]?.c ?? 0);

  const approvalsSince24h = allApprovals.filter(
    (a) => new Date(a.approvedAt).getTime() > now - ms24h,
  ).length;

  const approvalsSince7d = allApprovals.filter(
    (a) => new Date(a.approvedAt).getTime() > now - ms7d,
  ).length;

  const funnelEvents = metricRows.filter((row) => {
    const t = new Date(row.createdAt).getTime();
    return t > now - ms7d;
  });
  const funnel = {
    signups: funnelEvents.filter((e) => e.eventType === "signup").length,
    approvedBuilder: funnelEvents.filter((e) => e.eventType === "builder_approved")
      .length,
    firstTrade: funnelEvents.filter((e) => e.eventType === "first_trade").length,
    proStarted: funnelEvents.filter((e) => e.eventType === "pro_started").length,
  };

  const weeklyMap = new Map<
    string,
    {
      signups: number;
      approvedBuilder: number;
      firstTrade: number;
      proStarted: number;
    }
  >();
  const fullEventWindow = metricRows.filter((row) => {
    const t = new Date(row.createdAt).getTime();
    return t > now - 8 * ms7d;
  });
  for (const event of fullEventWindow) {
    const d = new Date(event.createdAt);
    const year = d.getUTCFullYear();
    const start = new Date(Date.UTC(year, 0, 1));
    const diffDays = Math.floor((d.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    const week = `${year}-W${String(Math.floor(diffDays / 7) + 1).padStart(2, "0")}`;
    const current = weeklyMap.get(week) ?? {
      signups: 0,
      approvedBuilder: 0,
      firstTrade: 0,
      proStarted: 0,
    };
    if (event.eventType === "signup") current.signups += 1;
    if (event.eventType === "builder_approved") current.approvedBuilder += 1;
    if (event.eventType === "first_trade") current.firstTrade += 1;
    if (event.eventType === "pro_started") current.proStarted += 1;
    weeklyMap.set(week, current);
  }
  const weeklyCohorts = Array.from(weeklyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, values]) => ({ week, ...values }));

  return {
    totalApprovals: Number(total),
    approvalsSince24h,
    approvalsSince7d,
    totalReferrals,
    activeProMembers,
    funnel,
    weeklyCohorts,
    builder: {
      address: process.env.NEXT_PUBLIC_BUILDER_ADDRESS ?? "",
      totalRevenueUsd: builderSnapshot.totals.builderFeeUsd,
      totalVolumeUsd: builderSnapshot.totals.volumeUsd,
      totalUsers: builderSnapshot.totals.totalUsers,
      avgRevenuePerUser: builderSnapshot.totals.avgRevenuePerUser,
      fillsCount: builderSnapshot.totals.fillsCount,
      series: builderSnapshot.series,
      attribution,
      live: {
        windowMinutes: liveWindowMinutes,
        totals: liveFeed.totals,
        fills: liveFeed.fills,
      },
    },
    recentApprovals: allApprovals.slice(0, 10).map((a) => ({
      walletAddress: a.walletAddress,
      maxFeeRate: a.maxFeeRate,
      approvedAt: new Date(a.approvedAt).toISOString(),
    })),
    featureFlags,
  };
}
