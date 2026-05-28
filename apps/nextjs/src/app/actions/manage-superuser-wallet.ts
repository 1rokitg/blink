"use server";

import { and, count, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { z } from "zod";

import { db } from "@acme/db/client";
import {
  BlinkMembership,
  BuilderApproval,
  Follow,
  InternalRole,
  MetricEvent,
  Referral,
  ReferralCode,
  TwitterConnection,
  UserProfile,
} from "@acme/db/schema";

import {
  type BlinkRole,
  getWalletRoleFromDb,
  grantInternalRole,
} from "~/lib/blink/admin-roles.server";
import { BUILDER_ADDRESS, builderMaxFeeRate } from "~/lib/blink/builder";
import { upsertGiftBlinkMembership } from "~/lib/blink/gift-membership.server";
import { infoClient } from "~/lib/blink/hyperliquid";

const walletSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const referralCodeSchema = z
  .string()
  .min(3)
  .max(32)
  .regex(/^[a-zA-Z0-9._-]+$/);

const lookupSchema = z.object({
  actingWalletAddress: walletSchema,
  query: z.string().min(3).max(64),
});

const roleSchema = z.object({
  actingWalletAddress: walletSchema,
  note: z.string().max(255).optional(),
  role: z.enum(["viewer", "admin", "superuser"]),
  targetWalletAddress: walletSchema,
});

const referralSchema = z.object({
  actingWalletAddress: walletSchema,
  code: referralCodeSchema,
  targetWalletAddress: walletSchema,
});

const membershipSchema = z.object({
  actingWalletAddress: walletSchema,
  durationDays: z.union([
    z.literal(30),
    z.literal(90),
    z.literal(365),
    z.literal("lifetime"),
  ]),
  targetWalletAddress: walletSchema,
  tier: z.enum(["basic", "preferred", "premium"]),
});

const builderApprovalSchema = z.object({
  actingWalletAddress: walletSchema,
  maxFeeRate: z
    .string()
    .regex(/^\d+(\.\d+)?%$/)
    .default(builderMaxFeeRate()),
  targetWalletAddress: walletSchema,
});

export type SuperuserWalletSnapshot = {
  appFingerprint: {
    eventCount: number;
    issueCount: number;
    lastSeenAt: string | null;
    recentCities: string[];
    recentCountries: string[];
    recentFingerprints: string[];
    recentIpAddresses: string[];
    recentPaths: string[];
    recentSessionIds: string[];
    recentSources: string[];
    recentUserAgents: string[];
    recentVisitorIds: string[];
  };
  builderApproval: {
    approvedAt: string;
    builderAddress: string;
    maxFeeRate: string;
    status: string;
  } | null;
  builderApprovals: Array<{
    approvedAt: string;
    builderAddress: string;
    maxFeeRate: string;
    status: string;
  }>;
  follows: {
    followers: number;
    following: number;
  };
  membership: {
    currentPeriodEnd: string | null;
    paymentMethod: string;
    status: string;
    tier: string;
    updatedAt: string | null;
  } | null;
  metrics: {
    builderApproved: boolean;
    firstTrade: boolean;
    proCheckoutStarted: boolean;
  };
  onchain: {
    accountValue: number;
    delegatedValue: number;
    marginUsed: number;
    openOrderCount: number;
    positionCount: number;
    recentFills: Array<{
      closedPnl: number;
      coin: string;
      fee: number;
      notionalUsd: number;
      px: number;
      side: string;
      size: number;
      time: string;
    }>;
    spotBalances: Array<{
      available: number;
      coin: string;
      hold: number;
      total: number;
    }>;
    spotEscrows: Array<{
      coin: string;
      total: number;
    }>;
    stakingDelegations: Array<{
      amount: number;
      lockedUntil: string | null;
      validator: string;
    }>;
    stakingSummary: {
      delegated: number;
      nPendingWithdrawals: number;
      totalPendingWithdrawal: number;
      undelegated: number;
    } | null;
    totalRealizedPnl: number;
    totalUnrealizedPnl: number;
    positions: Array<{
      coin: string;
      entryPx: number;
      liquidationPx: number | null;
      leverage: {
        type: string | null;
        value: number | null;
      } | null;
      marginUsed: number;
      positionValue: number;
      returnOnEquity: number;
      size: number;
      unrealizedPnl: number;
    }>;
    withdrawable: number;
    workingOrders: Array<{
      coin: string;
      isReduceOnly: boolean;
      limitPx: number;
      orderId: number | null;
      side: string;
      size: number;
      timestamp: string | null;
    }>;
  };
  query: string;
  recentEventLogs: Array<{
    city: string | null;
    code: string | null;
    country: string | null;
    createdAt: string;
    eventType: string;
    fingerprint: string | null;
    ipAddress: string | null;
    path: string | null;
    region: string | null;
    requestId: string | null;
    sessionId: string | null;
    source: string | null;
    summary: string | null;
    userAgent: string | null;
    visitorId: string | null;
  }>;
  recentReferrals: Array<{
    address: string;
    code: string;
    joinedAt: string;
  }>;
  referredCount: number;
  referredBy: {
    code: string;
    createdAt: string;
    referrerAddress: string;
  } | null;
  referralCode: string | null;
  resolvedBy: "referral-code" | "wallet";
  role: {
    grantedBy: string | null;
    note: string | null;
    role: BlinkRole;
    updatedAt: string | null;
  };
  twitter: {
    connectedAt: string;
    twitterName: string | null;
    twitterUsername: string;
  } | null;
  userProfile: {
    bio: string | null;
    displayName: string | null;
    ensName: string | null;
    isPro: boolean;
    joinedAt: string;
  } | null;
  walletAddress: string;
};

export type SuperuserSearchResult = {
  displayName: string | null;
  isPro: boolean;
  matchLabel: string;
  referralCode: string | null;
  role: BlinkRole;
  twitterUsername: string | null;
  walletAddress: string;
};

function normalizeWallet(walletAddress: string) {
  return walletAddress.trim().toLowerCase();
}

function toIsoTimestamp(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function getMetadataString(metadata: unknown, key: string): string | null {
  if (!metadata || typeof metadata !== "object") return null;

  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function uniqueRecentStrings(
  values: Array<string | null | undefined>,
  limit = 6,
) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (!value) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(value);
    if (result.length >= limit) break;
  }

  return result;
}

function numberOrZero(value: unknown) {
  const next = Number(value ?? 0);
  return Number.isFinite(next) ? next : 0;
}

async function assertSuperuser(actingWalletAddress: string) {
  const role = await getWalletRoleFromDb(actingWalletAddress);
  if (role !== "superuser") {
    throw new Error("Unauthorized");
  }
}

async function resolveTargetWallet(query: string) {
  const normalized = query.trim().toLowerCase();
  if (walletSchema.safeParse(normalized).success) {
    return {
      resolvedBy: "wallet" as const,
      walletAddress: normalized,
    };
  }

  const [codeRow] = await db
    .select({ walletAddress: ReferralCode.walletAddress })
    .from(ReferralCode)
    .where(eq(ReferralCode.code, normalized))
    .limit(1);

  if (!codeRow?.walletAddress) {
    return null;
  }

  return {
    resolvedBy: "referral-code" as const,
    walletAddress: codeRow.walletAddress.toLowerCase(),
  };
}

export async function searchSuperuserWallets(input: unknown) {
  const parsed = lookupSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("Invalid search payload");
  }

  const actingWalletAddress = normalizeWallet(parsed.data.actingWalletAddress);
  await assertSuperuser(actingWalletAddress);

  const normalizedQuery = parsed.data.query.trim().toLowerCase();
  const exactWalletMatch = walletSchema.safeParse(normalizedQuery).success
    ? normalizedQuery
    : null;
  const prefixPattern = `${normalizedQuery}%`;
  const partialPattern = `%${normalizedQuery}%`;

  const [profileRows, twitterRows, referralRows] = await Promise.all([
    db
      .select({
        displayName: UserProfile.displayName,
        ensName: UserProfile.ensName,
        isPro: UserProfile.isPro,
        walletAddress: UserProfile.walletAddress,
      })
      .from(UserProfile)
      .where(
        or(
          exactWalletMatch
            ? eq(UserProfile.walletAddress, exactWalletMatch)
            : undefined,
          ilike(UserProfile.walletAddress, prefixPattern),
          ilike(UserProfile.displayName, partialPattern),
          ilike(UserProfile.ensName, partialPattern),
        ),
      )
      .limit(8),
    db
      .select({
        twitterUsername: TwitterConnection.twitterUsername,
        walletAddress: TwitterConnection.walletAddress,
      })
      .from(TwitterConnection)
      .where(ilike(TwitterConnection.twitterUsername, partialPattern))
      .limit(8),
    db
      .select({
        code: ReferralCode.code,
        walletAddress: ReferralCode.walletAddress,
      })
      .from(ReferralCode)
      .where(
        or(
          eq(ReferralCode.code, normalizedQuery),
          ilike(ReferralCode.code, prefixPattern),
        ),
      )
      .limit(8),
  ]);

  const walletMatches = new Map<
    string,
    {
      displayName: string | null;
      isPro: boolean;
      matchLabel: string;
      referralCode: string | null;
      twitterUsername: string | null;
      walletAddress: string;
    }
  >();

  function upsertResult(
    walletAddress: string,
    next: Partial<SuperuserSearchResult> & { matchLabel: string },
  ) {
    const current = walletMatches.get(walletAddress);
    walletMatches.set(walletAddress, {
      displayName: next.displayName ?? current?.displayName ?? null,
      isPro: next.isPro ?? current?.isPro ?? false,
      matchLabel: next.matchLabel,
      referralCode: next.referralCode ?? current?.referralCode ?? null,
      twitterUsername: next.twitterUsername ?? current?.twitterUsername ?? null,
      walletAddress,
    });
  }

  for (const row of profileRows) {
    const matchSource =
      row.walletAddress === exactWalletMatch
        ? "Wallet"
        : row.displayName?.toLowerCase().includes(normalizedQuery)
          ? "Profile"
          : row.ensName?.toLowerCase().includes(normalizedQuery)
            ? "ENS"
            : "Wallet";

    upsertResult(row.walletAddress, {
      displayName: row.displayName ?? row.ensName ?? null,
      isPro: row.isPro,
      matchLabel: matchSource,
    });
  }

  for (const row of twitterRows) {
    upsertResult(row.walletAddress, {
      matchLabel: "X",
      twitterUsername: row.twitterUsername,
    });
  }

  for (const row of referralRows) {
    upsertResult(row.walletAddress, {
      matchLabel: row.code === normalizedQuery ? "Referral code" : "Referral",
      referralCode: row.code,
    });
  }

  if (walletMatches.size === 0) {
    return [] satisfies SuperuserSearchResult[];
  }

  const walletAddresses = [...walletMatches.keys()];
  const [codeRows, twitterMetaRows, profileMetaRows, membershipRows, roleRows] =
    await Promise.all([
      db
        .select({
          code: ReferralCode.code,
          walletAddress: ReferralCode.walletAddress,
        })
        .from(ReferralCode)
        .where(inArray(ReferralCode.walletAddress, walletAddresses)),
      db
        .select({
          twitterUsername: TwitterConnection.twitterUsername,
          walletAddress: TwitterConnection.walletAddress,
        })
        .from(TwitterConnection)
        .where(inArray(TwitterConnection.walletAddress, walletAddresses)),
      db
        .select({
          displayName: UserProfile.displayName,
          isPro: UserProfile.isPro,
          walletAddress: UserProfile.walletAddress,
        })
        .from(UserProfile)
        .where(inArray(UserProfile.walletAddress, walletAddresses)),
      db
        .select({
          status: BlinkMembership.status,
          walletAddress: BlinkMembership.walletAddress,
        })
        .from(BlinkMembership)
        .where(inArray(BlinkMembership.walletAddress, walletAddresses)),
      db
        .select({
          role: InternalRole.role,
          walletAddress: InternalRole.walletAddress,
        })
        .from(InternalRole)
        .where(inArray(InternalRole.walletAddress, walletAddresses)),
    ]);

  const codeByWallet = new Map(
    codeRows.map((row) => [row.walletAddress, row.code]),
  );
  const twitterByWallet = new Map(
    twitterMetaRows.map((row) => [row.walletAddress, row.twitterUsername]),
  );
  const profileByWallet = new Map(
    profileMetaRows.map((row) => [
      row.walletAddress,
      { displayName: row.displayName, isPro: row.isPro },
    ]),
  );
  const membershipByWallet = new Map(
    membershipRows.map((row) => [row.walletAddress, row.status]),
  );
  const explicitRoleByWallet = new Map(
    roleRows.map((row) => [row.walletAddress, row.role as BlinkRole]),
  );

  const results = await Promise.all(
    walletAddresses.map(async (walletAddress) => {
      const base = walletMatches.get(walletAddress);
      const explicitRole = explicitRoleByWallet.get(walletAddress);
      const fallbackRole =
        explicitRole ?? (await getWalletRoleFromDb(walletAddress));
      const profile = profileByWallet.get(walletAddress);

      return {
        displayName: profile?.displayName ?? base?.displayName ?? null,
        isPro:
          profile?.isPro === true ||
          membershipByWallet.get(walletAddress) === "active",
        matchLabel: base?.matchLabel ?? "Wallet",
        referralCode:
          codeByWallet.get(walletAddress) ?? base?.referralCode ?? null,
        role: fallbackRole,
        twitterUsername:
          twitterByWallet.get(walletAddress) ?? base?.twitterUsername ?? null,
        walletAddress,
      } satisfies SuperuserSearchResult;
    }),
  );

  return results
    .sort((left, right) => {
      const leftExact =
        left.walletAddress === exactWalletMatch ||
        left.referralCode?.toLowerCase() === normalizedQuery ||
        left.twitterUsername?.toLowerCase() === normalizedQuery;
      const rightExact =
        right.walletAddress === exactWalletMatch ||
        right.referralCode?.toLowerCase() === normalizedQuery ||
        right.twitterUsername?.toLowerCase() === normalizedQuery;

      if (leftExact !== rightExact) {
        return leftExact ? -1 : 1;
      }

      return left.walletAddress.localeCompare(right.walletAddress);
    })
    .slice(0, 12);
}

export async function getSuperuserWalletSnapshot(input: unknown) {
  const parsed = lookupSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("Invalid lookup payload");
  }

  const actingWalletAddress = normalizeWallet(parsed.data.actingWalletAddress);
  await assertSuperuser(actingWalletAddress);

  const resolved = await resolveTargetWallet(parsed.data.query);
  if (!resolved) {
    return null;
  }

  const walletAddress = resolved.walletAddress;
  const user = walletAddress as `0x${string}`;
  const fillsStartTime = Date.now() - 2 * 365 * 24 * 60 * 60 * 1000;
  const [role, roleRow, profileRow, twitterRow, approvalRow, membershipRow] =
    await Promise.all([
      getWalletRoleFromDb(walletAddress),
      db
        .select({
          grantedBy: InternalRole.grantedBy,
          note: InternalRole.note,
          role: InternalRole.role,
          updatedAt: InternalRole.updatedAt,
        })
        .from(InternalRole)
        .where(eq(InternalRole.walletAddress, walletAddress))
        .limit(1),
      db
        .select({
          bio: UserProfile.bio,
          displayName: UserProfile.displayName,
          ensName: UserProfile.ensName,
          isPro: UserProfile.isPro,
          joinedAt: UserProfile.joinedAt,
        })
        .from(UserProfile)
        .where(eq(UserProfile.walletAddress, walletAddress))
        .limit(1),
      db
        .select({
          connectedAt: TwitterConnection.connectedAt,
          twitterName: TwitterConnection.twitterName,
          twitterUsername: TwitterConnection.twitterUsername,
        })
        .from(TwitterConnection)
        .where(eq(TwitterConnection.walletAddress, walletAddress))
        .limit(1),
      db
        .select({
          approvedAt: BuilderApproval.approvedAt,
          builderAddress: BuilderApproval.builderAddress,
          maxFeeRate: BuilderApproval.maxFeeRate,
          status: BuilderApproval.status,
        })
        .from(BuilderApproval)
        .where(eq(BuilderApproval.walletAddress, walletAddress))
        .orderBy(desc(BuilderApproval.approvedAt))
        .limit(1),
      db
        .select({
          currentPeriodEnd: BlinkMembership.currentPeriodEnd,
          paymentMethod: BlinkMembership.paymentMethod,
          status: BlinkMembership.status,
          tier: BlinkMembership.tier,
          updatedAt: BlinkMembership.updatedAt,
        })
        .from(BlinkMembership)
        .where(eq(BlinkMembership.walletAddress, walletAddress))
        .limit(1),
    ]);

  const [
    referralCodeRow,
    referredByRow,
    recentReferrals,
    referredCountRows,
    followerCountRows,
    followingCountRows,
    metricRows,
    approvalHistoryRows,
    recentEventLogRows,
    totalEventCountRows,
    issueEventCountRows,
    accountState,
    frontendOpenOrders,
    fills,
    spotState,
    stakingSummary,
    stakingDelegations,
  ] = await Promise.all([
    db
      .select({ code: ReferralCode.code })
      .from(ReferralCode)
      .where(eq(ReferralCode.walletAddress, walletAddress))
      .limit(1),
    db
      .select({
        code: Referral.code,
        createdAt: Referral.createdAt,
        referrerAddress: Referral.referrerAddress,
      })
      .from(Referral)
      .where(eq(Referral.referredAddress, walletAddress))
      .limit(1),
    db
      .select({
        address: Referral.referredAddress,
        code: Referral.code,
        joinedAt: Referral.createdAt,
      })
      .from(Referral)
      .where(eq(Referral.referrerAddress, walletAddress))
      .orderBy(desc(Referral.createdAt))
      .limit(8),
    db
      .select({ count: count() })
      .from(Referral)
      .where(eq(Referral.referrerAddress, walletAddress)),
    db
      .select({ count: count() })
      .from(Follow)
      .where(eq(Follow.followingAddress, walletAddress)),
    db
      .select({ count: count() })
      .from(Follow)
      .where(eq(Follow.followerAddress, walletAddress)),
    db
      .select({ eventType: MetricEvent.eventType })
      .from(MetricEvent)
      .where(
        and(
          eq(MetricEvent.walletAddress, walletAddress),
          inArray(MetricEvent.eventType, [
            "builder_approved",
            "first_trade",
            "pro_checkout_started",
          ]),
        ),
      ),
    db
      .select({
        approvedAt: BuilderApproval.approvedAt,
        builderAddress: BuilderApproval.builderAddress,
        maxFeeRate: BuilderApproval.maxFeeRate,
        status: BuilderApproval.status,
      })
      .from(BuilderApproval)
      .where(eq(BuilderApproval.walletAddress, walletAddress))
      .orderBy(desc(BuilderApproval.approvedAt))
      .limit(8),
    db
      .select({
        createdAt: MetricEvent.createdAt,
        eventType: MetricEvent.eventType,
        metadata: MetricEvent.metadata,
        requestId: MetricEvent.requestId,
        sessionId: MetricEvent.sessionId,
        source: MetricEvent.source,
        visitorId: MetricEvent.visitorId,
      })
      .from(MetricEvent)
      .where(eq(MetricEvent.walletAddress, walletAddress))
      .orderBy(desc(MetricEvent.createdAt))
      .limit(40),
    db
      .select({ count: count() })
      .from(MetricEvent)
      .where(eq(MetricEvent.walletAddress, walletAddress)),
    db
      .select({ count: count() })
      .from(MetricEvent)
      .where(
        and(
          eq(MetricEvent.walletAddress, walletAddress),
          inArray(MetricEvent.eventType, ["issue_auto", "issue_feedback"]),
        ),
      ),
    infoClient.clearinghouseState({ user }).catch(() => null),
    infoClient.frontendOpenOrders({ user }).catch(() => []),
    infoClient
      .userFillsByTime({
        user,
        startTime: fillsStartTime,
      })
      .catch(() => []),
    infoClient.spotClearinghouseState({ user }).catch(() => null),
    infoClient.delegatorSummary({ user }).catch(() => null),
    infoClient.delegations({ user }).catch(() => []),
  ]);

  const eventTypes = new Set(metricRows.map((row) => row.eventType));
  const recentEventLogs = recentEventLogRows.map((row) => {
    const metadata = row.metadata;

    return {
      city: getMetadataString(metadata, "city"),
      code: getMetadataString(metadata, "code"),
      country: getMetadataString(metadata, "country"),
      createdAt: toIsoTimestamp(row.createdAt) ?? new Date().toISOString(),
      eventType: row.eventType,
      fingerprint: getMetadataString(metadata, "fingerprint"),
      ipAddress: getMetadataString(metadata, "ipAddress"),
      path: getMetadataString(metadata, "path"),
      region: getMetadataString(metadata, "region"),
      requestId: row.requestId,
      sessionId: row.sessionId,
      source: row.source ?? null,
      summary: getMetadataString(metadata, "summary"),
      userAgent: getMetadataString(metadata, "userAgent"),
      visitorId: row.visitorId,
    };
  });
  const seenApprovalKeys = new Set<string>();
  const builderApprovals = approvalHistoryRows
    .map((row) => ({
      approvedAt: toIsoTimestamp(row.approvedAt) ?? new Date().toISOString(),
      builderAddress: row.builderAddress,
      maxFeeRate: row.maxFeeRate,
      status: row.status,
    }))
    .filter((row) => {
      const key = `${row.approvedAt}|${row.maxFeeRate}|${row.status}|${row.builderAddress}`;
      if (seenApprovalKeys.has(key)) return false;
      seenApprovalKeys.add(key);
      return true;
    });
  const appFingerprint = {
    eventCount: totalEventCountRows[0]?.count ?? 0,
    issueCount: issueEventCountRows[0]?.count ?? 0,
    lastSeenAt: recentEventLogs[0]?.createdAt ?? null,
    recentCities: uniqueRecentStrings(recentEventLogs.map((row) => row.city)),
    recentCountries: uniqueRecentStrings(
      recentEventLogs.map((row) => row.country),
    ),
    recentFingerprints: uniqueRecentStrings(
      recentEventLogs.map((row) => row.fingerprint),
    ),
    recentIpAddresses: uniqueRecentStrings(
      recentEventLogs.map((row) => row.ipAddress),
    ),
    recentPaths: uniqueRecentStrings(recentEventLogs.map((row) => row.path)),
    recentSessionIds: uniqueRecentStrings(
      recentEventLogs.map((row) => row.sessionId),
    ),
    recentSources: uniqueRecentStrings(
      recentEventLogs.map((row) => row.source),
    ),
    recentUserAgents: uniqueRecentStrings(
      recentEventLogs.map((row) => row.userAgent),
      4,
    ),
    recentVisitorIds: uniqueRecentStrings(
      recentEventLogs.map((row) => row.visitorId),
    ),
  };
  const positions = (accountState?.assetPositions ?? [])
    .map((entry) => entry.position)
    .filter((position) => numberOrZero(position.szi) !== 0);
  const workingOrders = (frontendOpenOrders ?? []).map((order) => ({
    coin: order.coin,
    isReduceOnly: Boolean(order.reduceOnly),
    limitPx: numberOrZero(order.limitPx),
    orderId:
      typeof order.oid === "number"
        ? order.oid
        : Number.isFinite(Number(order.oid))
          ? Number(order.oid)
          : null,
    side: String(order.side ?? ""),
    size: numberOrZero(order.sz),
    timestamp: order.timestamp ? new Date(order.timestamp).toISOString() : null,
  }));
  const normalizedFills = (fills ?? []).map((fill) => {
    const px = numberOrZero(fill.px);
    const size = Math.abs(numberOrZero(fill.sz));

    return {
      closedPnl: numberOrZero((fill as { closedPnl?: unknown }).closedPnl),
      coin: String(fill.coin ?? ""),
      fee: Math.abs(numberOrZero(fill.fee)),
      notionalUsd: px * size,
      px,
      side: String(fill.side ?? ""),
      size,
      time: fill.time
        ? new Date(fill.time).toISOString()
        : new Date().toISOString(),
    };
  });
  const recentFills = normalizedFills
    .sort((left, right) => right.time.localeCompare(left.time))
    .slice(0, 40);
  const totalRealizedPnl = normalizedFills.reduce(
    (sum, fill) => sum + fill.closedPnl,
    0,
  );
  const totalUnrealizedPnl = positions.reduce(
    (sum, position) => sum + numberOrZero(position.unrealizedPnl),
    0,
  );
  const spotBalances = (spotState?.balances ?? []).map((balance) => {
    const total = numberOrZero(balance.total);
    const hold = numberOrZero(balance.hold);

    return {
      available: Math.max(total - hold, 0),
      coin: String(balance.coin ?? balance.token ?? ""),
      hold,
      total,
    };
  });
  const spotEscrows = (spotState?.evmEscrows ?? []).map((escrow) => ({
    coin: String(escrow.coin ?? escrow.token ?? ""),
    total: numberOrZero(escrow.total),
  }));
  const onchain = {
    accountValue: numberOrZero(accountState?.marginSummary?.accountValue),
    delegatedValue: numberOrZero(stakingSummary?.delegated),
    marginUsed: numberOrZero(accountState?.marginSummary?.totalMarginUsed),
    openOrderCount: workingOrders.length,
    positionCount: positions.length,
    recentFills,
    spotBalances,
    spotEscrows,
    stakingDelegations: (stakingDelegations ?? []).map((delegation) => ({
      amount: numberOrZero(delegation.amount),
      lockedUntil: delegation.lockedUntilTimestamp
        ? new Date(delegation.lockedUntilTimestamp).toISOString()
        : null,
      validator: delegation.validator,
    })),
    stakingSummary: stakingSummary
      ? {
          delegated: numberOrZero(stakingSummary.delegated),
          nPendingWithdrawals: Number(stakingSummary.nPendingWithdrawals ?? 0),
          totalPendingWithdrawal: numberOrZero(
            stakingSummary.totalPendingWithdrawal,
          ),
          undelegated: numberOrZero(stakingSummary.undelegated),
        }
      : null,
    totalRealizedPnl,
    totalUnrealizedPnl,
    positions: positions.map((position) => ({
      coin: position.coin,
      entryPx: numberOrZero(position.entryPx),
      liquidationPx:
        position.liquidationPx !== undefined &&
        position.liquidationPx !== null &&
        Number.isFinite(Number(position.liquidationPx))
          ? Number(position.liquidationPx)
          : null,
      leverage: position.leverage
        ? {
            type:
              typeof position.leverage.type === "string"
                ? position.leverage.type
                : null,
            value:
              position.leverage.value !== undefined &&
              position.leverage.value !== null &&
              Number.isFinite(Number(position.leverage.value))
                ? Number(position.leverage.value)
                : null,
          }
        : null,
      marginUsed: numberOrZero(position.marginUsed),
      positionValue: numberOrZero(position.positionValue),
      returnOnEquity: numberOrZero(position.returnOnEquity),
      size: numberOrZero(position.szi),
      unrealizedPnl: numberOrZero(position.unrealizedPnl),
    })),
    withdrawable: numberOrZero(accountState?.withdrawable),
    workingOrders,
  };

  return {
    appFingerprint,
    builderApproval: approvalRow[0]
      ? {
          approvedAt:
            toIsoTimestamp(approvalRow[0].approvedAt) ??
            new Date().toISOString(),
          builderAddress: approvalRow[0].builderAddress,
          maxFeeRate: approvalRow[0].maxFeeRate,
          status: approvalRow[0].status,
        }
      : null,
    builderApprovals,
    follows: {
      followers: followerCountRows[0]?.count ?? 0,
      following: followingCountRows[0]?.count ?? 0,
    },
    membership: membershipRow[0]
      ? {
          currentPeriodEnd: toIsoTimestamp(membershipRow[0].currentPeriodEnd),
          paymentMethod: membershipRow[0].paymentMethod,
          status: membershipRow[0].status,
          tier: membershipRow[0].tier,
          updatedAt: toIsoTimestamp(membershipRow[0].updatedAt),
        }
      : null,
    metrics: {
      builderApproved:
        eventTypes.has("builder_approved") || Boolean(approvalRow[0]),
      firstTrade: eventTypes.has("first_trade"),
      proCheckoutStarted: eventTypes.has("pro_checkout_started"),
    },
    onchain,
    query: parsed.data.query,
    recentEventLogs,
    recentReferrals: recentReferrals.map((row) => ({
      address: row.address,
      code: row.code,
      joinedAt: toIsoTimestamp(row.joinedAt) ?? new Date().toISOString(),
    })),
    referredCount: referredCountRows[0]?.count ?? 0,
    referredBy: referredByRow[0]
      ? {
          code: referredByRow[0].code,
          createdAt:
            toIsoTimestamp(referredByRow[0].createdAt) ??
            new Date().toISOString(),
          referrerAddress: referredByRow[0].referrerAddress,
        }
      : null,
    referralCode: referralCodeRow[0]?.code ?? null,
    resolvedBy: resolved.resolvedBy,
    role: {
      grantedBy: roleRow[0]?.grantedBy ?? null,
      note: roleRow[0]?.note ?? null,
      role,
      updatedAt: toIsoTimestamp(roleRow[0]?.updatedAt),
    },
    twitter: twitterRow[0]
      ? {
          connectedAt:
            toIsoTimestamp(twitterRow[0].connectedAt) ??
            new Date().toISOString(),
          twitterName: twitterRow[0].twitterName,
          twitterUsername: twitterRow[0].twitterUsername,
        }
      : null,
    userProfile: profileRow[0]
      ? {
          bio: profileRow[0].bio,
          displayName: profileRow[0].displayName,
          ensName: profileRow[0].ensName,
          isPro: profileRow[0].isPro,
          joinedAt:
            toIsoTimestamp(profileRow[0].joinedAt) ?? new Date().toISOString(),
        }
      : null,
    walletAddress,
  } satisfies SuperuserWalletSnapshot;
}

export async function setSuperuserRoleAction(input: unknown) {
  const parsed = roleSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("Invalid role payload");
  }

  const actingWalletAddress = normalizeWallet(parsed.data.actingWalletAddress);
  await assertSuperuser(actingWalletAddress);

  await grantInternalRole({
    grantedBy: actingWalletAddress,
    note: parsed.data.note,
    role: parsed.data.role,
    walletAddress: parsed.data.targetWalletAddress,
  });

  return { ok: true };
}

export async function upsertSuperuserReferralCodeAction(input: unknown) {
  const parsed = referralSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("Invalid referral code payload");
  }

  const actingWalletAddress = normalizeWallet(parsed.data.actingWalletAddress);
  const targetWalletAddress = normalizeWallet(parsed.data.targetWalletAddress);
  const nextCode = parsed.data.code.toLowerCase();
  await assertSuperuser(actingWalletAddress);

  const [existingCode] = await db
    .select({ walletAddress: ReferralCode.walletAddress })
    .from(ReferralCode)
    .where(eq(ReferralCode.code, nextCode))
    .limit(1);

  if (
    existingCode?.walletAddress &&
    existingCode.walletAddress !== targetWalletAddress
  ) {
    throw new Error("Referral code already assigned to another wallet");
  }

  await db
    .insert(ReferralCode)
    .values({
      code: nextCode,
      walletAddress: targetWalletAddress,
    })
    .onConflictDoUpdate({
      target: ReferralCode.walletAddress,
      set: {
        code: nextCode,
      },
    });

  return { code: nextCode, ok: true };
}

export async function giftBlinkMembershipAction(input: unknown) {
  const parsed = membershipSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      code: "invalid_payload" as const,
      error: "Invalid membership payload.",
    };
  }

  try {
    const actingWalletAddress = normalizeWallet(
      parsed.data.actingWalletAddress,
    );
    await assertSuperuser(actingWalletAddress);
  } catch (error) {
    return {
      ok: false as const,
      code: "unauthorized" as const,
      error:
        error instanceof Error
          ? error.message
          : "Unauthorized superuser action.",
    };
  }

  const result = await upsertGiftBlinkMembership({
    duration: parsed.data.durationDays,
    tier: parsed.data.tier,
    walletAddress: parsed.data.targetWalletAddress,
  });

  if (!result.ok) {
    return {
      ok: false as const,
      code: result.code,
      error: result.error,
    };
  }

  return {
    ok: true as const,
    membership: {
      currentPeriodEnd: result.currentPeriodEnd,
      paymentMethod: result.paymentMethod,
      status: result.status,
      tier: result.tier,
      updatedAt: new Date().toISOString(),
    },
    walletAddress: result.walletAddress,
  };
}

export async function recordSuperuserBuilderApprovalAction(input: unknown) {
  const parsed = builderApprovalSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("Invalid builder approval payload");
  }

  const actingWalletAddress = normalizeWallet(parsed.data.actingWalletAddress);
  await assertSuperuser(actingWalletAddress);

  const targetWallet = normalizeWallet(parsed.data.targetWalletAddress);
  const existing = await db
    .select({ id: BuilderApproval.id })
    .from(BuilderApproval)
    .where(eq(BuilderApproval.walletAddress, targetWallet))
    .limit(1);

  if (existing[0]) {
    await db
      .update(BuilderApproval)
      .set({
        builderAddress: BUILDER_ADDRESS.toLowerCase(),
        maxFeeRate: parsed.data.maxFeeRate,
        status: "manual-superuser",
      })
      .where(eq(BuilderApproval.id, existing[0].id));
  } else {
    await db.insert(BuilderApproval).values({
      builderAddress: BUILDER_ADDRESS.toLowerCase(),
      maxFeeRate: parsed.data.maxFeeRate,
      status: "manual-superuser",
      walletAddress: targetWallet,
    });
  }

  return { ok: true };
}
