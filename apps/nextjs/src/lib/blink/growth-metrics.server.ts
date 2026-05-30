import { and, desc, eq, gte, inArray } from "drizzle-orm";

import { db } from "@acme/db/client";
import {
  BlinkMembership,
  BuilderDailyMetric,
  MetricEvent,
} from "@acme/db/schema";

import {
  isMembershipEntitledStatus,
  isStripeTrialMembership,
} from "./internal-memberships.server";
import {
  isLifetimeMetricsWindow,
  type MetricsWindowDays,
} from "./metrics-window";

const PRO_MONTHLY_USD: Record<string, number> = {
  basic: 9.99,
  preferred: 79,
  premium: 249,
};

const PRO_YEARLY_USD: Record<string, number> = {
  basic: 99,
  preferred: 790,
  premium: 2490,
};

function toDayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function estimateMonthlyRevenueUsd(membership: {
  tier: string;
  status: string;
  paymentMethod: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  createdAt: Date;
  currentPeriodEnd: Date | null;
}) {
  if (membership.paymentMethod === "gift") return 0;
  if (isStripeTrialMembership(membership)) return 0;

  const tier = membership.tier.toLowerCase();
  const monthly = PRO_MONTHLY_USD[tier] ?? 0;
  if (!monthly) return 0;

  const periodEnd = membership.currentPeriodEnd?.getTime() ?? 0;
  const created = membership.createdAt.getTime();
  const periodDays =
    periodEnd > created ? (periodEnd - created) / (24 * 60 * 60 * 1000) : 30;

  if (periodDays > 45) {
    const yearly = PRO_YEARLY_USD[tier] ?? monthly * 12;
    return yearly / 12;
  }

  return monthly;
}

export type GrowthMetrics = {
  subscription: {
    activePro: number;
    payingPro: number;
    giftedPro: number;
    mrrUsd: number;
    arrUsd: number;
    drrUsd: number;
    churnRate30d: number;
    newPro30d: number;
    churnedPro30d: number;
  };
  dailySeries: Array<{
    day: string;
    dau: number;
    signups: number;
    builderApproved: number;
    firstTrade: number;
    tradingEnabled: number;
    proStarted: number;
  }>;
};

export async function getGrowthMetrics(
  windowDays: MetricsWindowDays = 90,
): Promise<GrowthMetrics> {
  const now = Date.now();
  const cutoff = isLifetimeMetricsWindow(windowDays)
    ? null
    : new Date(now - windowDays * 24 * 60 * 60 * 1000);
  const boundedWindowDays = isLifetimeMetricsWindow(windowDays) ? 90 : windowDays;
  const ms30d = 30 * 24 * 60 * 60 * 1000;

  const [dailyMetrics, metricRows, memberships] = await Promise.all([
    cutoff
      ? db
          .select({
            day: BuilderDailyMetric.day,
            activeUsers: BuilderDailyMetric.activeUsers,
          })
          .from(BuilderDailyMetric)
          .where(gte(BuilderDailyMetric.day, cutoff.toISOString().slice(0, 10)))
          .orderBy(desc(BuilderDailyMetric.day))
          .limit(boundedWindowDays)
      : db
          .select({
            day: BuilderDailyMetric.day,
            activeUsers: BuilderDailyMetric.activeUsers,
          })
          .from(BuilderDailyMetric)
          .orderBy(desc(BuilderDailyMetric.day)),
    cutoff
      ? db
          .select({
            eventType: MetricEvent.eventType,
            walletAddress: MetricEvent.walletAddress,
            createdAt: MetricEvent.createdAt,
            isBot: MetricEvent.isBot,
          })
          .from(MetricEvent)
          .where(
            and(
              gte(MetricEvent.createdAt, cutoff),
              inArray(MetricEvent.eventType, [
                "signup",
                "builder_approved",
                "builder_fee_approved",
                "trading_enabled",
                "first_trade",
                "pro_started",
              ]),
            ),
          )
          .orderBy(desc(MetricEvent.createdAt))
          .limit(25_000)
      : db
          .select({
            eventType: MetricEvent.eventType,
            walletAddress: MetricEvent.walletAddress,
            createdAt: MetricEvent.createdAt,
            isBot: MetricEvent.isBot,
          })
          .from(MetricEvent)
          .where(
            inArray(MetricEvent.eventType, [
              "signup",
              "builder_approved",
              "builder_fee_approved",
              "trading_enabled",
              "first_trade",
              "pro_started",
            ]),
          )
          .orderBy(desc(MetricEvent.createdAt))
          .limit(50_000),
    db
      .select({
        tier: BlinkMembership.tier,
        status: BlinkMembership.status,
        paymentMethod: BlinkMembership.paymentMethod,
        stripeCustomerId: BlinkMembership.stripeCustomerId,
        stripeSubscriptionId: BlinkMembership.stripeSubscriptionId,
        createdAt: BlinkMembership.createdAt,
        updatedAt: BlinkMembership.updatedAt,
        currentPeriodEnd: BlinkMembership.currentPeriodEnd,
      })
      .from(BlinkMembership),
  ]);

  const dayMap = new Map<
    string,
    {
      dau: number;
      signups: number;
      builderApproved: number;
      tradingEnabled: number;
      firstTrade: number;
      proStarted: number;
    }
  >();

  for (const row of dailyMetrics) {
    const day =
      typeof row.day === "string"
        ? row.day.slice(0, 10)
        : toDayKey(new Date(row.day));
    dayMap.set(day, {
      dau: row.activeUsers,
      signups: 0,
      builderApproved: 0,
      tradingEnabled: 0,
      firstTrade: 0,
      proStarted: 0,
    });
  }

  for (const row of metricRows) {
    if (row.isBot) continue;
    const day = toDayKey(new Date(row.createdAt));
    const current = dayMap.get(day) ?? {
      dau: 0,
      signups: 0,
      builderApproved: 0,
      tradingEnabled: 0,
      firstTrade: 0,
      proStarted: 0,
    };
    if (row.eventType === "signup") current.signups += 1;
    if (
      row.eventType === "builder_approved" ||
      row.eventType === "builder_fee_approved"
    ) {
      current.builderApproved += 1;
    }
    if (row.eventType === "trading_enabled") current.tradingEnabled += 1;
    if (row.eventType === "first_trade") current.firstTrade += 1;
    if (row.eventType === "pro_started") current.proStarted += 1;
    dayMap.set(day, current);
  }

  const dailySeries = Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, values]) => ({ day, ...values }));

  const activeMemberships = memberships.filter((row) => {
    if (!isMembershipEntitledStatus(row.status)) return false;
    if (!row.currentPeriodEnd) return true;
    return row.currentPeriodEnd.getTime() > now;
  });

  const payingPro = activeMemberships.filter(
    (row) => row.paymentMethod !== "gift" && !isStripeTrialMembership(row),
  );
  const giftedPro = activeMemberships.filter(
    (row) => row.paymentMethod === "gift",
  );

  const mrrUsd = payingPro.reduce(
    (sum, row) => sum + estimateMonthlyRevenueUsd(row),
    0,
  );

  const newPro30d = memberships.filter(
    (row) => row.createdAt.getTime() > now - ms30d,
  ).length;

  const churnedPro30d = memberships.filter((row) => {
    const ended = row.currentPeriodEnd && row.currentPeriodEnd.getTime() <= now;
    const recentlyUpdated =
      row.updatedAt?.getTime() && row.updatedAt.getTime() > now - ms30d;
    return ended && recentlyUpdated && row.status !== "active";
  }).length;

  const activeAtPeriodStart = memberships.filter((row) => {
    const createdBefore = row.createdAt.getTime() <= now - ms30d;
    const stillValid =
      !row.currentPeriodEnd || row.currentPeriodEnd.getTime() > now - ms30d;
    return createdBefore && stillValid;
  }).length;

  const churnRate30d =
    activeAtPeriodStart > 0 ? (churnedPro30d / activeAtPeriodStart) * 100 : 0;

  return {
    subscription: {
      activePro: activeMemberships.length,
      payingPro: payingPro.length,
      giftedPro: giftedPro.length,
      mrrUsd,
      arrUsd: mrrUsd * 12,
      drrUsd: mrrUsd / 30,
      churnRate30d,
      newPro30d,
      churnedPro30d,
    },
    dailySeries,
  };
}
