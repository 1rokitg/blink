import "server-only";

import type Stripe from "stripe";

import { getCloudflareZoneTraffic } from "@/lib/cloudflare-zone-analytics.server";
import type { CloudflareTrafficSnapshot } from "@/lib/cloudflare-zone-analytics-types";
import { formatUsd } from "@/lib/internal-money";
import {
  DEFAULT_DASHBOARD_RANGE,
  isLifetimeRange,
  type DashboardRange,
  type InternalDashboardStats,
  type StripeMemberRow,
} from "@/lib/internal-stats-types";
import { collectStripeMemberTags } from "@/lib/member-tags";
import { FALLBACK_PLANS, type PlanId, PLAN_ORDER } from "@/lib/plans";
import {
  getRecentVisitors,
  getTrafficSeries,
  mergeCountryCounts,
  mergePathCounts,
} from "@/lib/pageviews.server";
import { getCryptoFunnelStats } from "@/lib/crypto-analytics.server";
import { getProprReferralSummary } from "@/lib/propr-referrals.server";
import type { ProprReferralSummary } from "@/lib/propr-referrals-types";
import { getStoreCatalog } from "@/lib/store-config.server";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import {
  getWhopRecurringMetricsFromStripe,
  listWhopPaymentsFromStripe,
} from "@/lib/whop-stripe.server";

function proprOverlay(
  propr: ProprReferralSummary | null,
): InternalDashboardStats["proprReferrals"] {
  if (!propr) return null;
  return {
    volume: propr.grossVolume,
    earnings: propr.estCommission,
    availableToClaim: propr.availableToClaim ?? 0,
    signups: propr.signups,
    purchases: propr.purchases,
  };
}

type TrafficBundle = Awaited<ReturnType<typeof getTrafficSeries>>;

function utcDayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function emptyTrafficDay(date: string): TrafficBundle["today"] {
  return {
    date,
    pageviews: 0,
    uniques: 0,
    byCountry: {},
    byPath: {},
    byChannel: {},
  };
}

/**
 * Map Cloudflare Zone Analytics into the Home traffic shape so pageviews /
 * uniques match the Traffic History tab.
 */
function trafficFromCloudflare(
  cf: CloudflareTrafficSnapshot,
  rangeDays: DashboardRange,
): {
  traffic: TrafficBundle;
  countries: { country: string; pageviews: number }[];
  paths: { path: string; pageviews: number }[];
} | null {
  if (!cf.ok) return null;

  const todayIso = utcDayKey();
  const yesterdayIso = utcDayKey(
    new Date(Date.UTC(
      new Date().getUTCFullYear(),
      new Date().getUTCMonth(),
      new Date().getUTCDate() - 1,
    )),
  );

  // Minute series only has today — collapse to a single daily point for Home.
  const daySeries =
    cf.seriesGranularity === "minute"
      ? [
          {
            date: todayIso,
            pageviews: cf.today?.pageviews ?? cf.totals.pageviews,
            uniques: cf.today?.uniques ?? cf.totals.uniques,
            byCountry: {} as Record<string, number>,
            byPath: {} as Record<string, number>,
            byChannel: {} as Record<string, number>,
          },
        ]
      : cf.series.map((row) => ({
          date: row.date,
          pageviews: row.pageviews,
          uniques: row.uniques,
          byCountry: {} as Record<string, number>,
          byPath: {} as Record<string, number>,
          byChannel: {} as Record<string, number>,
        }));

  if (daySeries.length === 0) return null;

  const today =
    daySeries.find((row) => row.date === todayIso) ??
    ({
      ...emptyTrafficDay(todayIso),
      pageviews: cf.today?.pageviews ?? cf.totals.pageviews,
      uniques: cf.today?.uniques ?? cf.totals.uniques,
    } satisfies TrafficBundle["today"]);

  const yesterday =
    daySeries.find((row) => row.date === yesterdayIso) ??
    emptyTrafficDay(yesterdayIso);

  const series =
    rangeDays === 1
      ? [today]
      : daySeries.slice(-(isLifetimeRange(rangeDays) ? daySeries.length : rangeDays));

  return {
    traffic: { series, today, yesterday },
    countries: cf.countries.map((row) => ({
      country: row.country,
      pageviews: row.requests,
    })),
    paths: cf.paths.map((row) => ({
      path: row.path,
      pageviews: row.requests,
    })),
  };
}

/** Traffic overlays top out at 90d — lifetime earnings still use that cap. */
function trafficLookbackDays(rangeDays: DashboardRange): Exclude<DashboardRange, 0> {
  if (isLifetimeRange(rangeDays) || rangeDays > 90) return 90;
  return rangeDays === 1 ? 1 : rangeDays;
}

async function resolveHomeTraffic(rangeDays: DashboardRange): Promise<{
  traffic: TrafficBundle;
  countries: { country: string; pageviews: number }[];
  paths: { path: string; pageviews: number }[];
  trafficSource: InternalDashboardStats["trafficSource"];
}> {
  const lookback = trafficLookbackDays(rangeDays);
  // Today needs yesterday for the WoW card — pull at least 2 CF days.
  const cfDays = lookback === 1 ? 2 : lookback;
  try {
    const cf = await getCloudflareZoneTraffic(cfDays);
    const mapped = trafficFromCloudflare(cf, lookback);
    if (mapped) {
      return { ...mapped, trafficSource: "cloudflare" };
    }
  } catch (error) {
    console.error("[stats] Cloudflare traffic overlay failed", error);
  }

  const traffic = await getTrafficSeries(lookback);
  return {
    traffic,
    countries: mergeCountryCounts(traffic.series),
    paths: mergePathCounts(traffic.series),
    trafficSource: "first_party",
  };
}

export type { InternalDashboardStats, DashboardRange };
export { formatUsd };

function startOfUtcDay(d = new Date()) {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

function monthlyAmountFromSubscription(sub: Stripe.Subscription) {
  let monthly = 0;
  for (const item of sub.items.data) {
    const price = item.price;
    const unit = (price.unit_amount ?? 0) / 100;
    const qty = item.quantity ?? 1;
    const recurring = price.recurring;
    if (!recurring) {
      monthly += unit * qty;
      continue;
    }
    const count = recurring.interval_count || 1;
    if (recurring.interval === "year") {
      monthly += (unit * qty) / (12 * count);
    } else if (recurring.interval === "month") {
      monthly += (unit * qty) / count;
    } else if (recurring.interval === "week") {
      monthly += ((unit * qty) / count) * (52 / 12);
    } else if (recurring.interval === "day") {
      monthly += ((unit * qty) / count) * (365 / 12);
    }
  }
  return monthly;
}

function planIdFromSubscription(sub: Stripe.Subscription): PlanId | null {
  const meta = sub.metadata?.planId?.trim();
  if (meta && PLAN_ORDER.includes(meta as PlanId)) {
    return meta as PlanId;
  }
  return null;
}

async function listAllSubscriptions(stripe: Stripe) {
  const out: Stripe.Subscription[] = [];
  let startingAfter: string | undefined;
  for (let i = 0; i < 20; i += 1) {
    const page = await stripe.subscriptions.list({
      status: "all",
      limit: 100,
      starting_after: startingAfter,
      expand: ["data.items.data.price", "data.customer"],
    });
    out.push(...page.data);
    if (!page.has_more) break;
    startingAfter = page.data[page.data.length - 1]?.id;
  }
  return out;
}

/**
 * Lifetime income via Stripe Payments (paid invoices = source of truth).
 * Includes migrated Whop history plus any later Stripe invoices.
 */
async function sumAllTimeStripeRevenue(stripe: Stripe) {
  let total = 0;
  let startingAfter: string | undefined;
  for (let i = 0; i < 50; i += 1) {
    const page = await stripe.invoices.list({
      status: "paid",
      limit: 100,
      starting_after: startingAfter,
    });
    for (const invoice of page.data) {
      total += (invoice.amount_paid ?? 0) / 100;
    }
    if (!page.has_more) break;
    startingAfter = page.data[page.data.length - 1]?.id;
  }
  return total;
}

async function sumChargesBetween(stripe: Stripe, gte: number, lt?: number) {
  let total = 0;
  const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, amount: 0 }));
  let startingAfter: string | undefined;

  for (let i = 0; i < 30; i += 1) {
    const page = await stripe.charges.list({
      limit: 100,
      starting_after: startingAfter,
      created: lt ? { gte, lt } : { gte },
    });
    for (const charge of page.data) {
      if (charge.status !== "succeeded" || charge.refunded) continue;
      const amount = (charge.amount - (charge.amount_refunded ?? 0)) / 100;
      total += amount;
      const hour = new Date(charge.created * 1000).getUTCHours();
      hourly[hour]!.amount += amount;
    }
    if (!page.has_more) break;
    startingAfter = page.data[page.data.length - 1]?.id;
  }

  return { total, hourly };
}

function bumpBucket(
  map: Map<string, { amount: number; count: number }>,
  key: string,
  amount: number,
) {
  const entry = map.get(key) ?? { amount: 0, count: 0 };
  entry.amount += amount;
  entry.count += 1;
  map.set(key, entry);
}

async function revenueSeriesDays(stripe: Stripe, days: number) {
  const series: { date: string; amount: number }[] = [];
  const end = startOfUtcDay();
  const lifetime = isLifetimeRange(days);
  const start = new Date(end);
  if (!lifetime) {
    start.setUTCDate(start.getUTCDate() - (days - 1));
  }

  const buckets = new Map<string, number>();
  if (!lifetime) {
    for (let i = 0; i < days; i += 1) {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i);
      buckets.set(d.toISOString().slice(0, 10), 0);
    }
  }

  const byCountry = new Map<string, { amount: number; count: number }>();
  const byPlan = new Map<string, { amount: number; count: number }>();
  const bySource = new Map<string, { amount: number; count: number }>();
  let cardChargeCount = 0;

  let startingAfter: string | undefined;
  const gte = lifetime ? undefined : Math.floor(start.getTime() / 1000);
  for (let i = 0; i < 50; i += 1) {
    const page = await stripe.charges.list({
      limit: 100,
      starting_after: startingAfter,
      ...(gte !== undefined ? { created: { gte } } : {}),
    });
    for (const charge of page.data) {
      if (charge.status !== "succeeded" || charge.refunded) continue;
      const day = new Date(charge.created * 1000).toISOString().slice(0, 10);
      if (!lifetime && !buckets.has(day)) continue;
      const amount = (charge.amount - (charge.amount_refunded ?? 0)) / 100;
      buckets.set(day, (buckets.get(day) ?? 0) + amount);
      cardChargeCount += 1;

      const country =
        charge.billing_details?.address?.country?.toUpperCase() ||
        charge.metadata?.country?.toUpperCase() ||
        "XX";
      bumpBucket(byCountry, country, amount);

      const planId =
        charge.metadata?.planId?.trim() ||
        charge.metadata?.plan?.trim() ||
        "unknown";
      bumpBucket(byPlan, planId, amount);

      const source =
        charge.metadata?.source?.trim() ||
        (charge.metadata?.claimId ? "claim_link" : "card_checkout");
      bumpBucket(bySource, source, amount);
    }
    if (!page.has_more) break;
    startingAfter = page.data[page.data.length - 1]?.id;
  }

  if (lifetime) {
    const endKey = end.toISOString().slice(0, 10);
    const keys = [...buckets.keys()].sort();
    const firstKey = keys[0] ?? endKey;
    const cursor = new Date(`${firstKey}T00:00:00.000Z`);
    const endMs = end.getTime();
    const filled = new Map<string, number>();
    while (cursor.getTime() <= endMs) {
      const key = cursor.toISOString().slice(0, 10);
      filled.set(key, buckets.get(key) ?? 0);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    for (const [date, amount] of filled) {
      series.push({ date, amount });
    }
  } else {
    for (const [date, amount] of buckets) {
      series.push({ date, amount });
    }
  }

  const sortAmount = (
    entries: [string, { amount: number; count: number }][],
  ) =>
    entries
      .map(([key, value]) => ({ key, ...value }))
      .sort((a, b) => b.amount - a.amount);

  return {
    series,
    earnings: {
      cardChargeCount,
      cardByCountry: sortAmount([...byCountry.entries()]).map((row) => ({
        country: row.key,
        amount: row.amount,
        count: row.count,
      })),
      cardByPlan: sortAmount([...byPlan.entries()]).map((row) => ({
        planId: row.key,
        amount: row.amount,
        count: row.count,
      })),
      cardBySource: sortAmount([...bySource.entries()]).map((row) => ({
        source: row.key,
        amount: row.amount,
        count: row.count,
      })),
    },
  };
}

function emptyStats(
  rangeDays: DashboardRange,
  traffic: TrafficBundle,
  people: Awaited<ReturnType<typeof getRecentVisitors>>,
  crypto: Awaited<ReturnType<typeof getCryptoFunnelStats>>,
  trafficSource: InternalDashboardStats["trafficSource"] = "first_party",
  countries = mergeCountryCounts(traffic.series),
  paths = mergePathCounts(traffic.series),
): InternalDashboardStats {
  return {
    generatedAt: new Date().toISOString(),
    rangeDays,
    stripeConfigured: false,
    today: {
      grossRevenue: 0,
      yesterdayGross: 0,
      pctChange: null,
      hourly: Array.from({ length: 24 }, (_, hour) => ({ hour, amount: 0 })),
    },
    balance: { available: 0, pending: 0, currency: "eur" },
    mrr: 0,
    arr: 0,
    activeSubscribers: 0,
    paymentsBreakdown: [],
    revenueSeries: [],
    trafficSource,
    traffic,
    countries,
    paths,
    people,
    members: [],
    store: [],
    crypto,
    rangeGross: 0,
    allTimeRevenue: 0,
    stripeAllTimeRevenue: 0,
    proprReferrals: null,
    rangeUniques: traffic.series.reduce((sum, d) => sum + d.uniques, 0),
    rangePageviews: traffic.series.reduce((sum, d) => sum + d.pageviews, 0),
    earnings: {
      cardChargeCount: 0,
      cardByCountry: [],
      cardByPlan: [],
      cardBySource: [],
    },
  };
}

export function normalizeRange(value: unknown): DashboardRange {
  if (
    value === "lifetime" ||
    value === "all" ||
    value === "all-time" ||
    value === "0"
  ) {
    return 0;
  }
  const n = Number(value);
  if (n === 0 || n === 1 || n === 7 || n === 14 || n === 30 || n === 90) return n;
  return DEFAULT_DASHBOARD_RANGE;
}

export async function getInternalDashboardStats(
  rangeDaysInput: DashboardRange | number = DEFAULT_DASHBOARD_RANGE,
): Promise<InternalDashboardStats> {
  const rangeDays = normalizeRange(rangeDaysInput);
  // AE/CF crypto+traffic windows max out at 90d; lifetime revenue uses Stripe all-time.
  const overlayDays = isLifetimeRange(rangeDays) ? 90 : rangeDays;
  const [homeTraffic, people, crypto, propr] = await Promise.all([
    resolveHomeTraffic(rangeDays),
    getRecentVisitors(150),
    getCryptoFunnelStats(overlayDays),
    getProprReferralSummary(),
  ]);
  const proprReferrals = proprOverlay(propr);
  const proprEarnings = proprReferrals?.earnings ?? 0;
  const { traffic, countries, paths, trafficSource } = homeTraffic;
  const rangeUniques =
    trafficSource === "cloudflare" && rangeDays === 1
      ? traffic.today.uniques
      : traffic.series.reduce((sum, d) => sum + d.uniques, 0);
  const rangePageviews =
    trafficSource === "cloudflare" && rangeDays === 1
      ? traffic.today.pageviews
      : traffic.series.reduce((sum, d) => sum + d.pageviews, 0);

  if (!isStripeConfigured()) {
    const store = await getStoreCatalog({ pathCounts: paths });
    return {
      ...emptyStats(
        rangeDays,
        traffic,
        people,
        crypto,
        trafficSource,
        countries,
        paths,
      ),
      store,
      countries,
      paths,
      rangeUniques,
      rangePageviews,
      stripeAllTimeRevenue: 0,
      proprReferrals,
      allTimeRevenue: proprEarnings,
      rangeGross: isLifetimeRange(rangeDays)
        ? proprEarnings
        : 0,
    };
  }

  const stripe = getStripe();
  const todayStart = startOfUtcDay();
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setUTCDate(yesterdayStart.getUTCDate() - 1);

  const [
    todayCharges,
    yesterdayCharges,
    subs,
    balance,
    cardEarnings,
    stripeAllTimeRevenue,
    whopRecurring,
  ] = await Promise.all([
    sumChargesBetween(stripe, Math.floor(todayStart.getTime() / 1000)),
    sumChargesBetween(
      stripe,
      Math.floor(yesterdayStart.getTime() / 1000),
      Math.floor(todayStart.getTime() / 1000),
    ),
    listAllSubscriptions(stripe),
    stripe.balance.retrieve(),
    revenueSeriesDays(stripe, rangeDays),
    sumAllTimeStripeRevenue(stripe),
    getWhopRecurringMetricsFromStripe(),
  ]);
  const allTimeRevenue = stripeAllTimeRevenue + proprEarnings;
  const revenueSeries = cardEarnings.series;

  let mrr = 0;
  let activeSubscribers = 0;
  const subCustomerIds = new Set<string>();
  const breakdownMap = new Map<string, { count: number; amount: number }>();
  const planStats: Partial<
    Record<PlanId, { subscribers: number; mrr: number }>
  > = {};
  const members: StripeMemberRow[] = [];

  for (const sub of subs) {
    const monthly = monthlyAmountFromSubscription(sub);
    const status = sub.status;
    const entry = breakdownMap.get(status) ?? { count: 0, amount: 0 };
    entry.count += 1;
    entry.amount += monthly;
    breakdownMap.set(status, entry);

    const planId = planIdFromSubscription(sub);
    if (planId && (status === "active" || status === "trialing")) {
      const ps = planStats[planId] ?? { subscribers: 0, mrr: 0 };
      ps.subscribers += 1;
      ps.mrr += monthly;
      planStats[planId] = ps;
    }

    if (status === "active" || status === "trialing") {
      mrr += monthly;
      activeSubscribers += 1;
    }

    const customer =
      typeof sub.customer === "object" && sub.customer && !sub.customer.deleted
        ? sub.customer
        : null;
    const customerId =
      typeof sub.customer === "string"
        ? sub.customer
        : customer?.id || null;
    if (customerId) subCustomerIds.add(customerId);

    const periodEndUnix =
      (sub.items.data[0] as { current_period_end?: number } | undefined)
        ?.current_period_end ??
      (sub as unknown as { current_period_end?: number }).current_period_end;

    const periodEnd = periodEndUnix
      ? new Date(periodEndUnix * 1000).toISOString()
      : null;

    const source =
      sub.metadata?.source?.trim() ||
      (sub.metadata?.manualGrant === "true" ? "manual_grant" : null);
    const note =
      sub.metadata?.note?.trim() ||
      customer?.metadata?.note?.trim() ||
      null;

    members.push({
      id: sub.id,
      customerId,
      email:
        customer && "email" in customer ? (customer.email ?? null) : null,
      name: customer && "name" in customer ? (customer.name ?? null) : null,
      telegramUsername:
        sub.metadata?.telegramUsername ||
        customer?.metadata?.telegramUsername ||
        null,
      telegramUserId:
        sub.metadata?.telegramUserId ||
        customer?.metadata?.telegramUserId ||
        null,
      planId,
      planLabel: planId ? FALLBACK_PLANS[planId].label : null,
      status,
      mrr: monthly,
      created: new Date(sub.created * 1000).toISOString(),
      cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
      inviteLink: sub.metadata?.telegramInviteLink?.trim() || null,
      source,
      currentPeriodEnd: periodEnd,
      dueAt: periodEnd,
      dueKind: periodEnd ? "stripe" : null,
      lastPaidAt: null,
      note,
      tags: collectStripeMemberTags({
        subscriptionMetadata: sub.metadata,
        customerMetadata: customer?.metadata,
        subscriptionDescription: sub.description,
        source,
      }),
    });
  }

  // Whop migrants have no Stripe subscriptions yet — extrapolate MRR/active
  // from Stripe Whop customers + latest paid invoice amount (monthly Season Pass).
  for (const whopMember of whopRecurring.members) {
    if (subCustomerIds.has(whopMember.id)) continue;
    members.push(whopMember);
    if (whopMember.status === "active" || whopMember.status === "trialing") {
      activeSubscribers += 1;
      mrr += whopMember.mrr;
      const entry = breakdownMap.get(whopMember.status) ?? {
        count: 0,
        amount: 0,
      };
      entry.count += 1;
      entry.amount += whopMember.mrr;
      breakdownMap.set(whopMember.status, entry);
    }
  }
  if (whopRecurring.payingMembers > 0) {
    const ps = planStats.month ?? { subscribers: 0, mrr: 0 };
    // Attribute extrapolated Whop paying run-rate under month plan bucket for catalog.
    ps.subscribers += whopRecurring.payingMembers;
    ps.mrr += whopRecurring.mrr;
    planStats.month = ps;
  }

  members.sort((a, b) => Date.parse(b.created) - Date.parse(a.created));
  mrr = Math.round(mrr * 100) / 100;

  const store = await getStoreCatalog({
    pathCounts: paths,
    subscriptionPlanCounts: planStats,
  });

  const available =
    balance.available.reduce((sum, b) => sum + b.amount, 0) / 100;
  const pending = balance.pending.reduce((sum, b) => sum + b.amount, 0) / 100;
  const currency = balance.available[0]?.currency ?? "usd";

  const earnings = { ...cardEarnings.earnings };
  if (proprEarnings > 0 && isLifetimeRange(rangeDays)) {
    earnings.cardBySource = [
      ...earnings.cardBySource,
      {
        source: "Referrals",
        amount: proprEarnings,
        count: proprReferrals?.purchases ?? 0,
      },
    ].sort((a, b) => b.amount - a.amount);
  }
  const series = revenueSeries.map((row) => ({ ...row }));
  const byCountry = new Map(
    earnings.cardByCountry.map((row) => [
      row.country,
      { amount: row.amount, count: row.count },
    ]),
  );
  const byPlan = new Map(
    earnings.cardByPlan.map((row) => [
      row.planId,
      { amount: row.amount, count: row.count },
    ]),
  );
  const bySource = new Map(
    earnings.cardBySource.map((row) => [
      row.source,
      { amount: row.amount, count: row.count },
    ]),
  );

  const rangeStart = new Date(todayStart);
  if (isLifetimeRange(rangeDays)) {
    rangeStart.setTime(0);
  } else {
    rangeStart.setUTCDate(rangeStart.getUTCDate() - (rangeDays - 1));
  }
  const rangeStartIsoDay = rangeStart.toISOString().slice(0, 10);
  const rangeEndIsoDay = todayStart.toISOString().slice(0, 10);
  const yesterdayIsoDay = yesterdayStart.toISOString().slice(0, 10);
  const todayIsoDay = rangeEndIsoDay;

  let whopToday = 0;
  let whopYesterday = 0;
  let whopRange = 0;
  try {
    // Stripe is source of truth — Whop history lives as paid invoices (metadata.source=whop).
    const whopPayments = await listWhopPaymentsFromStripe(300);
    const seriesMap = new Map(series.map((row) => [row.date, row.amount]));
    for (const payment of whopPayments) {
      if (payment.status !== "paid") continue;
      const day = new Date(payment.paidAt).toISOString().slice(0, 10);
      const usd = payment.amountUsd;
      if (day === todayIsoDay) whopToday += usd;
      if (day === yesterdayIsoDay) whopYesterday += usd;
      if (day < rangeStartIsoDay || day > rangeEndIsoDay) continue;
      // Fixed windows are pre-filled; lifetime may need Whop-only days added.
      if (!seriesMap.has(day) && !isLifetimeRange(rangeDays)) continue;
      seriesMap.set(day, (seriesMap.get(day) ?? 0) + usd);
      whopRange += usd;
      earnings.cardChargeCount += 1;

      const country = payment.country?.toUpperCase() || "XX";
      bumpBucket(byCountry, country, usd);
      const planKey = payment.description?.includes("Season Pass")
        ? "whop_season_pass"
        : "whop_other";
      bumpBucket(byPlan, planKey, usd);
      bumpBucket(bySource, "Whop", usd);
    }
    if (isLifetimeRange(rangeDays) && seriesMap.size > 0) {
      const keys = [...seriesMap.keys()].sort();
      const cursor = new Date(`${keys[0]}T00:00:00.000Z`);
      const endMs = todayStart.getTime();
      const rebuilt: { date: string; amount: number }[] = [];
      while (cursor.getTime() <= endMs) {
        const date = cursor.toISOString().slice(0, 10);
        rebuilt.push({ date, amount: seriesMap.get(date) ?? 0 });
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
      series.length = 0;
      series.push(...rebuilt);
    } else {
      for (let i = 0; i < series.length; i += 1) {
        const date = series[i]!.date;
        series[i] = { date, amount: seriesMap.get(date) ?? series[i]!.amount };
      }
    }
  } catch {
    // Stripe search may be unavailable; card charges still render.
  }

  const sortAmount = (
    entries: [string, { amount: number; count: number }][],
  ) =>
    entries
      .map(([key, value]) => ({ key, ...value }))
      .sort((a, b) => b.amount - a.amount);

  earnings.cardByCountry = sortAmount([...byCountry.entries()]).map((row) => ({
    country: row.key,
    amount: row.amount,
    count: row.count,
  }));
  earnings.cardByPlan = sortAmount([...byPlan.entries()]).map((row) => ({
    planId: row.key,
    amount: row.amount,
    count: row.count,
  }));
  earnings.cardBySource = sortAmount([...bySource.entries()]).map((row) => ({
    source: row.key,
    amount: row.amount,
    count: row.count,
  }));

  const todayGross = todayCharges.total + whopToday;
  const yesterdayGross = yesterdayCharges.total + whopYesterday;
  const mergedPctChange =
    yesterdayGross > 0
      ? ((todayGross - yesterdayGross) / yesterdayGross) * 100
      : todayGross > 0
        ? 100
        : null;

  const stripeRangeGross =
    series.reduce((sum, d) => sum + d.amount, 0) || whopRange;
  // Lifetime window includes Propr referral earnings alongside Stripe gross.
  const rangeGross = isLifetimeRange(rangeDays)
    ? stripeRangeGross + proprEarnings
    : stripeRangeGross;

  return {
    generatedAt: new Date().toISOString(),
    rangeDays,
    stripeConfigured: true,
    today: {
      grossRevenue: todayGross,
      yesterdayGross,
      pctChange: mergedPctChange,
      hourly: todayCharges.hourly,
    },
    balance: {
      available,
      pending,
      currency,
    },
    mrr,
    arr: mrr * 12,
    activeSubscribers,
    paymentsBreakdown: [...breakdownMap.entries()]
      .map(([status, value]) => ({ status, ...value }))
      .sort((a, b) => b.amount - a.amount),
    revenueSeries: series,
    trafficSource,
    traffic,
    countries,
    paths,
    people,
    members: members.slice(0, 200),
    store,
    crypto,
    rangeGross,
    allTimeRevenue,
    stripeAllTimeRevenue,
    proprReferrals,
    rangeUniques,
    rangePageviews,
    earnings,
  };
}
