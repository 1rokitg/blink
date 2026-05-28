"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type * as hl from "@nktkas/hyperliquid";

import { createSubscriptionClient, infoClient } from "~/lib/blink/hyperliquid";

export type ChartInterval = "1m" | "5m" | "15m" | "1h";

export type ChartPoint = {
  time: number;
  close: number;
  open: number;
  high: number;
  low: number;
};

export type ChartTradeTick = {
  id: string;
  time: number;
  price: number;
  notionalUsd: number;
  side: "buy" | "sell";
};

const INTERVAL_MS: Record<ChartInterval, number> = {
  "1m": 60_000,
  "5m": 5 * 60_000,
  "15m": 15 * 60_000,
  "1h": 60 * 60_000,
};

const LOOKBACK_CANDLES = 120;

function parseCandle(candle: hl.Candle): ChartPoint {
  return {
    time: candle.t,
    open: Number(candle.o),
    close: Number(candle.c),
    high: Number(candle.h),
    low: Number(candle.l),
  };
}

function mergeCandles(existing: ChartPoint[], incoming: ChartPoint[]) {
  const map = new Map<number, ChartPoint>();
  for (const point of existing) map.set(point.time, point);
  for (const point of incoming) map.set(point.time, point);
  return Array.from(map.values())
    .sort((a, b) => a.time - b.time)
    .slice(-LOOKBACK_CANDLES);
}

function buildTradeId(trade: {
  time: number;
  px: string;
  sz: string;
  side: string;
}) {
  return `${trade.time}-${trade.px}-${trade.sz}-${trade.side}`;
}

export function useMarketChart(market: string, interval: ChartInterval) {
  const [points, setPoints] = useState<ChartPoint[]>([]);
  const [trades, setTrades] = useState<ChartTradeTick[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dailyUp, setDailyUp] = useState(true);
  const [dayOpen, setDayOpen] = useState(0);
  const pointsRef = useRef<ChartPoint[]>([]);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const endTime = Date.now();
      const startTime = endTime - LOOKBACK_CANDLES * INTERVAL_MS[interval];

      const [candles, dailyCandles] = await Promise.all([
        infoClient.candleSnapshot({
          coin: market,
          interval,
          startTime,
          endTime,
        }),
        infoClient.candleSnapshot({
          coin: market,
          interval: "1d",
          startTime: endTime - 5 * 24 * 60 * 60 * 1000,
          endTime,
        }),
      ]);

      const parsed = candles.map(parseCandle);
      pointsRef.current = parsed;
      setPoints(parsed);

      const latestDay = dailyCandles.at(-1);
      if (latestDay) {
        const open = Number(latestDay.o);
        const close = Number(latestDay.c);
        setDayOpen(open);
        setDailyUp(close >= open);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load chart");
      setPoints([]);
    } finally {
      setLoading(false);
    }
  }, [interval, market]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    let active = true;
    let candleSub: hl.Subscription | null = null;
    let dailySub: hl.Subscription | null = null;
    let tradesSub: hl.Subscription | null = null;

    async function subscribe() {
      const client = createSubscriptionClient();

      candleSub = await client.candle({ coin: market, interval }, (candle) => {
        if (!active) return;
        const point = parseCandle(candle);
        const next = mergeCandles(pointsRef.current, [point]);
        pointsRef.current = next;
        setPoints(next);
      });

      dailySub = await client.candle(
        { coin: market, interval: "1d" },
        (candle) => {
          if (!active) return;
          const open = Number(candle.o);
          const close = Number(candle.c);
          setDayOpen(open);
          setDailyUp(close >= open);
        },
      );

      tradesSub = await client.trades({ coin: market }, (data) => {
        if (!active) return;
        const incoming: ChartTradeTick[] = data.map((trade) => {
          const price = Number(trade.px);
          const size = Number(trade.sz);
          return {
            id: buildTradeId(trade),
            time: trade.time,
            price,
            notionalUsd: price * size,
            side: trade.side === "A" ? "sell" : "buy",
          };
        });
        setTrades((prev) => {
          const seen = new Set<string>();
          return [...incoming, ...prev]
            .filter((trade) => {
              if (seen.has(trade.id)) return false;
              seen.add(trade.id);
              return true;
            })
            .slice(0, 24);
        });
      });
    }

    void subscribe();

    return () => {
      active = false;
      candleSub?.unsubscribe();
      dailySub?.unsubscribe();
      tradesSub?.unsubscribe();
    };
  }, [interval, market]);

  const lastPrice = useMemo(() => points.at(-1)?.close ?? 0, [points]);

  return {
    points,
    trades,
    loading,
    error,
    dailyUp,
    dayOpen,
    lastPrice,
    reload: loadHistory,
  };
}

export function formatChartPrice(value: number) {
  if (!Number.isFinite(value)) return "—";
  if (value >= 10_000) {
    return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
  }
  if (value >= 100) {
    return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
  return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

export function formatTradeNotional(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${Math.round(value)}`;
}
