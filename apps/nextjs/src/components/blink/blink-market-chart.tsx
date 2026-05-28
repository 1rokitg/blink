"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { BarChart3, LineChart, Loader2 } from "lucide-react";

import { AssetIcon } from "~/components/blink/asset-icon";
import {
  formatNyDailyCloseCountdown,
  getMillisecondsUntilNyMidnight,
} from "~/lib/blink/chart/ny-daily-close";
import {
  type ChartInterval,
  formatChartPrice,
  formatTradeNotional,
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

const CHART_HEIGHT = 340;
const CHART_PAD = { top: 18, right: 72, bottom: 28, left: 88 };

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
  const [width, setWidth] = useState(720);

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
  }, [dayOpen, markPx, oraclePx, points, width]);

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

  const lineColor = dailyUp ? CHART_UP : CHART_DOWN;
  const lineGlow = dailyUp ? `${CHART_UP}88` : `${CHART_DOWN}88`;
  const markOracleSpread = markPx > 0 && oraclePx > 0 ? markPx - oraclePx : 0;

  return (
    <section className="glass-panel flex min-h-[640px] flex-col overflow-hidden p-2">
      <div
        ref={containerRef}
        className="flex min-h-[620px] flex-1 flex-col overflow-hidden rounded-[12px] border border-[#88b3ff2e] bg-[#060510]"
      >
        {/* Header — Hyperliquid perp metrics */}
        <div className="border-b border-white/[0.06] px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
                <AssetIcon asset={props.market} size={28} />
              </div>
              <div>
                <p className="text-lg font-semibold text-white">
                  {props.market} perp chart
                </p>
                <p className="text-xs text-foreground/45">
                  Hyperliquid · {interval} · line colored by daily candle
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-5 md:gap-7">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-foreground/42">
                  Mark
                </p>
                <p className="mt-0.5 font-mono text-xl font-semibold tabular-nums text-white">
                  {markPx > 0 ? formatUsd(markPx) : "—"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-foreground/42">
                  Oracle
                </p>
                <p className="mt-0.5 font-mono text-xl font-semibold tabular-nums text-foreground/72">
                  {oraclePx > 0 ? formatUsd(oraclePx) : "—"}
                </p>
                {markPx > 0 && oraclePx > 0 ? (
                  <p className="mt-0.5 text-[10px] tabular-nums text-foreground/38">
                    Δ {markOracleSpread >= 0 ? "+" : ""}
                    {formatUsd(markOracleSpread)}
                  </p>
                ) : null}
              </div>
              <div className="text-right">
                <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-[#7fa8ff]/80">
                  Daily close · NY
                </p>
                <p className="mt-0.5 font-mono text-sm font-medium tabular-nums text-[#9ec0ff]">
                  {nyCloseCountdown}
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

              {/* Mark reference */}
              {plot.markY !== null ? (
                <g>
                  <line
                    x1={CHART_PAD.left}
                    x2={width - CHART_PAD.right}
                    y1={plot.markY}
                    y2={plot.markY}
                    stroke={BLINK_ACCENT}
                    strokeOpacity={0.55}
                    strokeDasharray="4 5"
                  />
                  <text
                    x={width - CHART_PAD.right + 2}
                    y={plot.markY + 3}
                    fill={BLINK_ACCENT}
                    fontSize="9"
                  >
                    Mark
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

          {/* Live perp fill stream */}
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
            <span
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium"
              style={{
                backgroundColor: dailyUp ? `${CHART_UP}22` : `${CHART_DOWN}22`,
                color: dailyUp ? "#9ef0d2" : "#fecdd3",
              }}
            >
              <LineChart className="size-3.5" />
              Line · {dailyUp ? "day up" : "day down"}
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
