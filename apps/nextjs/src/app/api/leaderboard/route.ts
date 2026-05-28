import { NextResponse } from "next/server";

import {
  type LeaderboardPeriod,
  getBlinkLeaderboard,
} from "~/lib/blink/leaderboard.server";

export const runtime = "nodejs";

const PERIODS = new Set<LeaderboardPeriod>(["24h", "7d", "30d", "all"]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const periodParam = searchParams.get("period") ?? "7d";
  const period = PERIODS.has(periodParam as LeaderboardPeriod)
    ? (periodParam as LeaderboardPeriod)
    : "7d";
  const limit = Math.min(
    100,
    Math.max(1, Number(searchParams.get("limit") ?? 100)),
  );

  try {
    const snapshot = await getBlinkLeaderboard({ period, limit });
    return NextResponse.json(snapshot, {
      headers: {
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200",
      },
    });
  } catch (error) {
    console.error("[leaderboard] failed", error);
    return NextResponse.json(
      { error: "Failed to load leaderboard" },
      { status: 500 },
    );
  }
}
