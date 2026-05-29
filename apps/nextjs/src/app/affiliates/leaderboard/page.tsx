import Link from "next/link";

import { AffiliateLeaderboardPanel } from "~/components/blink/affiliate-leaderboard-panel";

export default function AffiliateLeaderboardPage() {
  return (
    <main className="min-h-screen bg-[#06070b] px-4 py-8 text-foreground md:px-6">
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="text-3xl font-bold tracking-[-0.04em] text-white"
          >
            blink
          </Link>
          <Link
            href="/rewards"
            className="text-sm text-sky-300 hover:text-sky-200"
          >
            Rewards →
          </Link>
        </div>

        <section className="rounded-2xl border border-white/10 bg-[#0b0d13] p-5 md:p-6">
          <p className="text-xs uppercase tracking-[0.18em] text-foreground/45">
            Public stats
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-white md:text-4xl">
            Affiliate leaderboard
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-foreground/60">
            See which KOLs are driving the most signups, enabled traders, and
            first trades on Blink. Climb the board by shilling your link.
          </p>

          <div className="mt-6">
            <AffiliateLeaderboardPanel publicView />
          </div>
        </section>
      </div>
    </main>
  );
}
