import type { InternalDashboardStats } from "@/lib/internal-stats-types";
import { SITE } from "@/lib/site";

function pct(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null;
  if (denominator <= 0) return null;
  return (numerator / denominator) * 100;
}

function avgOrderValue(revenue: number, count: number): number | null {
  if (count <= 0) return null;
  return revenue / count;
}

export type MarketingStatsShowcase = {
  generatedAt: string;
  rangeDays: number;
  trafficSource: InternalDashboardStats["trafficSource"];
  visitors: {
    totalUniques: number;
    totalPageviews: number;
    todayUniques: number;
    todayPageviews: number;
    yesterdayUniques: number;
    yesterdayPageviews: number;
    countriesReached: number;
    topCountries: { country: string; pageviews: number }[];
    topPaths: { path: string; pageviews: number }[];
    pageviewSeries: number[];
    uniqueSeries: number[];
    seriesLabels: string[];
  };
  conversion: {
    /** Unique visitors → active members (range uniques as denom). */
    visitorToMemberPct: number | null;
    /** Paying members / (paying + conversion leads). */
    leadToPaidPct: number | null;
    /** Crypto view → paid (when crypto funnel has data). */
    cryptoViewToPaidPct: number | null;
    cryptoViewToConnectPct: number | null;
    cryptoConnectToSignPct: number | null;
    cryptoSignToPaidPct: number | null;
    conversionLeads: number;
    payingMembers: number;
    activeMembers: number;
    trialingMembers: number;
  };
  financial: {
    mrr: number;
    arr: number;
    allTimeRevenue: number;
    rangeGross: number;
    todayGross: number;
    yesterdayGross: number;
    todayPctChange: number | null;
    arpu: number | null;
    avgOrderValue: number | null;
    balanceAvailable: number;
    balancePending: number;
    revenueSeries: number[];
    revenueLabels: string[];
    paymentsBreakdown: { status: string; count: number; amount: number }[];
  };
  product: {
    plans: {
      id: string;
      label: string;
      amountUsd: number;
      amountEur: number;
      subscribers: number;
      mrr: number;
      active: boolean;
    }[];
    livePlans: number;
    totalPlanSubscribers: number;
    checkoutStarts: number;
    partnerCount: number;
    featureCount: number;
  };
  impact: {
    activeMembers: number;
    countriesReached: number;
    partnerCount: number;
    featureCount: number;
    rating: string;
    reviewBlurb: string;
    cryptoPaid: number;
    cryptoRevenueUsdc: number;
    cardChargeCount: number;
    whopMembers: number;
    stripeNativeMembers: number;
  };
};

/**
 * Derive a Marketing showcase board from dashboard stats — visitors,
 * conversion, financial, product, and impact aggregates (no PII rows).
 */
export function buildMarketingStatsShowcase(
  stats: InternalDashboardStats,
): MarketingStatsShowcase {
  const members = stats.members;
  const activeMembers = members.filter(
    (m) => m.status === "active" || m.status === "trialing",
  ).length;
  const payingMembers = members.filter(
    (m) =>
      (m.status === "active" || (m.mrr ?? 0) > 0) &&
      (m.lastPaidAt || (m.mrr ?? 0) > 0 || m.status === "active"),
  ).length;
  const trialingMembers = members.filter((m) => m.status === "trialing").length;
  const conversionLeads = trialingMembers;
  const whopMembers = members.filter((m) => m.source === "whop_member").length;
  const stripeNativeMembers = members.filter(
    (m) => m.source !== "whop_member",
  ).length;

  const cardCharges = stats.earnings.cardChargeCount;
  const paidPaymentCount = stats.paymentsBreakdown
    .filter((row) => row.status === "succeeded" || row.status === "paid")
    .reduce((sum, row) => sum + row.count, 0);

  const pageviewSeries =
    stats.traffic.series.length > 1
      ? stats.traffic.series.map((d) => d.pageviews)
      : [stats.traffic.yesterday.pageviews, stats.traffic.today.pageviews];
  const uniqueSeries =
    stats.traffic.series.length > 1
      ? stats.traffic.series.map((d) => d.uniques)
      : [stats.traffic.yesterday.uniques, stats.traffic.today.uniques];
  const seriesLabels =
    stats.traffic.series.length > 1
      ? stats.traffic.series.map((d) => d.date.slice(5))
      : ["Yday", "Today"];

  return {
    generatedAt: stats.generatedAt,
    rangeDays: stats.rangeDays,
    trafficSource: stats.trafficSource,
    visitors: {
      totalUniques: stats.rangeUniques,
      totalPageviews: stats.rangePageviews,
      todayUniques: stats.traffic.today.uniques,
      todayPageviews: stats.traffic.today.pageviews,
      yesterdayUniques: stats.traffic.yesterday.uniques,
      yesterdayPageviews: stats.traffic.yesterday.pageviews,
      countriesReached: stats.countries.length,
      topCountries: stats.countries.slice(0, 8),
      topPaths: stats.paths.slice(0, 8),
      pageviewSeries,
      uniqueSeries,
      seriesLabels,
    },
    conversion: {
      visitorToMemberPct: pct(activeMembers, stats.rangeUniques),
      leadToPaidPct: pct(
        payingMembers,
        payingMembers + conversionLeads,
      ),
      cryptoViewToPaidPct: stats.crypto.conversion.viewToPaid,
      cryptoViewToConnectPct: stats.crypto.conversion.viewToConnect,
      cryptoConnectToSignPct: stats.crypto.conversion.connectToSign,
      cryptoSignToPaidPct: stats.crypto.conversion.signToPaid,
      conversionLeads,
      payingMembers,
      activeMembers,
      trialingMembers,
    },
    financial: {
      mrr: stats.mrr,
      arr: stats.arr,
      allTimeRevenue: stats.allTimeRevenue,
      rangeGross: stats.rangeGross,
      todayGross: stats.today.grossRevenue,
      yesterdayGross: stats.today.yesterdayGross,
      todayPctChange: stats.today.pctChange,
      arpu: payingMembers > 0 ? stats.mrr / payingMembers : null,
      avgOrderValue: avgOrderValue(
        stats.stripeAllTimeRevenue,
        Math.max(paidPaymentCount, cardCharges),
      ),
      balanceAvailable: stats.balance.available,
      balancePending: stats.balance.pending,
      revenueSeries: stats.revenueSeries.map((r) => r.amount),
      revenueLabels: stats.revenueSeries.map((r) => r.date.slice(5)),
      paymentsBreakdown: stats.paymentsBreakdown,
    },
    product: {
      plans: stats.store.map((plan) => ({
        id: plan.id,
        label: plan.label,
        amountUsd: plan.amountUsd,
        amountEur: plan.amountEur,
        subscribers: plan.subscribers,
        mrr: plan.mrr,
        active: plan.active,
      })),
      livePlans: stats.store.filter((p) => p.active).length,
      totalPlanSubscribers: stats.store.reduce(
        (sum, p) => sum + p.subscribers,
        0,
      ),
      checkoutStarts: stats.store.reduce(
        (sum, p) => sum + (p.checkoutStarts ?? 0),
        0,
      ),
      partnerCount: SITE.partners.length,
      featureCount: SITE.features.length,
    },
    impact: {
      activeMembers: stats.activeSubscribers || activeMembers,
      countriesReached: stats.countries.length,
      partnerCount: SITE.partners.length,
      featureCount: SITE.features.length,
      rating: "5.0",
      reviewBlurb: "Member rating from Whop-era reviews",
      cryptoPaid: stats.crypto.totals.paid,
      cryptoRevenueUsdc: stats.crypto.totals.revenueUsdc,
      cardChargeCount: cardCharges,
      whopMembers,
      stripeNativeMembers,
    },
  };
}

export function formatPct(value: number | null, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)}%`;
}
