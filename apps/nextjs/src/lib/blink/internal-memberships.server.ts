import { desc } from "drizzle-orm";

import { db } from "@acme/db/client";
import {
  BlinkMembership,
  ReferralCode,
  TwitterConnection,
  UserProfile,
} from "@acme/db/schema";

import { LIFETIME_MEMBERSHIP_END } from "./gift-membership.server";

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

const DAY_MS = 24 * 60 * 60 * 1000;

export type MembershipLifecycle =
  | "active"
  | "expires_soon"
  | "gift"
  | "lifetime"
  | "ended"
  | "inactive";

export type InternalMembershipRow = {
  walletAddress: string;
  displayName: string | null;
  profileSlug: string | null;
  twitterUsername: string | null;
  tier: string;
  productLabel: string;
  status: string;
  lifecycle: MembershipLifecycle;
  statusLabel: string;
  paymentMethod: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  totalSpendUsd: number;
  createdAt: string;
  currentPeriodEnd: string | null;
  updatedAt: string | null;
  canceledAt: string | null;
  isActive: boolean;
};

export type InternalMembershipSummary = {
  total: number;
  active: number;
  paying: number;
  gifted: number;
  mrrUsd: number;
};

function tierProductLabel(tier: string) {
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
  paymentMethod: string;
  createdAt: Date;
  currentPeriodEnd: Date | null;
}) {
  if (membership.paymentMethod === "gift") return 0;

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
  currentPeriodEnd: Date | null;
}): { lifecycle: MembershipLifecycle; statusLabel: string; isActive: boolean } {
  const now = Date.now();
  const periodEndMs = membership.currentPeriodEnd?.getTime() ?? null;
  const isPeriodActive = periodEndMs === null || periodEndMs > now;
  const isActive =
    membership.status === "active" && isPeriodActive;

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

export async function listInternalMembershipRows(): Promise<{
  rows: InternalMembershipRow[];
  summary: InternalMembershipSummary;
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

  const rows: InternalMembershipRow[] = membershipRows.map((row) => {
    const lifecycle = describeMembershipLifecycle({
      status: row.status,
      paymentMethod: row.paymentMethod,
      currentPeriodEnd: row.currentPeriodEnd,
    });

    const createdAt = row.createdAt;
    const isEnded = !lifecycle.isActive;

    return {
      walletAddress: row.walletAddress,
      displayName: profileByWallet.get(row.walletAddress) ?? null,
      profileSlug: codeByWallet.get(row.walletAddress) ?? null,
      twitterUsername: twitterByWallet.get(row.walletAddress) ?? null,
      tier: row.tier,
      productLabel: tierProductLabel(row.tier),
      status: row.status,
      lifecycle: lifecycle.lifecycle,
      statusLabel: lifecycle.statusLabel,
      paymentMethod: row.paymentMethod,
      stripeCustomerId: row.stripeCustomerId,
      stripeSubscriptionId: row.stripeSubscriptionId,
      totalSpendUsd: estimateMembershipTotalSpendUsd({
        tier: row.tier,
        paymentMethod: row.paymentMethod,
        createdAt,
        currentPeriodEnd: row.currentPeriodEnd,
        status: row.status,
      }),
      createdAt: createdAt.toISOString(),
      currentPeriodEnd: row.currentPeriodEnd?.toISOString() ?? null,
      updatedAt: row.updatedAt?.toISOString() ?? null,
      canceledAt: isEnded ? (row.updatedAt?.toISOString() ?? null) : null,
      isActive: lifecycle.isActive,
    };
  });

  const activeRows = rows.filter((row) => row.isActive);
  const payingRows = activeRows.filter((row) => row.paymentMethod !== "gift");
  const giftedRows = activeRows.filter((row) => row.paymentMethod === "gift");
  const mrrUsd = payingRows.reduce(
    (sum, row) =>
      sum +
      estimateMembershipMonthlyUsd({
        tier: row.tier,
        paymentMethod: row.paymentMethod,
        createdAt: new Date(row.createdAt),
        currentPeriodEnd: row.currentPeriodEnd
          ? new Date(row.currentPeriodEnd)
          : null,
      }),
    0,
  );

  return {
    rows,
    summary: {
      total: rows.length,
      active: activeRows.length,
      paying: payingRows.length,
      gifted: giftedRows.length,
      mrrUsd,
    },
  };
}
