"use client";

import { useEffect, useRef, useState } from "react";

import { useQuery } from "@tanstack/react-query";

import { createSubscriptionClient, infoClient } from "~/lib/blink/hyperliquid";
import { formatCompactNumber, formatUsd } from "~/lib/blink/markets";

type MarketCtx = {
  markPx: number;
  prevDayPx: number;
  oraclePx: number;
  dayNtlVlm: number;
  openInterest: number;
  funding: number; // hourly funding rate
};

function formatFunding(hourly: number) {
  const annualized = hourly * 24 * 365 * 100;
  const sign = annualized >= 0 ? "+" : "";
  return `${sign}${annualized.toFixed(2)}% APR`;
}

function formatHourlyFunding(hourly: number) {
  const sign = hourly >= 0 ? "+" : "";
  return `${sign}${(hourly * 100).toFixed(4)}%/hr`;
}

export function MarketInfoBar(props: { market: string }) {
  // Polling context: 24h data, OI, funding — refresh every 30s
  const ctxQuery = useQuery({
    queryKey: ["blink", "market-ctx", props.market],
    queryFn: async (): Promise<MarketCtx | null> => {
      const [meta, assetCtxs] = await infoClient.metaAndAssetCtxs();
      const idx = meta.universe.findIndex((m) => m.name === props.market);
      if (idx === -1) return null;
      const ctx = assetCtxs[idx];
      if (!ctx) return null;
      return {
        markPx: Number(ctx.markPx),
        prevDayPx: Number(ctx.prevDayPx),
        oraclePx: Number(ctx.oraclePx),
        dayNtlVlm: Number(ctx.dayNtlVlm),
        openInterest: Number(ctx.openInterest),
        funding: Number(ctx.funding),
      };
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  // Live mark price via WebSocket allMids subscription
  const [liveMark, setLiveMark] = useState<number | null>(null);
  const prevMarkRef = useRef<number | null>(null);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    let active = true;
    let subscription: { unsubscribe: () => Promise<void> } | null = null;

    async function subscribe() {
      const client = createSubscriptionClient();
      subscription = await client.allMids((data) => {
        if (!active) return;
        const raw = data.mids[props.market];
        if (!raw) return;
        const price = Number(raw);
        setLiveMark((prev) => {
          if (prev !== null && price !== prev) {
            setFlash(price > prev ? "up" : "down");
            setTimeout(() => setFlash(null), 400);
          }
          prevMarkRef.current = prev;
          return price;
        });
      });
    }

    void subscribe();
    return () => {
      active = false;
      if (subscription) void subscription.unsubscribe();
    };
  }, [props.market]);

  const ctx = ctxQuery.data;
  const displayPrice = liveMark ?? ctx?.markPx ?? 0;
  const changePct =
    ctx && ctx.prevDayPx > 0
      ? ((ctx.markPx - ctx.prevDayPx) / ctx.prevDayPx) * 100
      : 0;
  const positive = changePct >= 0;

  const priceColor =
    flash === "up"
      ? "text-emerald-300"
      : flash === "down"
        ? "text-rose-300"
        : "text-white";

  const stats = [
    {
      label: "24h Change",
      value: ctx
        ? `${positive ? "+" : ""}${changePct.toFixed(2)}%`
        : "—",
      color: ctx
        ? positive
          ? "text-emerald-300"
          : "text-rose-300"
        : "text-foreground/45",
    },
    {
      label: "24h Volume",
      value: ctx ? `$${formatCompactNumber(ctx.dayNtlVlm)}` : "—",
      color: "text-foreground/72",
    },
    {
      label: "Open Interest",
      value: ctx ? `$${formatCompactNumber(ctx.openInterest)}` : "—",
      color: "text-foreground/72",
    },
    {
      label: "Funding",
      value: ctx ? formatHourlyFunding(ctx.funding) : "—",
      title: ctx ? formatFunding(ctx.funding) : undefined,
      color:
        ctx && ctx.funding >= 0
          ? "text-emerald-300/80"
          : "text-rose-300/80",
    },
    {
      label: "Oracle",
      value: ctx ? formatUsd(ctx.oraclePx) : "—",
      color: "text-foreground/55",
    },
  ];

  return (
    <div className="glass-panel flex items-center gap-6 overflow-x-auto px-5 py-3">
      {/* Coin + live price */}
      <div className="flex shrink-0 items-baseline gap-3">
        <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-foreground/45">
          {props.market}
        </span>
        <span
          className={`font-mono text-xl font-semibold tabular-nums transition-colors duration-150 ${priceColor}`}
        >
          {displayPrice > 0 ? formatUsd(displayPrice) : "Loading…"}
        </span>
      </div>

      {/* Divider */}
      <div className="h-6 w-px shrink-0 bg-white/8" />

      {/* Stats strip */}
      <div className="flex items-center gap-6">
        {stats.map((stat) => (
          <div key={stat.label} className="shrink-0" title={stat.title}>
            <p className="text-[10px] uppercase tracking-[0.14em] text-foreground/35">
              {stat.label}
            </p>
            <p className={`mt-0.5 font-mono text-sm tabular-nums ${stat.color}`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
