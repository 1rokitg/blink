"use client";

import { useMemo } from "react";

import {
  formatChartPrice,
  useMarketChart,
} from "~/lib/blink/chart/use-market-chart";

export function IntentMiniChart(props: { market: string; dailyUp: boolean }) {
  const { points, loading, lastPrice } = useMarketChart(props.market, "5m");
  const up = props.dailyUp;

  const pathD = useMemo(() => {
    if (points.length < 2) return "";
    const closes = points.map((p) => p.close);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const range = max - min || 1;
    const w = 100;
    const h = 48;
    const step = w / (closes.length - 1);
    return closes
      .map((close, i) => {
        const x = i * step;
        const y = h - ((close - min) / range) * h;
        return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");
  }, [points]);

  const stroke = up ? "#3be1ba" : "#ff6b8a";
  const fillId = `intent-chart-fill-${props.market.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <div className="relative h-[120px] w-full">
      {loading && points.length === 0 ? (
        <div className="flex h-full items-center justify-center">
          <div className="h-8 w-8 animate-pulse rounded-full bg-white/10" />
        </div>
      ) : (
        <svg
          viewBox="0 0 100 48"
          preserveAspectRatio="none"
          className="h-full w-full"
          role="img"
          aria-label={`${props.market} 5 minute price chart`}
        >
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>
          {pathD ? (
            <>
              <path d={`${pathD} L100,48 L0,48 Z`} fill={`url(#${fillId})`} />
              <path
                d={pathD}
                fill="none"
                stroke={stroke}
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
            </>
          ) : null}
        </svg>
      )}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 flex items-end justify-between px-1 text-[10px] text-white/40">
        <span>5m</span>
        {lastPrice > 0 ? (
          <span className="font-medium text-white/70">
            {formatChartPrice(lastPrice)}
          </span>
        ) : null}
      </div>
    </div>
  );
}
