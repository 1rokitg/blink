"use client";

import Link from "next/link";

import { useQuery } from "@tanstack/react-query";

import { Badge } from "@acme/ui/badge";

import {
  fetchTopMarketsByVolume,
  formatCompactNumber,
  formatUsd,
} from "~/lib/blink/markets";

export function LandingMarketTeaser() {
  const marketsQuery = useQuery({
    queryKey: ["blink", "landing-markets"],
    queryFn: () => fetchTopMarketsByVolume(6),
    refetchInterval: 60_000,
  });

  const markets = marketsQuery.data ?? [];

  return (
    <section className="glass-card noise-mask overflow-hidden p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="terminal-label">Top Hyperliquid markets</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            Highest 24h volume
          </h2>
        </div>
        <Badge className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[11px] font-medium text-foreground/68">
          Tap to trade
        </Badge>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {markets.length > 0
          ? markets.map((market) => {
              const positive = market.changePct >= 0;

              return (
                <Link
                  key={market.coin}
                  href={`/app/${market.slug}`}
                  className="rounded-[22px] border border-white/8 bg-white/[0.04] p-4 transition hover:bg-white/[0.07]"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {market.coin}
                      </p>
                      <p className="mt-1 text-xs text-foreground/45">
                        {formatCompactNumber(market.dailyVolume)} 24h notional
                      </p>
                    </div>
                    <span
                      className={`text-xs font-medium ${
                        positive ? "text-emerald-300" : "text-rose-300"
                      }`}
                    >
                      {positive ? "+" : ""}
                      {market.changePct.toFixed(2)}%
                    </span>
                  </div>

                  <p className="mt-6 text-2xl font-semibold text-white">
                    {formatUsd(market.markPx)}
                  </p>
                </Link>
              );
            })
          : Array.from({ length: 6 }, (_, index) => (
              <div
                key={`market-skeleton-${index + 1}`}
                className="h-[118px] animate-pulse rounded-[22px] border border-white/8 bg-white/[0.04]"
              />
            ))}
      </div>
    </section>
  );
}
