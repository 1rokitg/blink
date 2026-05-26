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
  durationDays: z.union([z.literal(30), z.literal(90), z.literal(365)]),
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
  builderApproval: {
    approvedAt: string;
    builderAddress: string;
    maxFeeRate: string;
    status: string;
  } | null;
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
  query: string;
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

  const codeByWallet = new Map(codeRows.map((row) => [row.walletAddress, row.code]));
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
  ]);

  const eventTypes = new Set(metricRows.map((row) => row.eventType));

  return {
    builderApproval: approvalRow[0]
      ? {
          approvedAt: approvalRow[0].approvedAt.toISOString(),
          builderAddress: approvalRow[0].builderAddress,
          maxFeeRate: approvalRow[0].maxFeeRate,
          status: approvalRow[0].status,
        }
      : null,
    follows: {
      followers: followerCountRows[0]?.count ?? 0,
      following: followingCountRows[0]?.count ?? 0,
    },
    membership: membershipRow[0]
      ? {
          currentPeriodEnd:
            membershipRow[0].currentPeriodEnd?.toISOString() ?? null,
          paymentMethod: membershipRow[0].paymentMethod,
          status: membershipRow[0].status,
          tier: membershipRow[0].tier,
          updatedAt: membershipRow[0].updatedAt?.toISOString() ?? null,
        }
      : null,
    metrics: {
      builderApproved:
        eventTypes.has("builder_approved") || Boolean(approvalRow[0]),
      firstTrade: eventTypes.has("first_trade"),
      proCheckoutStarted: eventTypes.has("pro_checkout_started"),
    },
    query: parsed.data.query,
    recentReferrals: recentReferrals.map((row) => ({
      address: row.address,
      code: row.code,
      joinedAt: row.joinedAt.toISOString(),
    })),
    referredCount: referredCountRows[0]?.count ?? 0,
    referredBy: referredByRow[0]
      ? {
          code: referredByRow[0].code,
          createdAt: referredByRow[0].createdAt.toISOString(),
          referrerAddress: referredByRow[0].referrerAddress,
        }
      : null,
    referralCode: referralCodeRow[0]?.code ?? null,
    resolvedBy: resolved.resolvedBy,
    role: {
      grantedBy: roleRow[0]?.grantedBy ?? null,
      note: roleRow[0]?.note ?? null,
      role,
      updatedAt: roleRow[0]?.updatedAt?.toISOString() ?? null,
    },
    twitter: twitterRow[0]
      ? {
          connectedAt: twitterRow[0].connectedAt.toISOString(),
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
          joinedAt: profileRow[0].joinedAt.toISOString(),
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
    throw new Error("Invalid membership payload");
  }

  const actingWalletAddress = normalizeWallet(parsed.data.actingWalletAddress);
  const targetWalletAddress = normalizeWallet(parsed.data.targetWalletAddress);
  await assertSuperuser(actingWalletAddress);

  const currentPeriodEnd = new Date(
    Date.now() + parsed.data.durationDays * 24 * 60 * 60 * 1000,
  );

  await db
    .insert(BlinkMembership)
    .values({
      currentPeriodEnd,
      paymentMethod: "gift",
      status: "active",
      tier: parsed.data.tier,
      walletAddress: targetWalletAddress,
    })
    .onConflictDoUpdate({
      target: BlinkMembership.walletAddress,
      set: {
        currentPeriodEnd,
        paymentMethod: "gift",
        status: "active",
        tier: parsed.data.tier,
      },
    });

  await db
    .insert(UserProfile)
    .values({
      isPro: true,
      walletAddress: targetWalletAddress,
    })
    .onConflictDoUpdate({
      target: UserProfile.walletAddress,
      set: {
        isPro: true,
      },
    });

  return {
    currentPeriodEnd: currentPeriodEnd.toISOString(),
    ok: true,
  };
}

export async function recordSuperuserBuilderApprovalAction(input: unknown) {
  const parsed = builderApprovalSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("Invalid builder approval payload");
  }

  const actingWalletAddress = normalizeWallet(parsed.data.actingWalletAddress);
  await assertSuperuser(actingWalletAddress);

  await db.insert(BuilderApproval).values({
    builderAddress: BUILDER_ADDRESS.toLowerCase(),
    maxFeeRate: parsed.data.maxFeeRate,
    status: "manual-superuser",
    walletAddress: normalizeWallet(parsed.data.targetWalletAddress),
  });

  return { ok: true };
}
