import { eq } from "drizzle-orm";

import { db } from "@acme/db/client";
import { BlinkMembership, UserProfile } from "@acme/db/schema";

export const LIFETIME_MEMBERSHIP_END = new Date("2099-12-31T23:59:59.999Z");

export type GiftMembershipDuration = 30 | 90 | 365 | "lifetime";
export type GiftMembershipTier = "basic" | "preferred" | "premium";

export type GiftMembershipResult =
  | {
      ok: true;
      walletAddress: string;
      tier: GiftMembershipTier;
      createdAt: string;
      currentPeriodEnd: string;
      paymentMethod: "gift";
      status: "active";
    }
  | {
      ok: false;
      error: string;
      code: "invalid_wallet" | "db_error" | "unknown";
    };

function normalizeWallet(walletAddress: string) {
  return walletAddress.trim().toLowerCase();
}

export type GiftMembershipInfo = {
  isGift: boolean;
  isActiveGift: boolean;
  /** Human label for superuser UI, e.g. "Gifted Pro · 30d · 12d left". */
  label: string | null;
  /** Best-effort tier length from created → period end. */
  giftedDurationDays: 30 | 90 | 365 | "lifetime" | null;
  daysRemaining: number | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function describeGiftedMembership(
  membership: {
    paymentMethod: string;
    status: string;
    currentPeriodEnd: string | null;
    createdAt: string | null;
  } | null,
): GiftMembershipInfo {
  if (!membership || membership.paymentMethod !== "gift") {
    return {
      isGift: false,
      isActiveGift: false,
      label: null,
      giftedDurationDays: null,
      daysRemaining: null,
    };
  }

  const periodEnd = membership.currentPeriodEnd
    ? new Date(membership.currentPeriodEnd)
    : null;
  const createdAt = membership.createdAt
    ? new Date(membership.createdAt)
    : null;
  const now = Date.now();
  const isActiveGift =
    membership.status === "active" &&
    periodEnd !== null &&
    periodEnd.getTime() > now;

  const daysRemaining =
    periodEnd && periodEnd.getTime() > now
      ? Math.max(0, Math.ceil((periodEnd.getTime() - now) / DAY_MS))
      : 0;

  let giftedDurationDays: GiftMembershipInfo["giftedDurationDays"] = null;
  if (createdAt && periodEnd) {
    const spanDays = Math.round(
      (periodEnd.getTime() - createdAt.getTime()) / DAY_MS,
    );
    if (spanDays >= 3_650) {
      giftedDurationDays = "lifetime";
    } else if (spanDays >= 25 && spanDays <= 40) {
      giftedDurationDays = 30;
    } else if (spanDays >= 80 && spanDays <= 100) {
      giftedDurationDays = 90;
    } else if (spanDays >= 330 && spanDays <= 400) {
      giftedDurationDays = 365;
    }
  }

  const durationPart =
    giftedDurationDays === "lifetime"
      ? "lifetime"
      : giftedDurationDays
        ? `${giftedDurationDays}d`
        : null;

  const label = isActiveGift
    ? `Gifted Pro${durationPart ? ` · ${durationPart}` : ""} · ${daysRemaining}d left`
    : "Gifted Pro (expired)";

  return {
    isGift: true,
    isActiveGift,
    label,
    giftedDurationDays,
    daysRemaining: isActiveGift ? daysRemaining : 0,
  };
}

export function resolveGiftMembershipPeriodEnd(
  duration: GiftMembershipDuration,
): Date {
  if (duration === "lifetime") {
    return LIFETIME_MEMBERSHIP_END;
  }

  return new Date(Date.now() + duration * 24 * 60 * 60 * 1000);
}

function mapDatabaseError(error: unknown): GiftMembershipResult {
  const message =
    error instanceof Error ? error.message : "Unknown database error";

  if (
    message.includes("blink_membership") &&
    (message.includes("does not exist") || message.includes("relation"))
  ) {
    return {
      ok: false,
      code: "db_error",
      error:
        "blink_membership table is missing in Neon. Run `pnpm db:push` against production, then retry.",
    };
  }

  if (message.includes("user_profile") && message.includes("does not exist")) {
    return {
      ok: false,
      code: "db_error",
      error:
        "user_profile table is missing in Neon. Run `pnpm db:push` against production, then retry.",
    };
  }

  return {
    ok: false,
    code: "db_error",
    error: message,
  };
}

export async function upsertGiftBlinkMembership(input: {
  walletAddress: string;
  tier: GiftMembershipTier;
  duration: GiftMembershipDuration;
}): Promise<GiftMembershipResult> {
  const walletAddress = normalizeWallet(input.walletAddress);

  if (!/^0x[0-9a-f]{40}$/.test(walletAddress)) {
    return {
      ok: false,
      code: "invalid_wallet",
      error: "Invalid wallet address.",
    };
  }

  const currentPeriodEnd = resolveGiftMembershipPeriodEnd(input.duration);

  try {
    await db
      .insert(BlinkMembership)
      .values({
        currentPeriodEnd,
        paymentMethod: "gift",
        status: "active",
        tier: input.tier,
        walletAddress,
      })
      .onConflictDoUpdate({
        target: BlinkMembership.walletAddress,
        set: {
          currentPeriodEnd,
          paymentMethod: "gift",
          status: "active",
          tier: input.tier,
          updatedAt: new Date(),
        },
      });

    await db
      .insert(UserProfile)
      .values({
        isPro: true,
        walletAddress,
      })
      .onConflictDoUpdate({
        target: UserProfile.walletAddress,
        set: {
          isPro: true,
          updatedAt: new Date(),
        },
      });

    const [membershipRow] = await db
      .select({
        createdAt: BlinkMembership.createdAt,
        currentPeriodEnd: BlinkMembership.currentPeriodEnd,
        paymentMethod: BlinkMembership.paymentMethod,
        status: BlinkMembership.status,
        tier: BlinkMembership.tier,
      })
      .from(BlinkMembership)
      .where(eq(BlinkMembership.walletAddress, walletAddress))
      .limit(1);

    if (!membershipRow) {
      return {
        ok: false,
        code: "db_error",
        error: "Membership write did not persist. Check Neon logs and retry.",
      };
    }

    return {
      ok: true,
      walletAddress,
      tier: membershipRow.tier as GiftMembershipTier,
      createdAt:
        membershipRow.createdAt?.toISOString() ?? new Date().toISOString(),
      currentPeriodEnd:
        membershipRow.currentPeriodEnd?.toISOString() ??
        currentPeriodEnd.toISOString(),
      paymentMethod: "gift",
      status: "active",
    };
  } catch (error) {
    console.error("[gift-membership] upsert failed", {
      walletAddress,
      tier: input.tier,
      duration: input.duration,
      error,
    });
    return mapDatabaseError(error);
  }
}
