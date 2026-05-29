import { and, eq, inArray } from "drizzle-orm";

import { db } from "@acme/db/client";
import {
  BuilderApproval,
  MetricEvent,
  Referral,
  ReferralCode,
} from "@acme/db/schema";

import { AFFILIATE_SEEDS, type AffiliateSeed } from "./affiliate-seeds";
import { BLINK_WEB_AGENT_NAME } from "./blink-agent";

export type AffiliateLeaderboardMetrics = {
  referrals: number;
  builderApproved: number;
  firstTrade: number;
  proStarted: number;
  referrals7d: number;
};

export type AffiliateLeaderboardConversion = {
  signupToApprovalPct: number;
  signupToTradePct: number;
  approvalToTradePct: number;
  tradeToProPct: number;
};

export type AffiliateLeaderboardEntry = {
  rank: number;
  code: string;
  name: string;
  xHandle: string;
  xUrl: string;
  avatarUrl: string;
  rewardBoostLabel: string;
  payoutSplitLabel: string;
  active: boolean;
  referralLink: string;
  metrics: AffiliateLeaderboardMetrics;
  conversion: AffiliateLeaderboardConversion;
  score: number;
  lastReferralAt: string | null;
};

export type AffiliateLeaderboardSnapshot = {
  updatedAt: string;
  totals: AffiliateLeaderboardMetrics & { affiliates: number };
  entries: AffiliateLeaderboardEntry[];
};

type ReferralRow = {
  referrerAddress: string;
  referredAddress: string;
  code: string;
  createdAt: Date;
};

function normalizeCode(value: string) {
  return value.trim().toLowerCase();
}

function pct(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return (numerator / denominator) * 100;
}

/** Weighted activation score — visible on the public leaderboard. */
export function computeAffiliateScore(metrics: AffiliateLeaderboardMetrics) {
  return (
    metrics.referrals * 10 +
    metrics.builderApproved * 25 +
    metrics.firstTrade * 100 +
    metrics.proStarted * 150 +
    metrics.referrals7d * 5
  );
}

function referralsForSeed(seed: AffiliateSeed, referrals: ReferralRow[]) {
  const code = normalizeCode(seed.code);
  const wallet = seed.walletAddress?.trim().toLowerCase();
  const seen = new Set<string>();

  return referrals.filter((row) => {
    const referred = row.referredAddress.toLowerCase();
    if (seen.has(referred)) return false;

    const matchesCode = normalizeCode(row.code) === code;
    const matchesWallet =
      Boolean(wallet) && row.referrerAddress.toLowerCase() === wallet;

    if (!matchesCode && !matchesWallet) return false;
    seen.add(referred);
    return true;
  });
}

function buildEntry(
  seed: AffiliateSeed,
  matched: ReferralRow[],
  builderApprovedSet: Set<string>,
  firstTradeSet: Set<string>,
  proStartedSet: Set<string>,
  sevenDaysAgo: Date,
): Omit<AffiliateLeaderboardEntry, "rank"> {
  const referredWallets = matched.map((row) =>
    row.referredAddress.toLowerCase(),
  );

  let builderApproved = 0;
  let firstTrade = 0;
  let proStarted = 0;

  for (const wallet of referredWallets) {
    if (builderApprovedSet.has(wallet)) builderApproved += 1;
    if (firstTradeSet.has(wallet)) firstTrade += 1;
    if (proStartedSet.has(wallet)) proStarted += 1;
  }

  const referrals = matched.length;
  const referrals7d = matched.filter(
    (row) => row.createdAt.getTime() >= sevenDaysAgo.getTime(),
  ).length;

  const metrics: AffiliateLeaderboardMetrics = {
    referrals,
    builderApproved,
    firstTrade,
    proStarted,
    referrals7d,
  };

  const lastReferralAt =
    matched.length > 0
      ? matched
          .reduce((latest, row) =>
            row.createdAt.getTime() > latest.createdAt.getTime() ? row : latest,
          )
          .createdAt.toISOString()
      : null;

  return {
    code: seed.code,
    name: seed.name,
    xHandle: seed.xHandle,
    xUrl: seed.xUrl,
    avatarUrl: seed.avatarUrl,
    rewardBoostLabel: seed.rewardBoostLabel,
    payoutSplitLabel: seed.payoutSplitLabel,
    active: seed.active,
    referralLink: `https://blink.lat/r/${seed.code}`,
    metrics,
    conversion: {
      signupToApprovalPct: pct(builderApproved, referrals),
      signupToTradePct: pct(firstTrade, referrals),
      approvalToTradePct: pct(firstTrade, builderApproved),
      tradeToProPct: pct(proStarted, firstTrade),
    },
    score: computeAffiliateScore(metrics),
    lastReferralAt,
  };
}

export async function getAffiliateLeaderboardSnapshot(): Promise<AffiliateLeaderboardSnapshot> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const seedCodes = AFFILIATE_SEEDS.map((seed) => normalizeCode(seed.code));

  const [referrals, registeredCodes] = await Promise.all([
    db
      .select({
        referrerAddress: Referral.referrerAddress,
        referredAddress: Referral.referredAddress,
        code: Referral.code,
        createdAt: Referral.createdAt,
      })
      .from(Referral),
    db
      .select({
        code: ReferralCode.code,
        walletAddress: ReferralCode.walletAddress,
      })
      .from(ReferralCode)
      .where(inArray(ReferralCode.code, seedCodes)),
  ]);

  const walletByCode = new Map(
    registeredCodes.map((row) => [normalizeCode(row.code), row.walletAddress]),
  );

  const enrichedSeeds = AFFILIATE_SEEDS.map((seed) => {
    const registeredWallet = walletByCode.get(normalizeCode(seed.code));
    if (!registeredWallet || seed.walletAddress) return seed;
    return { ...seed, walletAddress: registeredWallet };
  });

  const referredWallets = Array.from(
    new Set(referrals.map((row) => row.referredAddress.toLowerCase())),
  );

  let builderApprovedSet = new Set<string>();
  let firstTradeSet = new Set<string>();
  let proStartedSet = new Set<string>();

  if (referredWallets.length > 0) {
    const [approvals, firstTradeRows, proRows] = await Promise.all([
      db
        .select({ walletAddress: BuilderApproval.walletAddress })
        .from(BuilderApproval)
        .where(
          and(
            inArray(BuilderApproval.walletAddress, referredWallets),
            eq(BuilderApproval.agentName, BLINK_WEB_AGENT_NAME),
          ),
        ),
      db
        .select({ walletAddress: MetricEvent.walletAddress })
        .from(MetricEvent)
        .where(
          and(
            inArray(MetricEvent.walletAddress, referredWallets),
            eq(MetricEvent.eventType, "first_trade"),
          ),
        ),
      db
        .select({ walletAddress: MetricEvent.walletAddress })
        .from(MetricEvent)
        .where(
          and(
            inArray(MetricEvent.walletAddress, referredWallets),
            eq(MetricEvent.eventType, "pro_checkout_started"),
          ),
        ),
    ]);

    builderApprovedSet = new Set(
      approvals.map((row) => row.walletAddress.toLowerCase()),
    );
    firstTradeSet = new Set(
      firstTradeRows
        .map((row) => row.walletAddress)
        .filter((wallet): wallet is string => Boolean(wallet))
        .map((wallet) => wallet.toLowerCase()),
    );
    proStartedSet = new Set(
      proRows
        .map((row) => row.walletAddress)
        .filter((wallet): wallet is string => Boolean(wallet))
        .map((wallet) => wallet.toLowerCase()),
    );
  }

  const entries = enrichedSeeds
    .map((seed) =>
      buildEntry(
        seed,
        referralsForSeed(seed, referrals),
        builderApprovedSet,
        firstTradeSet,
        proStartedSet,
        sevenDaysAgo,
      ),
    )
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (right.metrics.firstTrade !== left.metrics.firstTrade) {
        return right.metrics.firstTrade - left.metrics.firstTrade;
      }
      if (right.metrics.referrals !== left.metrics.referrals) {
        return right.metrics.referrals - left.metrics.referrals;
      }
      return left.name.localeCompare(right.name);
    })
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

  const totals = entries.reduce(
    (acc, entry) => ({
      affiliates: acc.affiliates + 1,
      referrals: acc.referrals + entry.metrics.referrals,
      builderApproved: acc.builderApproved + entry.metrics.builderApproved,
      firstTrade: acc.firstTrade + entry.metrics.firstTrade,
      proStarted: acc.proStarted + entry.metrics.proStarted,
      referrals7d: acc.referrals7d + entry.metrics.referrals7d,
    }),
    {
      affiliates: 0,
      referrals: 0,
      builderApproved: 0,
      firstTrade: 0,
      proStarted: 0,
      referrals7d: 0,
    },
  );

  return {
    updatedAt: new Date().toISOString(),
    totals,
    entries,
  };
}
