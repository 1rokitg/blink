"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  BarChart3,
  LineChart,
  Loader2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { AssetIcon } from "~/components/blink/asset-icon";
import {
  type ChartInterval,
  formatChartPrice,
  formatTradeNotional,
  useMarketChart,
} from "~/lib/blink/chart/use-market-chart";
import { formatUsd } from "~/lib/blink/markets";

const INTERVAL_OPTIONS: Array<{ id: ChartInterval; label: string }> = [
  { id: "1m", label: "1m" },
  { id: "5m", label: "5m" },
  { id: "15m", label: "15m" },
  { id: "1h", label: "1h" },
];

const CHART_HEIGHT = 340;
const CHART_PAD = { top: 18, right: 72, bottom: 28, left: 88 };

function formatClock(ms: number) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(ms));
}

function formatWindowLabel(interval: ChartInterval) {
  const labels: Record<ChartInterval, string> = {
    "1m": "1 minute",
    "5m": "5 minutes",
    "15m": "15 minutes",
    "1h": "1 hour",
  };
  return labels[interval];
}

function useCountdown(targetMs: number | null) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  if (!targetMs) return { minutes: 0, seconds: 0, done: true };
  const remaining = Math.max(0, targetMs - now);
  return {
    minutes: Math.floor(remaining / 60_000),
    seconds: Math.floor((remaining % 60_000) / 1000),
    done: remaining <= 0,
  };
}

function buildAreaPath(
  points: Array<{ x: number; y: number }>,
  baselineY: number,
) {
  if (points.length === 0) return "";
  const first = points[0];
  if (!first) return "";

  let path = `M ${first.x} ${first.y}`;
  for (let i = 1; i < points.length; i++) {
    const point = points[i];
    if (!point) continue;
    const prev = points[i - 1];
    if (!prev) continue;
    const cx = (prev.x + point.x) / 2;
    path += ` C ${cx} ${prev.y}, ${cx} ${point.y}, ${point.x} ${point.y}`;
  }

  const last = points.at(-1);
  if (!last) return path;
  return `${path} L ${last.x} ${baselineY} L ${first.x} ${baselineY} Z`;
}

export function BlinkMarketChart(props: { market: string }) {
  const [interval, setChartInterval] = useState<ChartInterval>("5m");
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);

  const { points, trades, loading, error, stats, candleEndTime, reload } =
    useMarketChart(props.market, interval);
  const countdown = useCountdown(candleEndTime);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(Math.max(320, entry.contentRect.width));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const plot = useMemo(() => {
    const innerW = width - CHART_PAD.left - CHART_PAD.right;
    const innerH = CHART_HEIGHT - CHART_PAD.top - CHART_PAD.bottom;

    if (points.length < 2) {
      return {
        innerW,
        innerH,
        coords: [] as Array<{
          x: number;
          y: number;
          time: number;
          close: number;
        }>,
        yTicks: [] as number[],
        xTicks: [] as Array<{ x: number; label: string }>,
        targetY: innerH / 2,
        last: null as { x: number; y: number; close: number } | null,
        areaPath: "",
        linePath: "",
        min: 0,
        max: 1,
      };
    }

    const closes = points.map((point) => point.close);
    const min = Math.min(...closes, stats.priceToBeat);
    const max = Math.max(...closes, stats.priceToBeat);
    const range = Math.max(max - min, max * 0.0005);

    const minTime = points[0]?.time ?? 0;
    const maxTime = points.at(-1)?.time ?? minTime + 1;
    const timeRange = Math.max(maxTime - minTime, 1);

    const coords = points.map((point) => {
      const x = CHART_PAD.left + ((point.time - minTime) / timeRange) * innerW;
      const y = CHART_PAD.top + ((max - point.close) / range) * innerH;
      return { x, y, time: point.time, close: point.close };
    });

    const targetY =
      CHART_PAD.top + ((max - stats.priceToBeat) / range) * innerH;
    const last = coords.at(-1) ?? null;

    const yTicks = Array.from({ length: 5 }, (_, index) => {
      const ratio = index / 4;
      return max - ratio * range;
    });

    const xTickIndexes = [0, Math.floor(points.length / 2), points.length - 1];
    const xTicks = xTickIndexes
      .map((index) => points[index])
      .filter((point): point is (typeof points)[number] => Boolean(point))
      .map((point) => ({
        x: CHART_PAD.left + ((point.time - minTime) / timeRange) * innerW,
        label: formatClock(point.time),
      }));

    const lineOnly = coords.map(({ x, y }) => ({ x, y }));
    const areaPath = buildAreaPath(coords, CHART_PAD.top + innerH);
    const linePath = lineOnly
      .map((point, index) =>
        index === 0 ? `M ${point.x} ${point.y}` : `L ${point.x} ${point.y}`,
      )
      .join(" ");

    return {
      innerW,
      innerH,
      coords,
      yTicks,
      xTicks,
      targetY,
      last,
      areaPath,
      linePath,
      min,
      max,
      minTime,
      maxTime,
      timeRange,
    };
  }, [points, stats.priceToBeat, width]);

  const tradeMarkers = useMemo(() => {
    if (!plot.last || points.length < 2) return [];
    const minTime = points[0]?.time ?? 0;
    const maxTime = points.at(-1)?.time ?? minTime + 1;
    const timeRange = Math.max(maxTime - minTime, 1);
    const range = Math.max(plot.max - plot.min, plot.max * 0.0005);

    return trades
      .filter((trade) => trade.time >= minTime && trade.time <= maxTime + 5_000)
      .slice(0, 8)
      .map((trade, index) => {
        const x =
          CHART_PAD.left + ((trade.time - minTime) / timeRange) * plot.innerW;
        const y =
          CHART_PAD.top + ((plot.max - trade.price) / range) * plot.innerH;
        return { ...trade, x, y, offset: index * 18 };
      });
  }, [plot, points, trades]);

  const positive = stats.changeUsd >= 0;
  const lineColor = positive ? "#3be1ba" : "#fb7185";
  const lineGlow = positive ? "#3be1ba88" : "#fb718588";

  return (
    <section className="glass-panel flex min-h-[640px] flex-col overflow-hidden p-2">
      <div
        ref={containerRef}
        className="flex min-h-[620px] flex-1 flex-col overflow-hidden rounded-[12px] border border-[#88b3ff2e] bg-[#060510]"
      >
        {/* Header — Polymarket-style metric row */}
        <div className="border-b border-white/[0.06] px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
                <AssetIcon asset={props.market} size={28} />
              </div>
              <div>
                <p className="text-lg font-semibold text-white">
                  {props.market} · Blink chart
                </p>
                <p className="text-xs text-foreground/45">
                  Hyperliquid · {formatWindowLabel(interval)} window
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-6">
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-foreground/42">
                  Price to beat
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
                  ${formatChartPrice(stats.priceToBeat)}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-[#3be1ba]/70">
                  Current price
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <p
                    className="text-2xl font-semibold tabular-nums"
                    style={{ color: lineColor }}
                  >
                    ${formatChartPrice(stats.currentPrice)}
                  </p>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      positive
                        ? "bg-emerald-400/10 text-emerald-300"
                        : "bg-rose-400/10 text-rose-300"
                    }`}
                  >
                    {positive ? (
                      <TrendingUp className="size-3" />
                    ) : (
                      <TrendingDown className="size-3" />
                    )}
                    {positive ? "+" : ""}
                    {formatUsd(stats.changeUsd)}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-[0.14em] text-foreground/42">
                  Candle closes
                </p>
                <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-rose-300">
                  {String(countdown.minutes).padStart(2, "0")}
                  <span className="mx-1 text-sm text-foreground/35">mins</span>
                  {String(countdown.seconds).padStart(2, "0")}
                  <span className="ml-1 text-sm text-foreground/35">secs</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Chart canvas */}
        <div className="relative flex-1 px-1 py-2">
          {loading ? (
            <div className="flex h-[360px] items-center justify-center">
              <Loader2 className="size-6 animate-spin text-foreground/35" />
            </div>
          ) : error ? (
            <div className="flex h-[360px] flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="text-sm text-rose-300/90">{error}</p>
              <button
                type="button"
                onClick={() => void reload()}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:bg-white/[0.05]"
              >
                Retry
              </button>
            </div>
          ) : (
            <svg
              width={width}
              height={CHART_HEIGHT}
              className="overflow-visible"
              role="img"
              aria-label={`${props.market} price chart`}
            >
              <title>{`${props.market} live price chart`}</title>
              <defs>
                <linearGradient id="blinkChartFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={lineColor} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                </linearGradient>
                <filter id="blinkChartGlow">
                  <feGaussianBlur stdDeviation="2.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Horizontal grid */}
              {plot.yTicks.map((tick) => {
                const y =
                  CHART_PAD.top +
                  ((plot.max - tick) / Math.max(plot.max - plot.min, 1)) *
                    plot.innerH;
                return (
                  <g key={tick}>
                    <line
                      x1={CHART_PAD.left}
                      x2={width - CHART_PAD.right}
                      y1={y}
                      y2={y}
                      stroke="#ffffff10"
                      strokeDasharray="4 6"
                    />
                    <text
                      x={width - CHART_PAD.right + 8}
                      y={y + 4}
                      fill="#ffffff55"
                      fontSize="10"
                    >
                      ${formatChartPrice(tick)}
                    </text>
                  </g>
                );
              })}

              {/* Target line */}
              <line
                x1={CHART_PAD.left}
                x2={width - CHART_PAD.right}
                y1={plot.targetY}
                y2={plot.targetY}
                stroke="#ffffff30"
                strokeDasharray="5 5"
              />
              <rect
                x={width - CHART_PAD.right - 52}
                y={plot.targetY - 10}
                width={48}
                height={18}
                rx={9}
                fill="#ffffff12"
              />
              <text
                x={width - CHART_PAD.right - 28}
                y={plot.targetY + 4}
                fill="#ffffff70"
                fontSize="10"
                textAnchor="middle"
              >
                Target
              </text>

              {/* Area + line */}
              {plot.areaPath ? (
                <path d={plot.areaPath} fill="url(#blinkChartFill)" />
              ) : null}
              {plot.linePath ? (
                <path
                  d={plot.linePath}
                  fill="none"
                  stroke={lineColor}
                  strokeWidth={2.5}
                  filter="url(#blinkChartGlow)"
                />
              ) : null}

              {/* Live dot */}
              {plot.last ? (
                <>
                  <line
                    x1={CHART_PAD.left}
                    x2={plot.last.x}
                    y1={plot.last.y}
                    y2={plot.last.y}
                    stroke={lineGlow}
                    strokeDasharray="3 4"
                  />
                  <circle
                    cx={plot.last.x}
                    cy={plot.last.y}
                    r={10}
                    fill="none"
                    stroke={lineColor}
                    strokeOpacity={0.35}
                    strokeWidth={1.5}
                    strokeDasharray="2 3"
                  />
                  <circle
                    cx={plot.last.x}
                    cy={plot.last.y}
                    r={4.5}
                    fill={lineColor}
                    stroke="#060510"
                    strokeWidth={2}
                  />
                </>
              ) : null}

              {/* X axis labels */}
              {plot.xTicks.map((tick) => (
                <text
                  key={tick.label}
                  x={tick.x}
                  y={CHART_HEIGHT - 8}
                  fill="#ffffff45"
                  fontSize="10"
                  textAnchor="middle"
                >
                  {tick.label}
                </text>
              ))}
            </svg>
          )}

          {/* Trade fill stream — Polymarket-style left annotations */}
          {!loading && !error ? (
            <div className="pointer-events-none absolute inset-y-8 left-3 flex w-[84px] flex-col justify-center gap-2">
              {tradeMarkers.map((trade) => (
                <div
                  key={trade.id}
                  className="opacity-90 transition-opacity"
                  style={{
                    transform: `translateY(${trade.offset - 36}px)`,
                  }}
                >
                  <span
                    className={`inline-flex rounded-md px-2 py-1 text-[11px] font-bold tabular-nums shadow-lg ${
                      trade.side === "buy"
                        ? "bg-[#3be1ba22] text-[#7ef0d2] ring-1 ring-[#3be1ba40]"
                        : "bg-[#fb718522] text-[#fecdd3] ring-1 ring-[#fb718540]"
                    }`}
                  >
                    + {formatTradeNotional(trade.notionalUsd)}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* Footer controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] px-4 py-3">
          <div className="flex flex-wrap gap-1.5">
            {INTERVAL_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setChartInterval(option.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  interval === option.id
                    ? "bg-white text-[#060510]"
                    : "bg-white/[0.04] text-foreground/55 hover:text-white"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#3be1ba20] px-2.5 py-1.5 text-xs font-medium text-[#9af0d8]">
              <LineChart className="size-3.5" />
              Line
            </span>
            <span
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-foreground/35"
              title="Candles coming soon"
            >
              <BarChart3 className="size-3.5" />
              Candles
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
