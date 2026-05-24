import { and, desc, eq, gte, sql } from "drizzle-orm";

import { db } from "@acme/db/client";
import { BlinkMembership, BuilderApproval, BuilderDailyMetric, MetricEvent } from "@acme/db/schema";

import { env } from "~/env";

import { BUILDER_FEE_UNITS } from "./builder";
import { GROWTH_ZERO_FEE_MARKETS, isGrowthModeEnabled } from "./growth-mode";
import { infoClient } from "./hyperliquid";

type TrackMetricEventInput = {
  eventType: string;
  walletAddress?: string | null;
  source?: string;
  metadata?: Record<string, unknown>;
};

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

export async function trackMetricEvent(input: TrackMetricEventInput) {
  try {
    await db.insert(MetricEvent).values({
      eventType: input.eventType,
      walletAddress: input.walletAddress?.toLowerCase(),
      source: input.source ?? "app",
      metadata: input.metadata ?? {},
    });
  } catch (error) {
    console.error("[metrics] trackMetricEvent failed", error);
  }
}

export async function syncBuilderDailyMetrics(days = 90) {
  const now = Date.now();
  const startTime = now - days * 24 * 60 * 60 * 1000;

  const approvalRows = await db
    .select({
      walletAddress: BuilderApproval.walletAddress,
    })
    .from(BuilderApproval);

  const approvedWallets = Array.from(
    new Set(
      approvalRows
        .map((row) => row.walletAddress?.toLowerCase())
        .filter(Boolean),
    ),
  );

  if (approvedWallets.length === 0) {
    return { syncedDays: 0, wallets: 0 };
  }

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
  const proSet = new Set(
    activeProRows.map((row) => row.walletAddress.toLowerCase()),
  );

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
      let builderFeeUsd = numberOrZero((fill as { builderFee?: unknown }).builderFee);

      if (!builderFeeUsd) {
        const isZeroFeeGrowthMarket =
          isGrowthModeEnabled() && GROWTH_ZERO_FEE_MARKETS.includes(coin);
        const feeUnits =
          isZeroFeeGrowthMarket
            ? 0
            : proSet.has(wallet.toLowerCase())
              ? env.BLINK_PRO_BUILDER_FEE_BPS
              : BUILDER_FEE_UNITS;
        builderFeeUsd = volume * feeUnits * 1e-6;
      }

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
    { volumeUsd: 0, builderFeeUsd: 0, feeUsd: 0, fillsCount: 0, activeUsers: 0 },
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
      avgRevenuePerUser:
        totalUsers > 0 ? totals.builderFeeUsd / totalUsers : 0,
    },
    series: rows.map((r) => ({
      day: r.day,
      revenue: numberOrZero(r.builderFeeUsd),
      volume: numberOrZero(r.volumeUsd),
      users: Number(r.activeUsers ?? 0),
    })),
  };
}

export async function getBuilderAttributionSnapshot(days = 90) {
  const now = Date.now();
  const startTime = now - days * 24 * 60 * 60 * 1000;

  const [approvalRows, signupRows, activeProRows] = await Promise.all([
    db.select({ walletAddress: BuilderApproval.walletAddress }).from(BuilderApproval),
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
    db
      .select({ walletAddress: BlinkMembership.walletAddress })
      .from(BlinkMembership)
      .where(
        and(
          eq(BlinkMembership.status, "active"),
          gte(BlinkMembership.currentPeriodEnd, new Date()),
        ),
      ),
  ]);

  const approvedWallets = Array.from(
    new Set(approvalRows.map((r) => r.walletAddress?.toLowerCase()).filter(Boolean)),
  );
  const proSet = new Set(activeProRows.map((r) => r.walletAddress.toLowerCase()));
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
    const source = String(row.source ?? metadata.source ?? "unknown").toLowerCase();
    const country = String(metadata.country ?? "unknown").toUpperCase();
    signupMap.set(wallet, { source, country });
  }

  const byUser = new Map<
    string,
    { walletAddress: string; source: string; country: string; volumeUsd: number; revenueUsd: number; fillsCount: number }
  >();
  const bySource = new Map<string, { source: string; volumeUsd: number; revenueUsd: number; users: Set<string>; fillsCount: number }>();
  const byCountry = new Map<string, { country: string; volumeUsd: number; revenueUsd: number; users: Set<string>; fillsCount: number }>();

  for (const wallet of approvedWallets) {
    let fills: Array<Record<string, unknown>> = [];
    try {
      fills = (await infoClient.userFillsByTime({
        user: wallet as `0x${string}`,
        startTime,
      })) as unknown as Array<Record<string, unknown>>;
    } catch (error) {
      console.warn("[metrics] attribution userFillsByTime failed", { wallet, error });
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

      let builderFeeUsd = numberOrZero((fill as { builderFee?: unknown }).builderFee);
      if (!builderFeeUsd) {
        const isZeroFeeGrowthMarket =
          isGrowthModeEnabled() && GROWTH_ZERO_FEE_MARKETS.includes(coin);
        const feeUnits =
          isZeroFeeGrowthMarket
            ? 0
            : proSet.has(wallet.toLowerCase())
              ? env.BLINK_PRO_BUILDER_FEE_BPS
              : BUILDER_FEE_UNITS;
        builderFeeUsd = volume * feeUnits * 1e-6;
      }

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
