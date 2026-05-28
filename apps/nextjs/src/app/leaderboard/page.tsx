import type { Metadata } from "next";

import { BlinkLeaderboardPage } from "~/components/blink/blink-leaderboard";

export const metadata: Metadata = {
  title: "Leaderboard · Blink",
  description:
    "Top 100 verified traders on Blink ranked by routed PnL — the social trading terminal for Hyperliquid.",
  openGraph: {
    title: "Blink Leaderboard",
    description: "Where traders become legends on Blink.",
  },
};

export default function LeaderboardRoutePage() {
  return <BlinkLeaderboardPage />;
}
