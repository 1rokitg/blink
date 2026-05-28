"use server";

import { count, desc, eq } from "drizzle-orm";

import { db } from "@acme/db/client";
import {
  BlinkMembership,
  BuilderApproval,
  MetricEvent,
  Referral,
} from "@acme/db/schema";

import { LIVE_ACTIVITY_EVENT_TYPES } from "~/lib/blink/activity-alerts.server";
import { getFeatureFlags } from "~/lib/blink/feature-flags.server";
import {
  getGrowthMetrics,
  type GrowthMetrics,
} from "~/lib/blink/growth-metrics.server";
import {
  getBuilderAttributionSnapshot,
  getBuilderMetricsSnapshot,
  getLiveBuilderFillFeed,
  gethyperliquidBuilderMetricsSnapshot,
  gethyperliquidLiveBuilderFillFeed,
  syncBuilderDailyMetrics,
} from "~/lib/blink/internal-metrics.server";
import { syncRecentBuilderApprovalsFromChain } from "~/lib/blink/sync-builder-approvals.server";

type KpiSource = "hyperliquid" | "offchain";

export interface AdminStats {
  windowDays: number;
  syncedAt: string;
  kpiSource: Record<string, KpiSource>;
  hyperliquidSync: {
    lastSyncedAt: string;
    window: "today" | "7d" | "30d" | "90d";
    freshness: "fresh" | "stale" | "unknown";
  };
  internalAnalytics: {
    uniqueVisitors24h: number;
    uniqueVisitors7d: number;
    botEvents24h: number;
    humanEvents24h: number;
    topSources7d: Array<{
      source: string;
      events: number;
      uniqueVisitors: number;
    }>;
    topCountries7d: Array<{
      country: string;
      events: number;
      uniqueVisitors: number;
    }>;
  };
  liveActivity: Array<{
    eventType: "signup" | "builder_approved" | "trading_enabled" | "first_trade";
    createdAt: string;
    walletAddress: string;
    source: string;
    country: string | null;
    market: string | null;
    detail: string;
  }>;
  issues: {
    total24h: number;
    auto24h: number;
    feedback24h: number;
    recent: Array<{
      eventType: "issue_auto" | "issue_feedback";
      source: string;
      createdAt: string;
      walletAddress: string | null;
      requestId: string | null;
      category: string;
      summary: string;
      description: string | null;
      code: string | null;
      path: string | null;
      country: string | null;
    }>;
  };
  today: {
    revenueUsd: number;
    volumeUsd: number;
    activeUsers: number;
    fillsCount: number;
    yesterdayRevenueUsd: number;
    yesterdayVolumeUsd: number;
  };
  totalApprovals: number;
  approvalsSince24h: number;
  approvalsSince7d: number;
  totalReferrals: number;
  activeProMembers: number;
  finance: {
    hyperliquid: {
      totalRevenueUsd: number;
      totalVolumeUsd: number;
      totalUsers: number;
      avgRevenuePerUser: number;
      fillsCount: number;
    };
    offchain: {
      totalRevenueUsd: number;
      totalVolumeUsd: number;
      totalUsers: number;
      avgRevenuePerUser: number;
      fillsCount: number;
    };
    reconciliation: {
      revenue: { hyperliquid: number; offchain: number; delta: number };
      volume: { hyperliquid: number; offchain: number; delta: number };
      fills: { hyperliquid: number; offchain: number; delta: number };
      users: { hyperliquid: number; offchain: number; delta: number };
      status: "ok" | "warning" | "critical";
    };
  };
  funnel: {
    signups: number;
    approvedBuilder: number;
    tradingEnabled: number;
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
  growth: GrowthMetrics;
}

export async function getAdminStats(options?: {
  syncHyperliquid?: boolean;
  includeAttribution?: boolean;
  liveWindowMinutes?: number;
  liveLimit?: number;
  windowDays?: 1 | 7 | 30 | 90;
}): Promise<AdminStats> {
  // Keep UI on "Today" mode but fetch 2 days so yesterday deltas remain accurate.
  const canonicalWindowDays = 2;

  if (options?.syncHyperliquid) {
    await Promise.all([
      syncBuilderDailyMetrics(canonicalWindowDays),
      syncRecentBuilderApprovalsFromChain({ lookbackDays: 7, maxWallets: 80 }),
    ]);
  }

  const now = Date.now();
  const ms24h = 24 * 60 * 60 * 1000;
  const ms7d = 7 * ms24h;

  const includeAttribution = options?.includeAttribution ?? true;
  const liveWindowMinutes = options?.liveWindowMinutes ?? 30;
  const liveLimit = options?.liveLimit ?? 120;
  const windowDays = options?.windowDays ?? 90;
  const windowLabel =
    windowDays === 1
      ? "today"
      : windowDays === 7
        ? "7d"
        : windowDays === 30
          ? "30d"
          : "90d";

  const [
    totalRows,
    allApprovals,
    referralRows,
    activeProRows,
    metricRows,
    builderSnapshot,
    hyperliquidSnapshot,
    attribution,
    liveFeed,
    hyperliquidLiveFeed,
    featureFlags,
    growth,
  ] = await Promise.all([
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
        walletAddress: MetricEvent.walletAddress,
        source: MetricEvent.source,
        visitorId: MetricEvent.visitorId,
        requestId: MetricEvent.requestId,
        isBot: MetricEvent.isBot,
        metadata: MetricEvent.metadata,
        createdAt: MetricEvent.createdAt,
      })
      .from(MetricEvent)
      .orderBy(desc(MetricEvent.createdAt))
      .limit(3000),
    getBuilderMetricsSnapshot(windowDays),
    gethyperliquidBuilderMetricsSnapshot(windowDays),
    includeAttribution
      ? getBuilderAttributionSnapshot(windowDays)
      : Promise.resolve({
          byUser: [],
          bySource: [],
          byCountry: [],
        }),
    getLiveBuilderFillFeed({
      minutes: liveWindowMinutes,
      limit: liveLimit,
    }),
    gethyperliquidLiveBuilderFillFeed({
      minutes: liveWindowMinutes,
      limit: liveLimit,
    }),
    getFeatureFlags(),
    getGrowthMetrics(windowDays),
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
    approvedBuilder: funnelEvents.filter(
      (e) =>
        e.eventType === "builder_approved" ||
        e.eventType === "builder_fee_approved",
    ).length,
    tradingEnabled: funnelEvents.filter(
      (e) => e.eventType === "trading_enabled",
    ).length,
    firstTrade: funnelEvents.filter((e) => e.eventType === "first_trade")
      .length,
    proStarted: funnelEvents.filter((e) => e.eventType === "pro_started")
      .length,
  };

  const event24h = metricRows.filter(
    (row) => new Date(row.createdAt).getTime() > now - ms24h,
  );
  const event7d = metricRows.filter(
    (row) => new Date(row.createdAt).getTime() > now - ms7d,
  );
  const uniqueVisitors24h = new Set(
    event24h
      .map((row) => row.visitorId)
      .filter((value): value is string => Boolean(value)),
  ).size;
  const uniqueVisitors7d = new Set(
    event7d
      .map((row) => row.visitorId)
      .filter((value): value is string => Boolean(value)),
  ).size;
  const botEvents24h = event24h.filter((row) => Boolean(row.isBot)).length;
  const humanEvents24h = event24h.length - botEvents24h;
  const issueRows = metricRows.filter(
    (row) =>
      row.eventType === "issue_auto" || row.eventType === "issue_feedback",
  );
  const issueRows24h = issueRows.filter(
    (row) => new Date(row.createdAt).getTime() > now - ms24h,
  );
  const liveActivity = metricRows
    .filter(
      (row) =>
        LIVE_ACTIVITY_EVENT_TYPES.includes(
          row.eventType as (typeof LIVE_ACTIVITY_EVENT_TYPES)[number],
        ) && Boolean(row.walletAddress),
    )
    .slice(0, 40)
    .map((row) => {
      const metadata = (row.metadata ?? {}) as Record<string, unknown>;
      const country =
        typeof metadata.country === "string" ? metadata.country : null;
      const market =
        typeof metadata.market === "string"
          ? metadata.market
          : typeof metadata.firstMarket === "string"
            ? metadata.firstMarket
            : null;
      const maxFeeRate =
        typeof metadata.maxFeeRate === "string" ? metadata.maxFeeRate : null;
      const side = typeof metadata.side === "string" ? metadata.side : null;
      const orderType =
        typeof metadata.orderType === "string" ? metadata.orderType : null;

      let detail = String(row.source ?? "app");
      const agentName =
        typeof metadata.agentName === "string" ? metadata.agentName : null;
      if (row.eventType === "trading_enabled" && agentName) {
        detail = `Agent ${agentName} · trading live`;
      } else if (row.eventType === "builder_approved" && maxFeeRate) {
        detail = `Approved ${maxFeeRate}`;
      } else if (row.eventType === "first_trade" && market) {
        detail = `${market}${side ? ` · ${side}` : ""}${orderType ? ` · ${orderType}` : ""}`;
      } else if (country) {
        detail = `${country} · ${detail}`;
      }

      return {
        eventType: row.eventType as
          | "signup"
          | "builder_approved"
          | "trading_enabled"
          | "first_trade",
        createdAt: new Date(row.createdAt).toISOString(),
        walletAddress: row.walletAddress ?? "",
        source: String(row.source ?? "app"),
        country,
        market,
        detail,
      };
    });

  const recentIssues = issueRows.slice(0, 12).map((row) => {
    const metadata = (row.metadata ?? {}) as Record<string, unknown>;

    return {
      eventType: row.eventType as "issue_auto" | "issue_feedback",
      source: String(row.source ?? "unknown"),
      createdAt: new Date(row.createdAt).toISOString(),
      walletAddress: row.walletAddress ?? null,
      requestId: row.requestId ?? null,
      category: String(metadata.category ?? "general"),
      summary: String(metadata.summary ?? row.eventType),
      description:
        typeof metadata.description === "string" ? metadata.description : null,
      code: typeof metadata.code === "string" ? metadata.code : null,
      path: typeof metadata.path === "string" ? metadata.path : null,
      country: typeof metadata.country === "string" ? metadata.country : null,
    };
  });

  const sourceMap = new Map<
    string,
    { events: number; visitors: Set<string> }
  >();
  const countryMap = new Map<
    string,
    { events: number; visitors: Set<string> }
  >();
  for (const row of event7d) {
    const source = String(row.source ?? "unknown").toLowerCase();
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    const country = String(meta.country ?? "unknown").toUpperCase();
    const sourceItem = sourceMap.get(source) ?? {
      events: 0,
      visitors: new Set<string>(),
    };
    sourceItem.events += 1;
    if (row.visitorId) sourceItem.visitors.add(row.visitorId);
    sourceMap.set(source, sourceItem);

    const countryItem = countryMap.get(country) ?? {
      events: 0,
      visitors: new Set<string>(),
    };
    countryItem.events += 1;
    if (row.visitorId) countryItem.visitors.add(row.visitorId);
    countryMap.set(country, countryItem);
  }

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
    const diffDays = Math.floor(
      (d.getTime() - start.getTime()) / (24 * 60 * 60 * 1000),
    );
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

  const todayKey = new Date().toISOString().slice(0, 10);
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayKey = yesterday.toISOString().slice(0, 10);
  const todayRow =
    hyperliquidSnapshot.series.find((row) => row.day === todayKey) ??
    builderSnapshot.series.find((row) => row.day === todayKey);
  const yesterdayRow =
    hyperliquidSnapshot.series.find((row) => row.day === yesterdayKey) ??
    builderSnapshot.series.find((row) => row.day === yesterdayKey);

  const revDelta =
    hyperliquidSnapshot.totals.builderFeeUsd -
    builderSnapshot.totals.builderFeeUsd;
  const volDelta =
    hyperliquidSnapshot.totals.volumeUsd - builderSnapshot.totals.volumeUsd;
  const fillsDelta =
    hyperliquidSnapshot.totals.fillsCount - builderSnapshot.totals.fillsCount;
  const usersDelta =
    hyperliquidSnapshot.totals.totalUsers - builderSnapshot.totals.totalUsers;

  const revenueDeltaRatio =
    hyperliquidSnapshot.totals.builderFeeUsd > 0
      ? Math.abs(revDelta) / hyperliquidSnapshot.totals.builderFeeUsd
      : 0;
  const volumeDeltaRatio =
    hyperliquidSnapshot.totals.volumeUsd > 0
      ? Math.abs(volDelta) / hyperliquidSnapshot.totals.volumeUsd
      : 0;
  const maxDrift = Math.max(revenueDeltaRatio, volumeDeltaRatio);
  const reconciliationStatus: "ok" | "warning" | "critical" =
    maxDrift >= 0.2 ? "critical" : maxDrift >= 0.05 ? "warning" : "ok";

  return {
    windowDays,
    syncedAt: new Date().toISOString(),
    kpiSource: {
      builderRevenue: "hyperliquid",
      routedVolume: "hyperliquid",
      fills: "hyperliquid",
      activeUsers: "hyperliquid",
      avgRevenuePerUser: "hyperliquid",
      signups: "offchain",
      builderApprovals: "offchain",
      tradingEnabled: "offchain",
      firstTrade: "offchain",
      proStarted: "offchain",
      referrals: "offchain",
    },
    hyperliquidSync: {
      lastSyncedAt: hyperliquidSnapshot.lastSyncedAt,
      window: windowLabel,
      freshness: hyperliquidSnapshot.freshness,
    },
    internalAnalytics: {
      uniqueVisitors24h,
      uniqueVisitors7d,
      botEvents24h,
      humanEvents24h,
      topSources7d: Array.from(sourceMap.entries())
        .map(([source, value]) => ({
          source,
          events: value.events,
          uniqueVisitors: value.visitors.size,
        }))
        .sort((a, b) => b.events - a.events)
        .slice(0, 8),
      topCountries7d: Array.from(countryMap.entries())
        .map(([country, value]) => ({
          country,
          events: value.events,
          uniqueVisitors: value.visitors.size,
        }))
        .sort((a, b) => b.events - a.events)
        .slice(0, 8),
    },
    liveActivity,
    issues: {
      total24h: issueRows24h.length,
      auto24h: issueRows24h.filter((row) => row.eventType === "issue_auto")
        .length,
      feedback24h: issueRows24h.filter(
        (row) => row.eventType === "issue_feedback",
      ).length,
      recent: recentIssues,
    },
    today: {
      revenueUsd: todayRow?.revenue ?? 0,
      volumeUsd: todayRow?.volume ?? 0,
      activeUsers: todayRow?.users ?? 0,
      fillsCount:
        hyperliquidLiveFeed.totals.fillsCount > 0
          ? hyperliquidLiveFeed.totals.fillsCount
          : liveFeed.totals.fillsCount,
      yesterdayRevenueUsd: yesterdayRow?.revenue ?? 0,
      yesterdayVolumeUsd: yesterdayRow?.volume ?? 0,
    },
    totalApprovals: Number(total),
    approvalsSince24h,
    approvalsSince7d,
    totalReferrals,
    activeProMembers,
    finance: {
      hyperliquid: {
        totalRevenueUsd: hyperliquidSnapshot.totals.builderFeeUsd,
        totalVolumeUsd: hyperliquidSnapshot.totals.volumeUsd,
        totalUsers: hyperliquidSnapshot.totals.totalUsers,
        avgRevenuePerUser: hyperliquidSnapshot.totals.avgRevenuePerUser,
        fillsCount: hyperliquidSnapshot.totals.fillsCount,
      },
      offchain: {
        totalRevenueUsd: builderSnapshot.totals.builderFeeUsd,
        totalVolumeUsd: builderSnapshot.totals.volumeUsd,
        totalUsers: builderSnapshot.totals.totalUsers,
        avgRevenuePerUser: builderSnapshot.totals.avgRevenuePerUser,
        fillsCount: builderSnapshot.totals.fillsCount,
      },
      reconciliation: {
        revenue: {
          hyperliquid: hyperliquidSnapshot.totals.builderFeeUsd,
          offchain: builderSnapshot.totals.builderFeeUsd,
          delta: revDelta,
        },
        volume: {
          hyperliquid: hyperliquidSnapshot.totals.volumeUsd,
          offchain: builderSnapshot.totals.volumeUsd,
          delta: volDelta,
        },
        fills: {
          hyperliquid: hyperliquidSnapshot.totals.fillsCount,
          offchain: builderSnapshot.totals.fillsCount,
          delta: fillsDelta,
        },
        users: {
          hyperliquid: hyperliquidSnapshot.totals.totalUsers,
          offchain: builderSnapshot.totals.totalUsers,
          delta: usersDelta,
        },
        status: reconciliationStatus,
      },
    },
    funnel,
    weeklyCohorts,
    builder: {
      address: process.env.NEXT_PUBLIC_BUILDER_ADDRESS ?? "",
      totalRevenueUsd: hyperliquidSnapshot.totals.builderFeeUsd,
      totalVolumeUsd: hyperliquidSnapshot.totals.volumeUsd,
      totalUsers: hyperliquidSnapshot.totals.totalUsers,
      avgRevenuePerUser: hyperliquidSnapshot.totals.avgRevenuePerUser,
      fillsCount: hyperliquidSnapshot.totals.fillsCount,
      series: hyperliquidSnapshot.series.map((row) => ({
        ...row,
        fills: 0,
      })),
      attribution,
      live: {
        windowMinutes: liveWindowMinutes,
        totals:
          hyperliquidLiveFeed.totals.fillsCount > 0
            ? hyperliquidLiveFeed.totals
            : liveFeed.totals,
        fills:
          hyperliquidLiveFeed.fills.length > 0
            ? hyperliquidLiveFeed.fills
            : liveFeed.fills,
      },
    },
    recentApprovals: allApprovals.slice(0, 10).map((a) => ({
      walletAddress: a.walletAddress,
      maxFeeRate: a.maxFeeRate,
      approvedAt: new Date(a.approvedAt).toISOString(),
    })),
    featureFlags,
    growth,
  };
}
