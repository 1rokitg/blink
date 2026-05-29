import { NextResponse } from "next/server";

import { getAffiliateLeaderboardSnapshot } from "~/lib/blink/affiliate-leaderboard.server";

export const runtime = "nodejs";

/**
 * GET /api/affiliates/leaderboard
 * Public KOL performance leaderboard for affiliate gamification.
 */
export async function GET() {
  const snapshot = await getAffiliateLeaderboardSnapshot();

  return NextResponse.json({
    updatedAt: snapshot.updatedAt,
    totals: snapshot.totals,
    entries: snapshot.entries.map((entry) => ({
      rank: entry.rank,
      code: entry.code,
      name: entry.name,
      xHandle: entry.xHandle,
      xUrl: entry.xUrl,
      avatarUrl: entry.avatarUrl,
      rewardBoostLabel: entry.rewardBoostLabel,
      active: entry.active,
      referralLink: entry.referralLink,
      metrics: entry.metrics,
      conversion: entry.conversion,
      score: entry.score,
      lastReferralAt: entry.lastReferralAt,
    })),
  });
}
