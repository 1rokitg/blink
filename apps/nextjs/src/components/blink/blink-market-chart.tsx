"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { BarChart3, LineChart, Loader2 } from "lucide-react";

import { AssetIcon } from "~/components/blink/asset-icon";
import { ChartFillStream } from "~/components/blink/chart-fill-stream";
import {
  formatNyDailyCloseCountdown,
  getMillisecondsUntilNyMidnight,
} from "~/lib/blink/chart/ny-daily-close";
import {
  type ChartInterval,
  formatChartPrice,
  useMarketChart,
} from "~/lib/blink/chart/use-market-chart";
import { resolvePerpMarket } from "~/lib/blink/hyperliquid";
import { formatUsd } from "~/lib/blink/markets";

const CHART_UP = "#34d399";
const CHART_DOWN = "#fb7185";
const BLINK_ACCENT = "#7fa8ff";

const INTERVAL_OPTIONS: Array<{ id: ChartInterval; label: string }> = [
  { id: "1m", label: "1m" },
  { id: "5m", label: "5m" },
  { id: "15m", label: "15m" },
  { id: "1h", label: "1h" },
];

const CHART_PAD = { top: 14, right: 68, bottom: 24, left: 84 };
const DEFAULT_CHART_HEIGHT = 320;

function formatClock(ms: number) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(ms));
}

function useNyDailyCloseCountdown() {
  const [remainingMs, setRemainingMs] = useState(() =>
    getMillisecondsUntilNyMidnight(),
  );

  useEffect(() => {
    const id = setInterval(() => {
      setRemainingMs(getMillisecondsUntilNyMidnight());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return formatNyDailyCloseCountdown(remainingMs);
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
  const chartAreaRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [chartHeight, setChartHeight] = useState(DEFAULT_CHART_HEIGHT);

  const { points, trades, loading, error, dailyUp, dayOpen, reload } =
    useMarketChart(props.market, interval);
  const nyCloseCountdown = useNyDailyCloseCountdown();

  const marketCtxQuery = useQuery({
    queryKey: ["blink", "chart-ctx", props.market],
    queryFn: async () => {
      const market = await resolvePerpMarket(props.market);
      const ctx = market.assetCtx;
      if (!ctx) return null;
      return {
        markPx: Number(ctx.markPx ?? 0),
        oraclePx: Number(ctx.oraclePx ?? 0),
      };
    },
    staleTime: 2_000,
    refetchInterval: 3_000,
  });

  const markPx = marketCtxQuery.data?.markPx ?? 0;
  const oraclePx = marketCtxQuery.data?.oraclePx ?? 0;

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setWidth(Math.max(320, Math.floor(entry.contentRect.width)));
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const node = chartAreaRef.current;
    if (!node) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setChartHeight(Math.max(180, Math.floor(entry.contentRect.height)));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const plot = useMemo(() => {
    const innerW = width - CHART_PAD.left - CHART_PAD.right;
    const innerH = chartHeight - CHART_PAD.top - CHART_PAD.bottom;

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
        markY: null as number | null,
        oracleY: null as number | null,
        last: null as { x: number; y: number; close: number } | null,
        areaPath: "",
        linePath: "",
        min: 0,
        max: 1,
      };
    }

    const closes = points.map((point) => point.close);
    const referencePrices = [dayOpen, markPx, oraclePx].filter(
      (value) => value > 0,
    );
    const min = Math.min(...closes, ...referencePrices);
    const max = Math.max(...closes, ...referencePrices);
    const range = Math.max(max - min, max * 0.0005);

    const minTime = points[0]?.time ?? 0;
    const maxTime = points.at(-1)?.time ?? minTime + 1;
    const timeRange = Math.max(maxTime - minTime, 1);

    const coords = points.map((point) => {
      const x = CHART_PAD.left + ((point.time - minTime) / timeRange) * innerW;
      const y = CHART_PAD.top + ((max - point.close) / range) * innerH;
      return { x, y, time: point.time, close: point.close };
    });

    const priceToY = (price: number) =>
      CHART_PAD.top + ((max - price) / range) * innerH;

    const markY = markPx > 0 ? priceToY(markPx) : null;
    const oracleY = oraclePx > 0 ? priceToY(oraclePx) : null;
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
      markY,
      oracleY,
      last,
      areaPath,
      linePath,
      min,
      max,
      minTime,
      maxTime,
      timeRange,
      priceToY,
    };
  }, [chartHeight, dayOpen, markPx, oraclePx, points, width]);

  const tradeMarkers = useMemo(() => {
    if (!plot.last || points.length < 2) return [];
    const minTime = points[0]?.time ?? 0;
    const maxTime = points.at(-1)?.time ?? minTime + 1;
    const timeRange = Math.max(maxTime - minTime, 1);
    const range = Math.max(plot.max - plot.min, plot.max * 0.0005);

    return trades
      .filter((trade) => trade.time >= minTime && trade.time <= maxTime + 5_000)
      .slice(0, 10)
      .map((trade) => {
        const x =
          CHART_PAD.left + ((trade.time - minTime) / timeRange) * plot.innerW;
        const y =
          CHART_PAD.top + ((plot.max - trade.price) / range) * plot.innerH;
        return {
          id: trade.id,
          side: trade.side,
          notionalUsd: trade.notionalUsd,
          x,
          y,
        };
      });
  }, [plot, points, trades]);

  const lineColor = dailyUp ? CHART_UP : CHART_DOWN;
  const lineGlow = dailyUp ? `${CHART_UP}88` : `${CHART_DOWN}88`;
  const markOracleSpread = markPx > 0 && oraclePx > 0 ? markPx - oraclePx : 0;

  return (
    <section className="glass-panel flex h-[520px] min-h-0 flex-col overflow-hidden p-2">
      <div
        ref={containerRef}
        className="flex h-full min-h-0 flex-col overflow-hidden rounded-[12px] border border-[#88b3ff2e] bg-[#060510]"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.06] px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <AssetIcon asset={props.market} size={22} />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold text-white">
                {props.market}
              </p>
              <p className="text-[10px] text-foreground/40">
                Hyperliquid · {interval}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3 overflow-x-auto sm:gap-4">
            <div className="text-right">
              <p className="text-[9px] font-medium uppercase tracking-[0.14em] text-foreground/38">
                Mark
              </p>
              <p
                className={`font-mono text-sm font-semibold tabular-nums text-[#9ec0ff] ${
                  markPx > 0 ? "rounded-md px-1.5 py-0.5" : ""
                }`}
                style={
                  markPx > 0
                    ? {
                        animation: "blink-mark-price-pulse 2.4s ease-in-out infinite",
                      }
                    : undefined
                }
              >
                {markPx > 0 ? formatUsd(markPx) : "—"}
              </p>
            </div>
            <div className="h-7 w-px shrink-0 bg-white/[0.08]" />
            <div className="text-right">
              <p className="text-[9px] font-medium uppercase tracking-[0.14em] text-foreground/38">
                Oracle
              </p>
              <p className="font-mono text-sm font-semibold tabular-nums text-foreground/72">
                {oraclePx > 0 ? formatUsd(oraclePx) : "—"}
                {markPx > 0 && oraclePx > 0 ? (
                  <span className="ml-1 text-[10px] font-normal text-foreground/38">
                    ({markOracleSpread >= 0 ? "+" : ""}
                    {formatUsd(markOracleSpread)})
                  </span>
                ) : null}
              </p>
            </div>
            <div className="h-7 w-px shrink-0 bg-white/[0.08]" />
            <div className="text-right">
              <p className="text-[9px] font-medium uppercase tracking-[0.14em] text-[#7fa8ff]/75">
                NY close
              </p>
              <p className="font-mono text-sm font-medium tabular-nums text-[#9ec0ff]">
                {nyCloseCountdown}
              </p>
            </div>
          </div>
        </div>

        <div ref={chartAreaRef} className="relative min-h-0 flex-1 px-1 py-1">
          <style>{`
            @keyframes blink-mark-price-pulse {
              0%,
              100% {
                text-shadow: 0 0 0 transparent;
                opacity: 1;
              }
              50% {
                text-shadow: 0 0 14px rgba(127, 168, 255, 0.55);
                opacity: 0.92;
              }
            }
          `}</style>
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="size-6 animate-spin text-foreground/35" />
            </div>
          ) : error ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
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
              width="100%"
              height={chartHeight}
              viewBox={`0 0 ${width} ${chartHeight}`}
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

              {/* Mark reference — live pulse */}
              {plot.markY !== null ? (
                <g>
                  <line
                    x1={CHART_PAD.left}
                    x2={width - CHART_PAD.right}
                    y1={plot.markY}
                    y2={plot.markY}
                    stroke={BLINK_ACCENT}
                    strokeWidth={1.25}
                    strokeDasharray="4 5"
                  >
                    <animate
                      attributeName="stroke-opacity"
                      values="0.28;0.72;0.28"
                      dur="2.4s"
                      repeatCount="indefinite"
                    />
                  </line>
                  <circle
                    cx={plot.last?.x ?? width - CHART_PAD.right - 6}
                    cy={plot.markY}
                    r={8}
                    fill={BLINK_ACCENT}
                    fillOpacity={0}
                    stroke={BLINK_ACCENT}
                    strokeWidth={1.25}
                  >
                    <animate
                      attributeName="r"
                      values="5;11;5"
                      dur="2.4s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="stroke-opacity"
                      values="0.55;0.12;0.55"
                      dur="2.4s"
                      repeatCount="indefinite"
                    />
                  </circle>
                  <circle
                    cx={plot.last?.x ?? width - CHART_PAD.right - 6}
                    cy={plot.markY}
                    r={3.5}
                    fill={BLINK_ACCENT}
                  >
                    <animate
                      attributeName="opacity"
                      values="0.75;1;0.75"
                      dur="2.4s"
                      repeatCount="indefinite"
                    />
                  </circle>
                  <text
                    x={width - CHART_PAD.right + 2}
                    y={plot.markY + 3}
                    fill={BLINK_ACCENT}
                    fontSize="9"
                  >
                    Mark
                    <animate
                      attributeName="opacity"
                      values="0.55;1;0.55"
                      dur="2.4s"
                      repeatCount="indefinite"
                    />
                  </text>
                </g>
              ) : null}

              {/* Oracle reference */}
              {plot.oracleY !== null ? (
                <g>
                  <line
                    x1={CHART_PAD.left}
                    x2={width - CHART_PAD.right}
                    y1={plot.oracleY}
                    y2={plot.oracleY}
                    stroke="#ffffff35"
                    strokeDasharray="3 6"
                  />
                  <text
                    x={width - CHART_PAD.right + 2}
                    y={plot.oracleY + 3}
                    fill="#ffffff55"
                    fontSize="9"
                  >
                    Oracle
                  </text>
                </g>
              ) : null}

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
                  y={chartHeight - 8}
                  fill="#ffffff45"
                  fontSize="10"
                  textAnchor="middle"
                >
                  {tick.label}
                </text>
              ))}
            </svg>
          )}

          {!loading && !error ? (
            <ChartFillStream trades={tradeMarkers} />
          ) : null}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-white/[0.06] px-3 py-1.5">
          <div className="flex gap-1">
            {INTERVAL_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setChartInterval(option.id)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                  interval === option.id
                    ? "bg-white text-[#060510]"
                    : "bg-white/[0.04] text-foreground/55 hover:text-white"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
            <span
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium"
              style={{
                backgroundColor: dailyUp ? `${CHART_UP}22` : `${CHART_DOWN}22`,
                color: dailyUp ? "#9ef0d2" : "#fecdd3",
              }}
            >
              <LineChart className="size-3" />
              {dailyUp ? "Day up" : "Day down"}
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-foreground/35"
              title="Candles coming soon"
            >
              <BarChart3 className="size-3" />
              Candles
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
