"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchTopMarketsByVolume, formatCompactNumber, formatUsd } from "~/lib/blink/markets";

export function LandingStatsTicker() {
  const query = useQuery({
    queryKey: ["blink", "landing-stats"],
    queryFn: async () => {
      const markets = await fetchTopMarketsByVolume(50);
      const btc = markets.find((m) => m.coin === "BTC");
      const eth = markets.find((m) => m.coin === "ETH");
      const topGainer = [...markets].sort((a, b) => b.changePct - a.changePct)[0];
      const topLoser = [...markets].sort((a, b) => a.changePct - b.changePct)[0];
      const totalVolume = markets.reduce((sum, m) => sum + m.dailyVolume, 0);
      return { btc, eth, topGainer, topLoser, totalVolume, markets };
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const d = query.data;

  const items = d
    ? [
        {
          label: "BTC",
          value: d.btc ? formatUsd(d.btc.markPx) : "—",
          change: d.btc?.changePct,
        },
        {
          label: "ETH",
          value: d.eth ? formatUsd(d.eth.markPx) : "—",
          change: d.eth?.changePct,
        },
        {
          label: "24h HL Volume",
          value: d.totalVolume > 0 ? `$${formatCompactNumber(d.totalVolume)}` : "—",
          change: undefined,
        },
        {
          label: "Top gainer",
          value: d.topGainer ? d.topGainer.coin : "—",
          change: d.topGainer?.changePct,
        },
        {
          label: "Top loser",
          value: d.topLoser ? d.topLoser.coin : "—",
          change: d.topLoser?.changePct,
        },
      ]
    : Array.from({ length: 5 }, (_, i) => ({ label: ["BTC", "ETH", "24h HL Volume", "Top gainer", "Top loser"][i]!, value: "—", change: undefined }));

  return (
    <div className="flex items-center gap-6 overflow-x-auto px-1 py-1">
      {items.map((item) => {
        const positive = item.change !== undefined && item.change >= 0;
        const changeColor =
          item.change === undefined
            ? "text-foreground/40"
            : positive
              ? "text-emerald-300"
              : "text-rose-300";
        return (
          <div key={item.label} className="flex shrink-0 items-center gap-2">
            <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-foreground/38">
              {item.label}
            </span>
            <span className="font-mono text-sm font-medium text-white">
              {item.value}
            </span>
            {item.change !== undefined && (
              <span className={`font-mono text-[11px] ${changeColor}`}>
                {positive ? "+" : ""}
                {item.change.toFixed(2)}%
              </span>
            )}
          </div>
        );
      })}
      <div className="ml-auto shrink-0 flex items-center gap-1.5">
        <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
        <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-foreground/38">
          Live
        </span>
      </div>
    </div>
  );
}
