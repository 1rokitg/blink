import { unstable_cache } from "next/cache";

import { and, eq, inArray } from "drizzle-orm";

import { db } from "@acme/db/client";
import {
  BlinkMembership,
  BuilderApproval,
  ReferralCode,
  TwitterConnection,
  UserProfile,
} from "@acme/db/schema";

import { infoClient } from "./hyperliquid";
import { getProfileSlugByWalletAddress } from "./resolve-address";

export type LeaderboardPeriod = "24h" | "7d" | "30d" | "all";

export type LeaderboardEntry = {
  rank: number;
  walletAddress: string;
  displayName: string;
  handle: string;
  profileHref: string;
  avatarUrl: string;
  isVerified: boolean;
  isPro: boolean;
  routedPnlUsd: number;
  routedVolumeUsd: number;
  fillsCount: number;
};

export type LeaderboardSnapshot = {
  period: LeaderboardPeriod;
  updatedAt: string;
  criteria: string[];
  entries: LeaderboardEntry[];
};

const PERIOD_MS: Record<LeaderboardPeriod, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  all: 90 * 24 * 60 * 60 * 1000,
};

function numberOrZero(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function getStrictBuilderFeeUsd(fill: Record<string, unknown>) {
  const explicit = numberOrZero((fill as { builderFee?: unknown }).builderFee);
  return explicit > 0 ? explicit : 0;
}

function avatarUrl(id: string) {
  return `https://avatar.vercel.sh/${encodeURIComponent(id)}.png?size=96`;
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R | null>,
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function runWorker() {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      if (current === undefined) continue;
      const result = await worker(current);
      if (result) results.push(result);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () =>
      runWorker(),
    ),
  );

  return results;
}

async function loadEligibleWallets() {
  const [approvals, twitterRows] = await Promise.all([
    db
      .select({ walletAddress: BuilderApproval.walletAddress })
      .from(BuilderApproval),
    db
      .select({
        walletAddress: TwitterConnection.walletAddress,
        twitterUsername: TwitterConnection.twitterUsername,
        twitterName: TwitterConnection.twitterName,
      })
      .from(TwitterConnection),
  ]);

  const twitterByWallet = new Map(
    twitterRows.map((row) => [row.walletAddress.toLowerCase(), row]),
  );

  return approvals
    .map((row) => row.walletAddress.toLowerCase())
    .filter((wallet) => twitterByWallet.has(wallet))
    .flatMap((wallet) => {
      const twitter = twitterByWallet.get(wallet);
      return twitter ? [{ wallet, twitter }] : [];
    });
}

async function computeLeaderboard(
  period: LeaderboardPeriod,
  limit: number,
): Promise<LeaderboardSnapshot> {
  const startTime = Date.now() - PERIOD_MS[period];
  const eligible = await loadEligibleWallets();

  const walletList = eligible.map((row) => row.wallet);
  const [profiles, codes, proRows] =
    walletList.length > 0
      ? await Promise.all([
          db
            .select({
              walletAddress: UserProfile.walletAddress,
              displayName: UserProfile.displayName,
              isPro: UserProfile.isPro,
            })
            .from(UserProfile)
            .where(inArray(UserProfile.walletAddress, walletList)),
          db
            .select({
              walletAddress: ReferralCode.walletAddress,
              code: ReferralCode.code,
            })
            .from(ReferralCode)
            .where(inArray(ReferralCode.walletAddress, walletList)),
          db
            .select({ walletAddress: BlinkMembership.walletAddress })
            .from(BlinkMembership)
            .where(
              and(
                inArray(BlinkMembership.walletAddress, walletList),
                eq(BlinkMembership.status, "active"),
              ),
            ),
        ])
      : [[], [], []];

  const profileMap = new Map(
    profiles.map((row) => [row.walletAddress.toLowerCase(), row]),
  );
  const codeMap = new Map(
    codes.map((row) => [row.walletAddress.toLowerCase(), row.code]),
  );
  const proSet = new Set(proRows.map((row) => row.walletAddress.toLowerCase()));
  for (const row of profiles) {
    if (row.isPro) proSet.add(row.walletAddress.toLowerCase());
  }

  const scored = await mapPool(eligible, 6, async ({ wallet, twitter }) => {
    let fills: Array<Record<string, unknown>> = [];
    try {
      fills = (await infoClient.userFillsByTime({
        user: wallet as `0x${string}`,
        startTime,
      })) as unknown as Array<Record<string, unknown>>;
    } catch {
      return null;
    }

    let routedPnlUsd = 0;
    let routedVolumeUsd = 0;
    let fillsCount = 0;

    for (const fill of fills) {
      const builderFeeUsd = getStrictBuilderFeeUsd(fill);
      if (builderFeeUsd <= 0) continue;

      const px = numberOrZero(fill.px);
      const sz = Math.abs(numberOrZero(fill.sz));
      const volume = px * sz;
      if (!Number.isFinite(volume) || volume <= 0) continue;

      routedPnlUsd += numberOrZero((fill as { closedPnl?: unknown }).closedPnl);
      routedVolumeUsd += volume;
      fillsCount += 1;
    }

    if (fillsCount === 0) return null;

    const profile = profileMap.get(wallet);
    const code = codeMap.get(wallet);
    const slug =
      (await getProfileSlugByWalletAddress(wallet)) ??
      code ??
      twitter.twitterUsername;
    const displayName =
      profile?.displayName?.trim() ||
      twitter.twitterName?.trim() ||
      twitter.twitterUsername;
    const handle = `@${twitter.twitterUsername}`;

    return {
      walletAddress: wallet,
      displayName,
      handle,
      profileHref: `/profile/${encodeURIComponent(slug)}`,
      avatarUrl: avatarUrl(slug),
      isVerified: true,
      isPro: proSet.has(wallet),
      routedPnlUsd,
      routedVolumeUsd,
      fillsCount,
    };
  });

  const ranked = scored
    .sort((a, b) => b.routedPnlUsd - a.routedPnlUsd)
    .slice(0, limit)
    .map((entry, index) => ({
      rank: index + 1,
      ...entry,
    }));

  return {
    period,
    updatedAt: new Date().toISOString(),
    criteria: [
      "X verified",
      "Blink builder approved",
      "Routed fills through Blink",
    ],
    entries: ranked,
  };
}

export async function getBlinkLeaderboard(options?: {
  period?: LeaderboardPeriod;
  limit?: number;
}) {
  const period = options?.period ?? "7d";
  const limit = Math.max(1, Math.min(options?.limit ?? 100, 100));

  const cached = unstable_cache(
    async () => computeLeaderboard(period, limit),
    ["blink-leaderboard", period, String(limit)],
    { revalidate: 600 },
  );

  return cached();
}
