import { and, count, desc, eq, gte, sql } from "drizzle-orm";

import { db } from "@acme/db/client";
import {
  BlinkMembership,
  BuilderApproval,
  BuilderDailyMetric,
  MetricEvent,
} from "@acme/db/schema";

import { env } from "~/env";

import {
  isLiveActivityEventType,
  notifyLiveActivityAlert,
} from "./activity-alerts.server";
import { BLINK_WEB_AGENT_NAME } from "./blink-agent";
import { BUILDER_FEE_UNITS } from "./builder";
import { GROWTH_ZERO_FEE_MARKETS, isGrowthModeEnabled } from "./growth-mode";
import { infoClient } from "./hyperliquid";

type TrackMetricEventInput = {
  eventType: string;
  walletAddress?: string | null;
  visitorId?: string | null;
  sessionId?: string | null;
  source?: string;
  requestId?: string | null;
  isBot?: boolean;
  botId?: string | null;
  metadata?: Record<string, unknown>;
};

type BuilderFillRow = {
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
};

type SyncFreshness = "fresh" | "stale" | "unknown";

function toDayKey(date: Date) {
  const y = date.getUTCFullYear();
  const m = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const d = `${date.getUTCDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function numberOrZero(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function estimateBuilderFeeUsd(
  params: {
    coin: string;
    notionalUsd: number;
    walletAddress: string;
    explicitBuilderFeeUsd?: number;
  },
  proSet: Set<string>,
) {
  const explicit = numberOrZero(params.explicitBuilderFeeUsd);
  if (explicit > 0) {
    return {
      builderFeeUsd: explicit,
      feeUnits:
        params.notionalUsd > 0
          ? Math.round((explicit / params.notionalUsd) * 1e6)
          : 0,
    };
  }

  const isZeroFeeGrowthMarket =
    isGrowthModeEnabled() && GROWTH_ZERO_FEE_MARKETS.includes(params.coin);
  const feeUnits = isZeroFeeGrowthMarket
    ? 0
    : proSet.has(params.walletAddress.toLowerCase())
      ? env.BLINK_PRO_BUILDER_FEE_BPS
      : BUILDER_FEE_UNITS;
  return {
    builderFeeUsd: params.notionalUsd * feeUnits * 1e-6,
    feeUnits,
  };
}

function getStrictBuilderFeeUsd(fill: Record<string, unknown>) {
  const explicitBuilderFeeUsd = numberOrZero(
    (fill as { builderFee?: unknown }).builderFee,
  );
  if (explicitBuilderFeeUsd <= 0) {
    return null;
  }
  return explicitBuilderFeeUsd;
}

/** Builder-approved wallets with blink-web agent (full Blink activation). */
async function getApprovedWallets() {
  const approvalRows = await db
    .select({ walletAddress: BuilderApproval.walletAddress })
    .from(BuilderApproval)
    .where(eq(BuilderApproval.agentName, BLINK_WEB_AGENT_NAME));
  return Array.from(
    new Set(
      approvalRows
        .map((row) => row.walletAddress?.toLowerCase())
        .filter(Boolean),
    ),
  );
}

export async function getTradingEnabledWallets() {
  return getApprovedWallets();
}

async function getActiveProSet() {
  const activeProRows = await db
    .select({
      walletAddress: BlinkMembership.walletAddress,
    })
    .from(BlinkMembership)
    .where(
      and(
        eq(BlinkMembership.status, "active"),
        gte(BlinkMembership.currentPeriodEnd, new Date()),
      ),
    );
  return new Set(activeProRows.map((row) => row.walletAddress.toLowerCase()));
}

async function countWalletMetricEvents(
  eventType: string,
  walletAddress: string,
) {
  const rows = await db
    .select({ c: count() })
    .from(MetricEvent)
    .where(
      and(
        eq(MetricEvent.eventType, eventType),
        eq(MetricEvent.walletAddress, walletAddress.toLowerCase()),
      ),
    );
  return Number(rows[0]?.c ?? 0);
}

export async function trackMetricEvent(input: TrackMetricEventInput) {
  const walletAddress = input.walletAddress?.toLowerCase() ?? null;
  const shouldNotify =
    walletAddress && !input.isBot && isLiveActivityEventType(input.eventType);

  let isFirstForWallet = false;

  try {
    if (shouldNotify) {
      const priorCount = await countWalletMetricEvents(
        input.eventType,
        walletAddress,
      );
      isFirstForWallet = priorCount === 0;
    }

    await db.insert(MetricEvent).values({
      eventType: input.eventType,
      walletAddress,
      visitorId: input.visitorId ?? null,
      sessionId: input.sessionId ?? null,
      source: input.source ?? "app",
      requestId: input.requestId ?? null,
      isBot: input.isBot ?? false,
      botId: input.botId ?? null,
      metadata: input.metadata ?? {},
    });

    if (shouldNotify && isFirstForWallet) {
      void notifyLiveActivityAlert({
        eventType: input.eventType,
        walletAddress,
        source: input.source ?? null,
        metadata: input.metadata,
      });
    }
  } catch (error) {
    console.error("[metrics] trackMetricEvent failed", error);
  }
}

export async function syncBuilderDailyMetrics(days = 90) {
  const now = Date.now();
  const startTime = now - days * 24 * 60 * 60 * 1000;

  const approvedWallets = await getApprovedWallets();

  if (approvedWallets.length === 0) {
    return { syncedDays: 0, wallets: 0 };
  }

  const proSet = await getActiveProSet();

  const dayMap = new Map<
    string,
    {
      activeUsers: Set<string>;
      fillsCount: number;
      volumeUsd: number;
      feeUsd: number;
      builderFeeUsd: number;
    }
  >();

  for (const wallet of approvedWallets) {
    let fills: Array<Record<string, unknown>> = [];
    try {
      fills = (await infoClient.userFillsByTime({
        user: wallet as `0x${string}`,
        startTime,
      })) as unknown as Array<Record<string, unknown>>;
    } catch (error) {
      console.warn("[metrics] userFillsByTime failed", { wallet, error });
      continue;
    }

    for (const fill of fills) {
      const coin = String(fill.coin ?? "").toUpperCase();
      const time = numberOrZero(fill.time);
      if (!time) continue;
      const day = toDayKey(new Date(time));
      const px = numberOrZero(fill.px);
      const sz = Math.abs(numberOrZero(fill.sz));
      const volume = px * sz;
      if (!Number.isFinite(volume) || volume <= 0) continue;

      const feeUsd = Math.abs(numberOrZero(fill.fee));
      const { builderFeeUsd } = estimateBuilderFeeUsd(
        {
          coin,
          notionalUsd: volume,
          walletAddress: wallet,
          explicitBuilderFeeUsd: numberOrZero(
            (fill as { builderFee?: unknown }).builderFee,
          ),
        },
        proSet,
      );

      const current = dayMap.get(day) ?? {
        activeUsers: new Set<string>(),
        fillsCount: 0,
        volumeUsd: 0,
        feeUsd: 0,
        builderFeeUsd: 0,
      };
      current.activeUsers.add(wallet.toLowerCase());
      current.fillsCount += 1;
      current.volumeUsd += volume;
      current.feeUsd += feeUsd;
      current.builderFeeUsd += builderFeeUsd;
      dayMap.set(day, current);
    }
  }

  const entries = Array.from(dayMap.entries()).map(([day, v]) => ({
    day,
    activeUsers: v.activeUsers.size,
    fillsCount: v.fillsCount,
    volumeUsd: v.volumeUsd,
    feeUsd: v.feeUsd,
    builderFeeUsd: v.builderFeeUsd,
  }));

  for (const row of entries) {
    await db
      .insert(BuilderDailyMetric)
      .values(row)
      .onConflictDoUpdate({
        target: BuilderDailyMetric.day,
        set: {
          activeUsers: row.activeUsers,
          fillsCount: row.fillsCount,
          volumeUsd: row.volumeUsd,
          feeUsd: row.feeUsd,
          builderFeeUsd: row.builderFeeUsd,
          updatedAt: new Date(),
        },
      });
  }

  return { syncedDays: entries.length, wallets: approvedWallets.length };
}

export async function getBuilderMetricsSnapshot(days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await db
    .select()
    .from(BuilderDailyMetric)
    .where(gte(BuilderDailyMetric.day, toDayKey(since)))
    .orderBy(BuilderDailyMetric.day);

  const totals = rows.reduce(
    (acc, row) => {
      acc.volumeUsd += numberOrZero(row.volumeUsd);
      acc.builderFeeUsd += numberOrZero(row.builderFeeUsd);
      acc.feeUsd += numberOrZero(row.feeUsd);
      acc.fillsCount += Number(row.fillsCount ?? 0);
      acc.activeUsers += Number(row.activeUsers ?? 0);
      return acc;
    },
    {
      volumeUsd: 0,
      builderFeeUsd: 0,
      feeUsd: 0,
      fillsCount: 0,
      activeUsers: 0,
    },
  );

  const uniqueUsersQuery = await db.execute(sql`
    select count(distinct wallet_address) as c
    from builder_approval
  `);
  const totalUsers = Number(
    (uniqueUsersQuery as { rows?: Array<{ c?: unknown }> }).rows?.[0]?.c ?? 0,
  );

  return {
    totals: {
      ...totals,
      totalUsers,
      avgRevenuePerUser: totalUsers > 0 ? totals.builderFeeUsd / totalUsers : 0,
    },
    series: rows.map((r) => ({
      day: r.day,
      revenue: numberOrZero(r.builderFeeUsd),
      volume: numberOrZero(r.volumeUsd),
      users: Number(r.activeUsers ?? 0),
      fills: Number(r.fillsCount ?? 0),
    })),
  };
}

export async function gethyperliquidBuilderMetricsSnapshot(days = 30) {
  const syncStartedAt = Date.now();
  const startTime = syncStartedAt - days * 24 * 60 * 60 * 1000;
  const approvedWallets = await getApprovedWallets();
  if (approvedWallets.length === 0) {
    return {
      totals: {
        volumeUsd: 0,
        builderFeeUsd: 0,
        fillsCount: 0,
        totalUsers: 0,
        avgRevenuePerUser: 0,
      },
      series: [] as Array<{
        day: string;
        revenue: number;
        volume: number;
        users: number;
      }>,
      lastSyncedAt: new Date().toISOString(),
      freshness: "unknown" as SyncFreshness,
    };
  }

  const byDay = new Map<
    string,
    { revenue: number; volume: number; fillsCount: number; users: Set<string> }
  >();
  const includedUsers = new Set<string>();
  let latestObservedFillTime = 0;

  for (const wallet of approvedWallets) {
    let fills: Array<Record<string, unknown>> = [];
    try {
      fills = (await infoClient.userFillsByTime({
        user: wallet as `0x${string}`,
        startTime,
      })) as unknown as Array<Record<string, unknown>>;
    } catch (error) {
      console.warn("[metrics] hyperliquid userFillsByTime failed", {
        wallet,
        error,
      });
      continue;
    }

    for (const fill of fills) {
      const fillTime = numberOrZero(fill.time);
      if (fillTime > latestObservedFillTime) {
        latestObservedFillTime = fillTime;
      }

      const strictBuilderFeeUsd = getStrictBuilderFeeUsd(fill);
      if (strictBuilderFeeUsd === null) {
        continue;
      }

      const px = numberOrZero(fill.px);
      const sz = Math.abs(numberOrZero(fill.sz));
      const volumeUsd = px * sz;
      if (!Number.isFinite(volumeUsd) || volumeUsd <= 0) {
        continue;
      }
      const time = fillTime;
      if (!time) {
        continue;
      }
      const day = toDayKey(new Date(time));
      const current = byDay.get(day) ?? {
        revenue: 0,
        volume: 0,
        fillsCount: 0,
        users: new Set<string>(),
      };
      current.revenue += strictBuilderFeeUsd;
      current.volume += volumeUsd;
      current.fillsCount += 1;
      current.users.add(wallet);
      byDay.set(day, current);
      includedUsers.add(wallet);
    }
  }

  const series = Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, value]) => ({
      day,
      revenue: value.revenue,
      volume: value.volume,
      users: value.users.size,
    }));

  const totals = series.reduce(
    (acc, row) => {
      acc.volumeUsd += row.volume;
      acc.builderFeeUsd += row.revenue;
      acc.fillsCount += byDay.get(row.day)?.fillsCount ?? 0;
      return acc;
    },
    {
      volumeUsd: 0,
      builderFeeUsd: 0,
      fillsCount: 0,
    },
  );

  const uniqueUsers = includedUsers.size;
  // Freshness should reflect recency of observed L1 fill data, not wall-clock "now".
  const hasObservedData = latestObservedFillTime > 0;
  const lastSyncedAtMs = hasObservedData
    ? latestObservedFillTime
    : syncStartedAt;
  const lastSyncedAt = new Date(lastSyncedAtMs).toISOString();
  const freshness: SyncFreshness = !hasObservedData
    ? "unknown"
    : syncStartedAt - lastSyncedAtMs < 10 * 60 * 1000
      ? "fresh"
      : "stale";

  return {
    totals: {
      ...totals,
      totalUsers: uniqueUsers,
      avgRevenuePerUser:
        uniqueUsers > 0 ? totals.builderFeeUsd / uniqueUsers : 0,
    },
    series,
    lastSyncedAt,
    freshness,
  };
}

export async function getBuilderAttributionSnapshot(days = 90) {
  const now = Date.now();
  const startTime = now - days * 24 * 60 * 60 * 1000;

  const [approvedWallets, signupRows, proSet] = await Promise.all([
    getApprovedWallets(),
    db
      .select({
        walletAddress: MetricEvent.walletAddress,
        source: MetricEvent.source,
        metadata: MetricEvent.metadata,
        createdAt: MetricEvent.createdAt,
      })
      .from(MetricEvent)
      .where(eq(MetricEvent.eventType, "signup"))
      .orderBy(desc(MetricEvent.createdAt)),
    getActiveProSet(),
  ]);
  const signupMap = new Map<
    string,
    {
      source: string;
      country: string;
    }
  >();

  for (const row of signupRows) {
    const wallet = row.walletAddress?.toLowerCase();
    if (!wallet || signupMap.has(wallet)) continue;
    const metadata = (row.metadata ?? {}) as Record<string, unknown>;
    const source = String(
      row.source ?? metadata.source ?? "unknown",
    ).toLowerCase();
    const country = String(metadata.country ?? "unknown").toUpperCase();
    signupMap.set(wallet, { source, country });
  }

  const byUser = new Map<
    string,
    {
      walletAddress: string;
      source: string;
      country: string;
      volumeUsd: number;
      revenueUsd: number;
      fillsCount: number;
    }
  >();
  const bySource = new Map<
    string,
    {
      source: string;
      volumeUsd: number;
      revenueUsd: number;
      users: Set<string>;
      fillsCount: number;
    }
  >();
  const byCountry = new Map<
    string,
    {
      country: string;
      volumeUsd: number;
      revenueUsd: number;
      users: Set<string>;
      fillsCount: number;
    }
  >();

  for (const wallet of approvedWallets) {
    let fills: Array<Record<string, unknown>> = [];
    try {
      fills = (await infoClient.userFillsByTime({
        user: wallet as `0x${string}`,
        startTime,
      })) as unknown as Array<Record<string, unknown>>;
    } catch (error) {
      console.warn("[metrics] attribution userFillsByTime failed", {
        wallet,
        error,
      });
      continue;
    }

    const acquisition = signupMap.get(wallet) ?? {
      source: "unknown",
      country: "UNKNOWN",
    };

    for (const fill of fills) {
      const coin = String(fill.coin ?? "").toUpperCase();
      const px = numberOrZero(fill.px);
      const sz = Math.abs(numberOrZero(fill.sz));
      const volume = px * sz;
      if (!Number.isFinite(volume) || volume <= 0) continue;

      const { builderFeeUsd } = estimateBuilderFeeUsd(
        {
          coin,
          notionalUsd: volume,
          walletAddress: wallet,
          explicitBuilderFeeUsd: numberOrZero(
            (fill as { builderFee?: unknown }).builderFee,
          ),
        },
        proSet,
      );

      const currentUser = byUser.get(wallet) ?? {
        walletAddress: wallet,
        source: acquisition.source,
        country: acquisition.country,
        volumeUsd: 0,
        revenueUsd: 0,
        fillsCount: 0,
      };
      currentUser.volumeUsd += volume;
      currentUser.revenueUsd += builderFeeUsd;
      currentUser.fillsCount += 1;
      byUser.set(wallet, currentUser);

      const currentSource = bySource.get(acquisition.source) ?? {
        source: acquisition.source,
        volumeUsd: 0,
        revenueUsd: 0,
        users: new Set<string>(),
        fillsCount: 0,
      };
      currentSource.volumeUsd += volume;
      currentSource.revenueUsd += builderFeeUsd;
      currentSource.fillsCount += 1;
      currentSource.users.add(wallet);
      bySource.set(acquisition.source, currentSource);

      const currentCountry = byCountry.get(acquisition.country) ?? {
        country: acquisition.country,
        volumeUsd: 0,
        revenueUsd: 0,
        users: new Set<string>(),
        fillsCount: 0,
      };
      currentCountry.volumeUsd += volume;
      currentCountry.revenueUsd += builderFeeUsd;
      currentCountry.fillsCount += 1;
      currentCountry.users.add(wallet);
      byCountry.set(acquisition.country, currentCountry);
    }
  }

  return {
    byUser: Array.from(byUser.values())
      .sort((a, b) => b.revenueUsd - a.revenueUsd)
      .slice(0, 12),
    bySource: Array.from(bySource.values())
      .map((r) => ({ ...r, users: r.users.size }))
      .sort((a, b) => b.revenueUsd - a.revenueUsd),
    byCountry: Array.from(byCountry.values())
      .map((r) => ({ ...r, users: r.users.size }))
      .sort((a, b) => b.revenueUsd - a.revenueUsd),
  };
}

export async function getLiveBuilderFillFeed(options?: {
  minutes?: number;
  limit?: number;
}) {
  const minutes = Math.max(1, Math.min(options?.minutes ?? 30, 360));
  const limit = Math.max(10, Math.min(options?.limit ?? 200, 500));
  const startTime = Date.now() - minutes * 60 * 1000;

  const [approvedWallets, proSet] = await Promise.all([
    getApprovedWallets(),
    getActiveProSet(),
  ]);
  if (approvedWallets.length === 0) {
    return {
      fills: [] as BuilderFillRow[],
      totals: { revenueUsd: 0, notionalUsd: 0, fillsCount: 0 },
    };
  }

  const allFills: BuilderFillRow[] = [];
  for (const wallet of approvedWallets) {
    let fills: Array<Record<string, unknown>> = [];
    try {
      fills = (await infoClient.userFillsByTime({
        user: wallet as `0x${string}`,
        startTime,
      })) as unknown as Array<Record<string, unknown>>;
    } catch (error) {
      console.warn("[metrics] live fill feed failed", { wallet, error });
      continue;
    }

    for (const fill of fills) {
      const coin = String(fill.coin ?? "").toUpperCase();
      const time = numberOrZero(fill.time);
      if (!time) continue;
      const px = numberOrZero(fill.px);
      const sz = Math.abs(numberOrZero(fill.sz));
      const notionalUsd = px * sz;
      if (!Number.isFinite(notionalUsd) || notionalUsd <= 0) continue;
      const sideRaw = String(fill.side ?? "").toLowerCase();
      const side: "buy" | "sell" = sideRaw.includes("sell") ? "sell" : "buy";
      const { builderFeeUsd, feeUnits } = estimateBuilderFeeUsd(
        {
          coin,
          notionalUsd,
          walletAddress: wallet,
          explicitBuilderFeeUsd: numberOrZero(
            (fill as { builderFee?: unknown }).builderFee,
          ),
        },
        proSet,
      );
      allFills.push({
        time,
        walletAddress: wallet,
        coin,
        side,
        px,
        sz,
        notionalUsd,
        builderFeeUsd,
        feeUnits,
        tid: String(fill.tid ?? `${wallet}-${time}`),
      });
    }
  }

  const fills = allFills.sort((a, b) => b.time - a.time).slice(0, limit);
  const totals = fills.reduce(
    (acc, fill) => {
      acc.revenueUsd += fill.builderFeeUsd;
      acc.notionalUsd += fill.notionalUsd;
      acc.fillsCount += 1;
      return acc;
    },
    { revenueUsd: 0, notionalUsd: 0, fillsCount: 0 },
  );
  return { fills, totals };
}

export async function gethyperliquidLiveBuilderFillFeed(options?: {
  minutes?: number;
  limit?: number;
}) {
  const minutes = Math.max(1, Math.min(options?.minutes ?? 30, 360));
  const limit = Math.max(10, Math.min(options?.limit ?? 200, 500));
  const startTime = Date.now() - minutes * 60 * 1000;

  const approvedWallets = await getApprovedWallets();
  if (approvedWallets.length === 0) {
    return {
      fills: [] as BuilderFillRow[],
      totals: { revenueUsd: 0, notionalUsd: 0, fillsCount: 0 },
    };
  }

  const allFills: BuilderFillRow[] = [];
  for (const wallet of approvedWallets) {
    let fills: Array<Record<string, unknown>> = [];
    try {
      fills = (await infoClient.userFillsByTime({
        user: wallet as `0x${string}`,
        startTime,
      })) as unknown as Array<Record<string, unknown>>;
    } catch (error) {
      console.warn("[metrics] hyperliquid live fill feed failed", {
        wallet,
        error,
      });
      continue;
    }

    for (const fill of fills) {
      const strictBuilderFeeUsd = getStrictBuilderFeeUsd(fill);
      if (strictBuilderFeeUsd === null) {
        continue;
      }

      const coin = String(fill.coin ?? "").toUpperCase();
      const time = numberOrZero(fill.time);
      if (!time) continue;
      const px = numberOrZero(fill.px);
      const sz = Math.abs(numberOrZero(fill.sz));
      const notionalUsd = px * sz;
      if (!Number.isFinite(notionalUsd) || notionalUsd <= 0) continue;
      const sideRaw = String(fill.side ?? "").toLowerCase();
      const side: "buy" | "sell" = sideRaw.includes("sell") ? "sell" : "buy";
      const feeUnits =
        notionalUsd > 0
          ? Math.round((strictBuilderFeeUsd / notionalUsd) * 1e6)
          : 0;
      allFills.push({
        time,
        walletAddress: wallet,
        coin,
        side,
        px,
        sz,
        notionalUsd,
        builderFeeUsd: strictBuilderFeeUsd,
        feeUnits,
        tid: String(fill.tid ?? `${wallet}-${time}`),
      });
    }
  }

  const fills = allFills.sort((a, b) => b.time - a.time).slice(0, limit);
  const totals = fills.reduce(
    (acc, fill) => {
      acc.revenueUsd += fill.builderFeeUsd;
      acc.notionalUsd += fill.notionalUsd;
      acc.fillsCount += 1;
      return acc;
    },
    { revenueUsd: 0, notionalUsd: 0, fillsCount: 0 },
  );

  return { fills, totals };
}
