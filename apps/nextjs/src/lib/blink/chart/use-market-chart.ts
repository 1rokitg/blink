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
  const [candleEndTime, setCandleEndTime] = useState<number | null>(null);
  const pointsRef = useRef<ChartPoint[]>([]);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const endTime = Date.now();
      const startTime = endTime - LOOKBACK_CANDLES * INTERVAL_MS[interval];
      const candles = await infoClient.candleSnapshot({
        coin: market,
        interval,
        startTime,
        endTime,
      });
      const parsed = candles.map(parseCandle);
      pointsRef.current = parsed;
      setPoints(parsed);
      const last = parsed.at(-1);
      setCandleEndTime(last ? last.time + INTERVAL_MS[interval] : null);
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
    let tradesSub: hl.Subscription | null = null;

    async function subscribe() {
      const client = createSubscriptionClient();

      candleSub = await client.candle({ coin: market, interval }, (candle) => {
        if (!active) return;
        const point = parseCandle(candle);
        const next = mergeCandles(pointsRef.current, [point]);
        pointsRef.current = next;
        setPoints(next);
        setCandleEndTime(point.time + INTERVAL_MS[interval]);
      });

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
      tradesSub?.unsubscribe();
    };
  }, [interval, market]);

  const stats = useMemo(() => {
    if (points.length === 0) {
      return {
        priceToBeat: 0,
        currentPrice: 0,
        changeUsd: 0,
        changePct: 0,
      };
    }
    const first = points[0];
    const last = points.at(-1);
    if (!first || !last) {
      return {
        priceToBeat: 0,
        currentPrice: 0,
        changeUsd: 0,
        changePct: 0,
      };
    }
    const priceToBeat = first.open;
    const currentPrice = last.close;
    const changeUsd = currentPrice - priceToBeat;
    const changePct = priceToBeat > 0 ? (changeUsd / priceToBeat) * 100 : 0;
    return { priceToBeat, currentPrice, changeUsd, changePct };
  }, [points]);

  return {
    points,
    trades,
    loading,
    error,
    stats,
    candleEndTime,
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
