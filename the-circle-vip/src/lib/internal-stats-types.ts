import type {
  CryptoFunnelStats,
  StorePlanRow,
  VisitorProfile,
} from "@/lib/analytics-types";

/** `0` = lifetime / all-time window. */
export type DashboardRange = 0 | 1 | 7 | 14 | 30 | 90;

/** Default Monetise timeframe: today vs yesterday. */
export const DEFAULT_DASHBOARD_RANGE: DashboardRange = 1;

/** All-time earnings / volume window. */
export const LIFETIME_DASHBOARD_RANGE: DashboardRange = 0;

export function isLifetimeRange(days: number): days is 0 {
  return days === 0;
}

export type MemberDueKind = "stripe" | "whop_estimate";

export type StripeMemberRow = {
  id: string;
  /**
   * Stripe customer id when known.
   * Native subs: `cus_…` from the subscription customer.
   * Whop migrants: same as `id` (row is keyed by customer).
   */
  customerId: string | null;
  email: string | null;
  name: string | null;
  telegramUsername: string | null;
  telegramUserId: string | null;
  planId: string | null;
  planLabel: string | null;
  status: string;
  mrr: number;
  created: string;
  cancelAtPeriodEnd: boolean;
  /** Single-use Telegram invite stored on the subscription. */
  inviteLink: string | null;
  /** checkout | manual_grant | crypto | etc. */
  source: string | null;
  /**
   * Next access/billing boundary used for renewals + payment-due warnings.
   * Stripe native = `current_period_end`. Whop migrants = last paid + 30d estimate.
   */
  currentPeriodEnd: string | null;
  /** Canonical next payment / renew-by date (same as currentPeriodEnd today). */
  dueAt: string | null;
  /** How `dueAt` was derived — Whop estimates need manual verification. */
  dueKind: MemberDueKind | null;
  /** Latest paid Whop invoice timestamp when known. */
  lastPaidAt: string | null;
  note: string | null;
  /**
   * Stripe metadata tags (e.g. Whop, Early customer discount) plus derived
   * claim / description labels for Memberships · People · Payments due.
   */
  tags: string[];
};

export type InternalDashboardStats = {
  generatedAt: string;
  rangeDays: DashboardRange;
  stripeConfigured: boolean;
  today: {
    grossRevenue: number;
    yesterdayGross: number;
    pctChange: number | null;
    hourly: { hour: number; amount: number }[];
  };
  balance: {
    available: number;
    pending: number;
    currency: string;
  };
  mrr: number;
  arr: number;
  activeSubscribers: number;
  paymentsBreakdown: {
    status: string;
    count: number;
    amount: number;
  }[];
  revenueSeries: { date: string; amount: number }[];
  /**
   * Impressions / uniques SoT for Home — prefers Cloudflare Zone Analytics
   * (same as Traffic History) when the GraphQL token is configured.
   */
  trafficSource: "cloudflare" | "first_party";
  traffic: {
    series: {
      date: string;
      pageviews: number;
      uniques: number;
      byCountry: Record<string, number>;
      byPath: Record<string, number>;
    }[];
    today: {
      date: string;
      pageviews: number;
      uniques: number;
      byCountry: Record<string, number>;
      byPath: Record<string, number>;
    };
    yesterday: {
      date: string;
      pageviews: number;
      uniques: number;
      byCountry: Record<string, number>;
      byPath: Record<string, number>;
    };
  };
  countries: { country: string; pageviews: number }[];
  paths: { path: string; pageviews: number }[];
  people: VisitorProfile[];
  members: StripeMemberRow[];
  store: StorePlanRow[];
  crypto: CryptoFunnelStats;
  rangeGross: number;
  /** Lifetime income: Stripe paid invoices + Propr referral earnings. */
  allTimeRevenue: number;
  /** Stripe-only lifetime paid invoices (before Propr overlay). */
  stripeAllTimeRevenue: number;
  /** Bundled Propr partner referral totals (USD attributed). */
  proprReferrals: {
    volume: number;
    earnings: number;
    availableToClaim: number;
    signups: number;
    purchases: number;
  } | null;
  rangeUniques: number;
  rangePageviews: number;
  /** Card charge insights for the Earnings surface. */
  earnings: {
    cardChargeCount: number;
    cardByCountry: { country: string; amount: number; count: number }[];
    cardByPlan: { planId: string; amount: number; count: number }[];
    cardBySource: { source: string; amount: number; count: number }[];
  };
};
