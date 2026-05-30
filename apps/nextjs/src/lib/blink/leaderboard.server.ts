import { unstable_cache } from "next/cache";

import { and, eq, gte, inArray } from "drizzle-orm";

import { db } from "@acme/db/client";
import {
  BlinkMembership,
  BuilderApproval,
  ReferralCode,
  TwitterConnection,
  UserProfile,
} from "@acme/db/schema";

import { env } from "~/env";

import { BUILDER_FEE_UNITS } from "./builder";
import { GROWTH_ZERO_FEE_MARKETS, isGrowthModeEnabled } from "./growth-mode";
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

type TraderCandidate = {
  wallet: string;
  approvedAtMs: number;
  twitter: {
    twitterUsername: string;
    twitterName: string | null;
  } | null;
};

type ScoredTrader = Omit<LeaderboardEntry, "rank">;

function numberOrZero(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function truncateWallet(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function avatarUrl(seed: string) {
  return `https://avatar.vercel.sh/${encodeURIComponent(seed)}.png?size=96`;
}

function estimateBuilderFeeUsd(
  params: {
    coin: string;
    notionalUsd: number;
    walletAddress: string;
    explicitBuilderFeeUsd?: number;
  },
  proSet: Set<string>,
) {
  const explicit = numberOrZero(params.explicitBuilderFeeUsd);
  if (explicit > 0) {
    return {
      builderFeeUsd: explicit,
      feeUnits:
        params.notionalUsd > 0
          ? Math.round((explicit / params.notionalUsd) * 1e6)
          : 0,
    };
  }

  const isZeroFeeGrowthMarket =
    isGrowthModeEnabled() && GROWTH_ZERO_FEE_MARKETS.includes(params.coin);
  const feeUnits = isZeroFeeGrowthMarket
    ? 0
    : proSet.has(params.walletAddress.toLowerCase())
      ? env.BLINK_PRO_BUILDER_FEE_BPS
      : BUILDER_FEE_UNITS;

  return {
    builderFeeUsd: params.notionalUsd * feeUnits * 1e-6,
    feeUnits,
  };
}

/** Fill counts toward Blink leaderboard after builder approval. */
function isBlinkRoutedFill(
  fill: Record<string, unknown>,
  wallet: string,
  approvedAtMs: number,
  proSet: Set<string>,
) {
  const time = numberOrZero(fill.time);
  if (!time || time < approvedAtMs) return false;

  const coin = String(fill.coin ?? "").toUpperCase();
  const px = numberOrZero(fill.px);
  const sz = Math.abs(numberOrZero(fill.sz));
  const volume = px * sz;
  if (!Number.isFinite(volume) || volume <= 0) return false;

  const explicitBuilderFeeUsd = numberOrZero(
    (fill as { builderFee?: unknown }).builderFee,
  );
  if (explicitBuilderFeeUsd > 0) return true;

  if (isGrowthModeEnabled() && GROWTH_ZERO_FEE_MARKETS.includes(coin)) {
    return true;
  }

  const { feeUnits } = estimateBuilderFeeUsd(
    {
      coin,
      notionalUsd: volume,
      walletAddress: wallet,
      explicitBuilderFeeUsd,
    },
    proSet,
  );

  return feeUnits > 0;
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

async function getActiveProSet() {
  const activeProRows = await db
    .select({ walletAddress: BlinkMembership.walletAddress })
    .from(BlinkMembership)
    .where(
      and(
        inArray(BlinkMembership.status, ["active", "trialing"]),
        gte(BlinkMembership.currentPeriodEnd, new Date()),
      ),
    );
  return new Set(activeProRows.map((row) => row.walletAddress.toLowerCase()));
}

async function loadEligibleTraders(): Promise<TraderCandidate[]> {
  const [approvalRows, twitterRows] = await Promise.all([
    db
      .select({
        walletAddress: BuilderApproval.walletAddress,
        approvedAt: BuilderApproval.approvedAt,
      })
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

  const approvalByWallet = new Map<string, number>();
  for (const row of approvalRows) {
    const wallet = row.walletAddress.toLowerCase();
    const approvedAtMs = new Date(row.approvedAt).getTime();
    const existing = approvalByWallet.get(wallet);
    approvalByWallet.set(
      wallet,
      existing ? Math.min(existing, approvedAtMs) : approvedAtMs,
    );
  }

  return Array.from(approvalByWallet.entries()).map(
    ([wallet, approvedAtMs]) => {
      const twitter = twitterByWallet.get(wallet);
      return {
        wallet,
        approvedAtMs,
        twitter: twitter
          ? {
              twitterUsername: twitter.twitterUsername,
              twitterName: twitter.twitterName,
            }
          : null,
      };
    },
  );
}

function dedupeScoredTraders(scored: ScoredTrader[]) {
  const byWallet = new Map<string, ScoredTrader>();

  for (const entry of scored) {
    const key = entry.walletAddress.toLowerCase();
    const existing = byWallet.get(key);
    if (!existing) {
      byWallet.set(key, entry);
      continue;
    }

    if (
      entry.routedVolumeUsd > existing.routedVolumeUsd ||
      (entry.routedVolumeUsd === existing.routedVolumeUsd &&
        entry.routedPnlUsd > existing.routedPnlUsd)
    ) {
      byWallet.set(key, entry);
    }
  }

  return Array.from(byWallet.values());
}

async function computeLeaderboard(
  period: LeaderboardPeriod,
  limit: number,
): Promise<LeaderboardSnapshot> {
  const startTime = Date.now() - PERIOD_MS[period];
  const [eligible, proSet] = await Promise.all([
    loadEligibleTraders(),
    getActiveProSet(),
  ]);

  const walletList = eligible.map((row) => row.wallet);
  const [profiles, codes] =
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
        ])
      : [[], []];

  const profileMap = new Map(
    profiles.map((row) => [row.walletAddress.toLowerCase(), row]),
  );
  const codeMap = new Map(
    codes.map((row) => [row.walletAddress.toLowerCase(), row.code]),
  );
  for (const row of profiles) {
    if (row.isPro) proSet.add(row.walletAddress.toLowerCase());
  }

  const scored = await mapPool(eligible, 6, async (trader) => {
    const { wallet, approvedAtMs, twitter } = trader;
    const effectiveStart = Math.max(startTime, approvedAtMs);

    let fills: Array<Record<string, unknown>> = [];
    try {
      fills = (await infoClient.userFillsByTime({
        user: wallet as `0x${string}`,
        startTime: effectiveStart,
      })) as unknown as Array<Record<string, unknown>>;
    } catch {
      return null;
    }

    let routedPnlUsd = 0;
    let routedVolumeUsd = 0;
    let fillsCount = 0;

    for (const fill of fills) {
      if (!isBlinkRoutedFill(fill, wallet, approvedAtMs, proSet)) continue;

      const px = numberOrZero(fill.px);
      const sz = Math.abs(numberOrZero(fill.sz));
      const volume = px * sz;

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
      twitter?.twitterUsername ??
      wallet;
    const displayName =
      profile?.displayName?.trim() ||
      twitter?.twitterName?.trim() ||
      twitter?.twitterUsername ||
      code ||
      truncateWallet(wallet);
    const handle = twitter
      ? `@${twitter.twitterUsername}`
      : truncateWallet(wallet);

    return {
      walletAddress: wallet,
      displayName,
      handle,
      profileHref: `/profile/${encodeURIComponent(slug)}`,
      avatarUrl: avatarUrl(wallet),
      isVerified: Boolean(twitter),
      isPro: proSet.has(wallet),
      routedPnlUsd,
      routedVolumeUsd,
      fillsCount,
    };
  });

  const ranked = dedupeScoredTraders(scored)
    .sort((a, b) => {
      if (b.routedVolumeUsd !== a.routedVolumeUsd) {
        return b.routedVolumeUsd - a.routedVolumeUsd;
      }
      return b.routedPnlUsd - a.routedPnlUsd;
    })
    .slice(0, limit)
    .map((entry, index) => ({
      rank: index + 1,
      ...entry,
    }));

  return {
    period,
    updatedAt: new Date().toISOString(),
    criteria: [
      "Builder approved on Blink",
      "Routed perp activity after approval",
      "Ranked by volume · X badge when verified",
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
    ["blink-leaderboard-v2", period, String(limit)],
    { revalidate: 600 },
  );

  return cached();
}
