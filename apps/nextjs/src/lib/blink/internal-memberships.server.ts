import { desc } from "drizzle-orm";

import { db } from "@acme/db/client";
import { toIsoTimestamp } from "@acme/db/serialize-timestamp";
import {
  BlinkMembership,
  ReferralCode,
  TwitterConnection,
  UserProfile,
} from "@acme/db/schema";

import { LIFETIME_MEMBERSHIP_END } from "./gift-membership.server";
import type {
  InternalMembershipRevenueForecast,
  InternalMembershipRow,
  InternalMembershipSummary,
  MembershipForecastScenario,
  MembershipForecastTierRow,
  MembershipLifecycle,
} from "./internal-memberships.types";
import {
  DAY_MS,
  isMembershipEntitledStatus,
  isStripeTrialMembership,
} from "./membership-trial.server";

export type {
  InternalMembershipRevenueForecast,
  InternalMembershipRow,
  InternalMembershipSummary,
  MembershipForecastScenario,
  MembershipForecastTierRow,
  MembershipLifecycle,
  StripeBillingSnapshot,
  StripeBillingTransaction,
  StripeMembershipSyncSummary,
} from "./internal-memberships.types";

export { isMembershipEntitledStatus, isStripeTrialMembership } from "./membership-trial.server";

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

function estimateTierListMonthlyUsd(tier: string) {
  return PRO_MONTHLY_USD[tier.trim().toLowerCase()] ?? 0;
}

export function buildMembershipRevenueForecast(
  rows: InternalMembershipRow[],
  currentMrrUsd: number,
): InternalMembershipRevenueForecast {
  const now = Date.now();
  const sevenDaysMs = 7 * DAY_MS;
  const activeTrials = rows.filter((row) => row.isActive && row.isTrial);

  const trialPipelineMrrUsd = activeTrials.reduce(
    (sum, row) => sum + estimateTierListMonthlyUsd(row.tier),
    0,
  );

  const trialsEndingWithin7d = activeTrials.filter((row) => {
    if (!row.currentPeriodEnd) return false;
    const endMs = new Date(row.currentPeriodEnd).getTime();
    return endMs > now && endMs - now <= sevenDaysMs;
  });

  const pipelineEndingWithin7dMrrUsd = trialsEndingWithin7d.reduce(
    (sum, row) => sum + estimateTierListMonthlyUsd(row.tier),
    0,
  );

  const tierKeys = ["basic", "preferred", "premium"] as const;
  const mrrByTier: MembershipForecastTierRow[] = tierKeys
    .map((tier) => {
      const tierRows = rows.filter(
        (row) => row.isActive && row.tier.toLowerCase() === tier,
      );
      const payingRows = tierRows.filter(
        (row) => !row.isTrial && row.paymentMethod !== "gift",
      );
      const trialRows = tierRows.filter((row) => row.isTrial);

      return {
        tier,
        label:
          tier === "preferred"
            ? "Preferred"
            : tier === "premium"
              ? "Premium"
              : "Basic",
        payingCount: payingRows.length,
        trialCount: trialRows.length,
        mrrUsd: payingRows.reduce(
          (sum, row) =>
            sum +
            estimateMembershipMonthlyUsd({
              tier: row.tier,
              status: row.status,
              paymentMethod: row.paymentMethod,
              stripeCustomerId: row.stripeCustomerId,
              stripeSubscriptionId: row.stripeSubscriptionId,
              createdAt: new Date(row.createdAt),
              currentPeriodEnd: row.currentPeriodEnd
                ? new Date(row.currentPeriodEnd)
                : null,
            }),
          0,
        ),
        pipelineMrrUsd: trialRows.reduce(
          (sum, row) => sum + estimateTierListMonthlyUsd(row.tier),
          0,
        ),
      };
    })
    .filter((row) => row.payingCount > 0 || row.trialCount > 0);

  const scenarioDefs: Array<{
    id: MembershipForecastScenario["id"];
    label: string;
    trialConversionRate: number;
  }> = [
    { id: "conservative", label: "Conservative", trialConversionRate: 0.25 },
    { id: "base", label: "Base", trialConversionRate: 0.5 },
    { id: "upside", label: "Upside", trialConversionRate: 1 },
  ];

  const scenarios: MembershipForecastScenario[] = scenarioDefs.map(
    (scenario) => {
      const upliftUsd = trialPipelineMrrUsd * scenario.trialConversionRate;
      return {
        id: scenario.id,
        label: scenario.label,
        horizonLabel: "Steady-state MRR",
        trialConversionRate: scenario.trialConversionRate,
        projectedMrrUsd: currentMrrUsd + upliftUsd,
        upliftUsd,
      };
    },
  );

  return {
    currentMrrUsd,
    arrUsd: currentMrrUsd * 12,
    trialPipelineMrrUsd,
    trialsEndingWithin7d: trialsEndingWithin7d.length,
    pipelineEndingWithin7dMrrUsd,
    mrrByTier,
    scenarios,
    assumptions: [
      "Paying MRR excludes gifts and active trials; yearly plans are normalized to monthly.",
      "Trial pipeline uses list monthly price per tier if every trial converts.",
      "Scenarios apply conversion rates to the full active trial pipeline (no churn modeled).",
      "Near-term row highlights trials ending in the next 7 days.",
    ],
  };
}

export function tierProductLabel(tier: string) {
  const normalized = tier.trim().toLowerCase();
  if (normalized === "preferred") return "Blink Pro · Preferred";
  if (normalized === "premium") return "Blink Pro · Premium";
  return "Blink Pro · Basic";
}

function isLifetimePeriodEnd(value: Date | null) {
  if (!value) return false;
  return value.getTime() >= LIFETIME_MEMBERSHIP_END.getTime() - DAY_MS;
}

function inferBillingIntervalMonths(
  createdAt: Date,
  currentPeriodEnd: Date | null,
) {
  if (!currentPeriodEnd) return 1;
  const periodDays =
    (currentPeriodEnd.getTime() - createdAt.getTime()) / DAY_MS;
  if (periodDays > 45) return 12;
  return 1;
}

export function estimateMembershipMonthlyUsd(membership: {
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

  const intervalMonths = inferBillingIntervalMonths(
    membership.createdAt,
    membership.currentPeriodEnd,
  );
  if (intervalMonths >= 12) {
    const yearly = PRO_YEARLY_USD[tier] ?? monthly * 12;
    return yearly / 12;
  }

  return monthly;
}

export function estimateMembershipTotalSpendUsd(membership: {
  tier: string;
  paymentMethod: string;
  createdAt: Date;
  currentPeriodEnd: Date | null;
  status: string;
}) {
  if (membership.paymentMethod === "gift") return 0;

  const monthly = estimateMembershipMonthlyUsd(membership);
  if (!monthly) return 0;

  const now = Date.now();
  const periodEnd = membership.currentPeriodEnd?.getTime() ?? now;
  const effectiveEnd =
    membership.status === "active"
      ? Math.min(now, periodEnd)
      : Math.min(now, periodEnd);
  const spanMs = Math.max(0, effectiveEnd - membership.createdAt.getTime());
  const billedMonths = Math.max(1, Math.ceil(spanMs / (30 * DAY_MS)));
  const intervalMonths = inferBillingIntervalMonths(
    membership.createdAt,
    membership.currentPeriodEnd,
  );

  if (intervalMonths >= 12) {
    const yearly = PRO_YEARLY_USD[membership.tier.toLowerCase()] ?? monthly * 12;
    return Math.ceil(billedMonths / 12) * yearly;
  }

  return billedMonths * monthly;
}

function formatRelativeFuture(targetMs: number, nowMs: number) {
  const diff = targetMs - nowMs;
  if (diff <= 0) return "now";

  const days = Math.ceil(diff / DAY_MS);
  if (days < 2) return "1 day";
  if (days < 14) return `${days} days`;
  const weeks = Math.ceil(days / 7);
  if (weeks < 8) return `${weeks} weeks`;
  const months = Math.ceil(days / 30);
  return `${months} months`;
}

function formatRelativePast(targetMs: number, nowMs: number) {
  const diff = nowMs - targetMs;
  if (diff <= 0) return "just now";

  const days = Math.floor(diff / DAY_MS);
  if (days < 1) return "today";
  if (days === 1) return "1 day ago";
  if (days < 14) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 8) return `${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  return `${months} months ago`;
}

export function describeMembershipLifecycle(membership: {
  status: string;
  paymentMethod: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  createdAt: Date;
  currentPeriodEnd: Date | null;
}): { lifecycle: MembershipLifecycle; statusLabel: string; isActive: boolean } {
  const now = Date.now();
  const periodEndMs = membership.currentPeriodEnd?.getTime() ?? null;
  const isPeriodActive = periodEndMs === null || periodEndMs > now;
  const isActive = isMembershipEntitledStatus(membership.status) && isPeriodActive;

  if (membership.paymentMethod === "gift") {
    if (isLifetimePeriodEnd(membership.currentPeriodEnd)) {
      return {
        lifecycle: "lifetime",
        statusLabel: "Lifetime gift",
        isActive,
      };
    }

    if (isActive && periodEndMs) {
      return {
        lifecycle: "gift",
        statusLabel: `Gift · ${formatRelativeFuture(periodEndMs, now)} left`,
        isActive: true,
      };
    }

    return {
      lifecycle: "ended",
      statusLabel: periodEndMs
        ? `Gift ended ${formatRelativePast(periodEndMs, now)}`
        : "Gift ended",
      isActive: false,
    };
  }

  const isTrial = isStripeTrialMembership(membership);

  if (isTrial && isActive) {
    return {
      lifecycle: "trial",
      statusLabel: periodEndMs
        ? `Trial · ${formatRelativeFuture(periodEndMs, now)} left`
        : "Trial",
      isActive: true,
    };
  }

  if (isTrial && !isActive) {
    return {
      lifecycle: "ended",
      statusLabel: periodEndMs
        ? `Trial ended ${formatRelativePast(periodEndMs, now)}`
        : "Trial ended",
      isActive: false,
    };
  }

  if (!isActive) {
    return {
      lifecycle: "ended",
      statusLabel: periodEndMs
        ? `Ended ${formatRelativePast(periodEndMs, now)}`
        : membership.status === "canceled"
          ? "Canceled"
          : "Ended",
      isActive: false,
    };
  }

  if (isLifetimePeriodEnd(membership.currentPeriodEnd)) {
    return {
      lifecycle: "lifetime",
      statusLabel: "Lifetime",
      isActive: true,
    };
  }

  if (periodEndMs) {
    const daysLeft = Math.ceil((periodEndMs - now) / DAY_MS);
    if (daysLeft <= 7) {
      return {
        lifecycle: "expires_soon",
        statusLabel: `Expires in ${formatRelativeFuture(periodEndMs, now)}`,
        isActive: true,
      };
    }

    return {
      lifecycle: "active",
      statusLabel: `Renews in ${formatRelativeFuture(periodEndMs, now)}`,
      isActive: true,
    };
  }

  return {
    lifecycle: "active",
    statusLabel: "Active",
    isActive: true,
  };
}

export function applyStripeSpendToMembershipRows(
  rows: InternalMembershipRow[],
  customerSpendUsd: Record<string, number>,
) {
  return rows.map((row) => {
    if (!row.stripeCustomerId || row.paymentMethod === "gift") {
      return row;
    }

    const stripeSpend = customerSpendUsd[row.stripeCustomerId];
    if (stripeSpend === undefined) return row;

    return {
      ...row,
      totalSpendUsd: Math.max(row.totalSpendUsd, stripeSpend),
    };
  });
}

export async function listInternalMembershipRows(options?: {
  customerSpendUsd?: Record<string, number>;
  stripeMrrUsd?: number;
  stripeTrialMrrUsd?: number;
}): Promise<{
  rows: InternalMembershipRow[];
  summary: InternalMembershipSummary;
  forecast: InternalMembershipRevenueForecast;
}> {
  const [membershipRows, profileRows, codeRows, twitterRows] = await Promise.all([
    db
      .select({
        walletAddress: BlinkMembership.walletAddress,
        tier: BlinkMembership.tier,
        status: BlinkMembership.status,
        paymentMethod: BlinkMembership.paymentMethod,
        stripeCustomerId: BlinkMembership.stripeCustomerId,
        stripeSubscriptionId: BlinkMembership.stripeSubscriptionId,
        currentPeriodEnd: BlinkMembership.currentPeriodEnd,
        createdAt: BlinkMembership.createdAt,
        updatedAt: BlinkMembership.updatedAt,
      })
      .from(BlinkMembership)
      .orderBy(desc(BlinkMembership.updatedAt), desc(BlinkMembership.createdAt)),
    db
      .select({
        walletAddress: UserProfile.walletAddress,
        displayName: UserProfile.displayName,
      })
      .from(UserProfile),
    db
      .select({
        walletAddress: ReferralCode.walletAddress,
        code: ReferralCode.code,
      })
      .from(ReferralCode),
    db
      .select({
        walletAddress: TwitterConnection.walletAddress,
        twitterUsername: TwitterConnection.twitterUsername,
      })
      .from(TwitterConnection),
  ]);

  const profileByWallet = new Map(
    profileRows.map((row) => [row.walletAddress, row.displayName]),
  );
  const codeByWallet = new Map(
    codeRows.map((row) => [row.walletAddress, row.code]),
  );
  const twitterByWallet = new Map(
    twitterRows.map((row) => [row.walletAddress, row.twitterUsername]),
  );

  const mappedRows: InternalMembershipRow[] = membershipRows.map((row) => {
    const createdAt = row.createdAt;
    const isTrial = isStripeTrialMembership({
      status: row.status,
      paymentMethod: row.paymentMethod,
      stripeCustomerId: row.stripeCustomerId,
      stripeSubscriptionId: row.stripeSubscriptionId,
      createdAt,
      currentPeriodEnd: row.currentPeriodEnd,
    });
    const lifecycle = describeMembershipLifecycle({
      status: row.status,
      paymentMethod: row.paymentMethod,
      stripeCustomerId: row.stripeCustomerId,
      stripeSubscriptionId: row.stripeSubscriptionId,
      createdAt,
      currentPeriodEnd: row.currentPeriodEnd,
    });

    const isEnded = !lifecycle.isActive;

    return {
      walletAddress: row.walletAddress,
      displayName: profileByWallet.get(row.walletAddress) ?? null,
      profileSlug: codeByWallet.get(row.walletAddress) ?? null,
      twitterUsername: twitterByWallet.get(row.walletAddress) ?? null,
      tier: row.tier,
      productLabel: isTrial
        ? `${tierProductLabel(row.tier)} · Trial`
        : tierProductLabel(row.tier),
      status: row.status,
      lifecycle: lifecycle.lifecycle,
      statusLabel: lifecycle.statusLabel,
      paymentMethod: row.paymentMethod,
      stripeCustomerId: row.stripeCustomerId,
      stripeSubscriptionId: row.stripeSubscriptionId,
      totalSpendUsd: isTrial
        ? 0
        : estimateMembershipTotalSpendUsd({
            tier: row.tier,
            paymentMethod: row.paymentMethod,
            createdAt,
            currentPeriodEnd: row.currentPeriodEnd,
            status: row.status,
          }),
      createdAt: toIsoTimestamp(createdAt) ?? new Date().toISOString(),
      currentPeriodEnd: toIsoTimestamp(row.currentPeriodEnd),
      updatedAt: toIsoTimestamp(row.updatedAt),
      canceledAt: isEnded ? toIsoTimestamp(row.updatedAt) : null,
      isActive: lifecycle.isActive,
      isTrial,
    };
  });

  const rows = options?.customerSpendUsd
    ? applyStripeSpendToMembershipRows(mappedRows, options.customerSpendUsd)
    : mappedRows;

  const activeRows = rows.filter((row) => row.isActive);
  const trialRows = activeRows.filter((row) => row.isTrial);
  const payingRows = activeRows.filter(
    (row) => row.paymentMethod !== "gift" && !row.isTrial,
  );
  const giftedRows = activeRows.filter((row) => row.paymentMethod === "gift");
  const mrrUsd = payingRows.reduce(
    (sum, row) =>
      sum +
      estimateMembershipMonthlyUsd({
        tier: row.tier,
        status: row.status,
        paymentMethod: row.paymentMethod,
        stripeCustomerId: row.stripeCustomerId,
        stripeSubscriptionId: row.stripeSubscriptionId,
        createdAt: new Date(row.createdAt),
        currentPeriodEnd: row.currentPeriodEnd
          ? new Date(row.currentPeriodEnd)
          : null,
      }),
    0,
  );

  const stripeMrrUsd = options?.stripeMrrUsd;
  const headlineMrrUsd = stripeMrrUsd ?? mrrUsd;

  const summary: InternalMembershipSummary = {
    total: rows.length,
    active: activeRows.length,
    paying: payingRows.length,
    trials: trialRows.length,
    gifted: giftedRows.length,
    mrrUsd: headlineMrrUsd,
  };

  const forecast = buildMembershipRevenueForecast(rows, headlineMrrUsd);
  if (stripeMrrUsd !== undefined) {
    forecast.stripeMrrUsd = stripeMrrUsd;
    forecast.stripeArrUsd = stripeMrrUsd * 12;
    forecast.stripeTrialMrrUsd = options?.stripeTrialMrrUsd;
  }

  return {
    rows,
    summary,
    forecast,
  };
}
