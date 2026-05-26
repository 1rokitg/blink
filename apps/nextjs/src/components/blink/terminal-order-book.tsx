"use client";

import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@acme/ui/tabs";
import type * as hl from "@nktkas/hyperliquid";

import { createSubscriptionClient } from "~/lib/blink/hyperliquid";

// ─── Types ───────────────────────────────────────────────────────────────────

type BookLevelRow = { price: number; size: number; total: number };
type PaddedBookLevelRow = {
  id: string;
  row: BookLevelRow | null;
};

type FormattedTrade = {
  id: string;
  time: number;
  side: "buy" | "sell";
  price: number;
  size: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const LEVELS = 16;
const TRADES_LIMIT = 30;

function buildTradeId(trade: {
  px: string;
  side: string;
  sz: string;
  time: number;
}) {
  return `${trade.time}-${trade.side}-${trade.px}-${trade.sz}`;
}

function padBookRows(
  rows: BookLevelRow[],
  count: number,
  position: "start" | "end",
  prefix: string,
): PaddedBookLevelRow[] {
  if (rows.length >= count) {
    return rows.slice(0, count).map((row) => ({
      id: `${prefix}-${row.price}`,
      row,
    }));
  }

  const padding = Array.from({ length: count - rows.length }, (_, index) => ({
    id: `${prefix}-empty-${index}`,
    row: null,
  }));
  const populated = rows.map((row) => ({
    id: `${prefix}-${row.price}`,
    row,
  }));
  return position === "start"
    ? [...padding, ...populated]
    : [...populated, ...padding];
}

function formatBookLevels(
  levels: hl.Book["levels"][0],
  reverse = false,
): BookLevelRow[] {
  const depth = Math.min(LEVELS, levels.length);
  const rows = levels.slice(0, depth).map((level, index) => ({
    price: Number(level.px),
    size: Number(level.sz),
    total: levels.slice(0, index + 1).reduce((sum, l) => sum + Number(l.sz), 0),
  }));
  return reverse ? rows.reverse() : rows;
}

function fmtPrice(n: number) {
  if (n < 0.0001) return n.toFixed(6);
  if (n < 0.01) return n.toFixed(5);
  if (n < 1) return n.toFixed(4);
  if (n < 10) return n.toFixed(3);
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function fmtSize(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  if (n < 0.001) return n.toFixed(6);
  if (n < 1) return n.toFixed(4);
  return n.toFixed(3);
}

function fmtTradeTime(time: number) {
  return new Date(time).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// Depth-fade: row closest to mid → opacity 1.0, farthest → 0.28
function depthOpacity(index: number, total: number, closestIsLow: boolean) {
  const pos = closestIsLow
    ? index / (total - 1)
    : (total - 1 - index) / (total - 1);
  return 0.28 + 0.72 * pos;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TerminalOrderBook(props: { market: string }) {
  const [activeTab, setActiveTab] = useState<"orderbook" | "trades">(
    "orderbook",
  );
  const [book, setBook] = useState<hl.Book | null>(null);
  const [trades, setTrades] = useState<FormattedTrade[]>([]);
  const [changedRows, setChangedRows] = useState<Record<string, "up" | "down">>(
    {},
  );
  const [spreadPulse, setSpreadPulse] = useState<"up" | "down" | null>(null);
  const lastSizesRef = useRef<Map<string, number>>(new Map());
  const lastSpreadRef = useRef<number | null>(null);
  const tradesListRef = useRef<HTMLDivElement | null>(null);

  // ── WebSocket subscriptions ───────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    let bookSub: hl.Subscription | null = null;
    let tradesSub: hl.Subscription | null = null;

    async function subscribe() {
      const client = createSubscriptionClient();

      bookSub = await client.l2Book({ coin: props.market }, (data) => {
        if (active) setBook(data);
      });

      tradesSub = await client.trades({ coin: props.market }, (data) => {
        if (!active) return;
        const incoming: FormattedTrade[] = data.map((t) => ({
          id: buildTradeId(t),
          time: t.time,
          side: t.side === "A" ? "sell" : "buy",
          price: Number(t.px),
          size: Number(t.sz),
        }));
        setTrades((prev) => {
          const seen = new Set<string>();
          return [...incoming, ...prev]
            .filter((trade) => {
              if (seen.has(trade.id)) return false;
              seen.add(trade.id);
              return true;
            })
            .slice(0, TRADES_LIMIT);
        });
      });
    }

    void subscribe();

    return () => {
      active = false;
      bookSub?.unsubscribe();
      tradesSub?.unsubscribe();
    };
  }, [props.market]);

  // ── Derived book data ─────────────────────────────────────────────────────
  const asks = useMemo(
    () => (book ? formatBookLevels(book.levels[1], true) : []),
    [book],
  );
  const bids = useMemo(
    () => (book ? formatBookLevels(book.levels[0]) : []),
    [book],
  );
  const paddedAsks = useMemo(
    () => padBookRows(asks, LEVELS, "start", "ask"),
    [asks],
  );
  const paddedBids = useMemo(
    () => padBookRows(bids, LEVELS, "end", "bid"),
    [bids],
  );

  const bestAsk = asks.at(-1)?.price ?? 0;
  const bestBid = bids.at(0)?.price ?? 0;
  const spread = bestAsk && bestBid ? bestAsk - bestBid : 0;
  const maxTotal = Math.max(
    1,
    ...asks.map((r) => r.total),
    ...bids.map((r) => r.total),
  );

  // ── Flash on size change ──────────────────────────────────────────────────
  useEffect(() => {
    if (!asks.length && !bids.length) return;
    const updates: Record<string, "up" | "down"> = {};
    const nowSizes = new Map<string, number>();

    for (const ask of asks) {
      const key = `ask-${ask.price}`;
      const prev = lastSizesRef.current.get(key);
      if (prev !== undefined && prev !== ask.size)
        updates[key] = ask.size > prev ? "up" : "down";
      nowSizes.set(key, ask.size);
    }
    for (const bid of bids) {
      const key = `bid-${bid.price}`;
      const prev = lastSizesRef.current.get(key);
      if (prev !== undefined && prev !== bid.size)
        updates[key] = bid.size > prev ? "up" : "down";
      nowSizes.set(key, bid.size);
    }

    lastSizesRef.current = nowSizes;
    if (Object.keys(updates).length === 0) return;

    setChangedRows((prev) => ({ ...prev, ...updates }));
    const t = window.setTimeout(() => {
      setChangedRows((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(updates)) delete next[key];
        return next;
      });
    }, 500);
    return () => window.clearTimeout(t);
  }, [asks, bids]);

  // ── Spread pulse ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!spread) return;
    const prev = lastSpreadRef.current;
    if (prev !== null && prev !== spread) {
      setSpreadPulse(spread < prev ? "up" : "down");
      const t = window.setTimeout(() => setSpreadPulse(null), 500);
      lastSpreadRef.current = spread;
      return () => window.clearTimeout(t);
    }
    lastSpreadRef.current = spread;
  }, [spread]);

  useEffect(() => {
    if (activeTab !== "trades") return;
    tradesListRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [activeTab]);

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <section className="glass-panel flex h-full flex-col overflow-hidden p-3">
      {/* Header */}
      <div className="mb-2 shrink-0">
        <p className="terminal-label">Order Book</p>
        <h2 className="mt-1 text-lg font-semibold text-white">
          {props.market} live depth
        </h2>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          if (value === "orderbook" || value === "trades") {
            setActiveTab(value);
          }
        }}
        className="flex min-h-0 flex-1 flex-col rounded-[12px] border border-[#88b3ff18] bg-[#060c18]"
      >
        {/* Tab bar */}
        <div className="shrink-0 border-b border-white/[0.06] px-2 pt-2">
          <TabsList className="grid h-8 w-full grid-cols-2 rounded-[9px] bg-white/[0.03] p-0.5">
            <TabsTrigger
              value="orderbook"
              className="rounded-[7px] text-[11px] data-[state=active]:bg-white/[0.09] data-[state=active]:text-white"
            >
              Order Book
            </TabsTrigger>
            <TabsTrigger
              value="trades"
              className="rounded-[7px] text-[11px] data-[state=active]:bg-white/[0.09] data-[state=active]:text-white"
            >
              Trades
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── Order Book tab ─────────────────────────────────────────────── */}
        <TabsContent
          forceMount
          value="orderbook"
          className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
        >
          {/* Column headers */}
          <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_72px_82px] items-center gap-x-2 px-4 py-1.5 text-[10px] uppercase tracking-[0.14em] text-foreground/30">
            <span className="min-w-0">Price</span>
            <span className="text-right">Size</span>
            <span className="text-right">Total</span>
          </div>

          <div className="grid flex-1 grid-rows-[1fr_auto_1fr] overflow-hidden px-2 pb-2">
            {/* Asks (sells) — farthest at top, closest at bottom */}
            <div className="grid auto-rows-[22px] content-end gap-px overflow-hidden">
              {paddedAsks.map(({ id, row }, i) => {
                if (!row) {
                  return <div key={id} className="h-[22px]" />;
                }
                const key = `ask-${row.price}`;
                const width = (row.total / maxTotal) * 100;
                const changed = changedRows[key];
                const opacity = depthOpacity(i, paddedAsks.length, true);

                return (
                  <div
                    key={id}
                    className="relative grid h-[22px] grid-cols-[minmax(0,1fr)_72px_82px] items-center gap-x-2 rounded-[5px] px-2 text-[11px] leading-none"
                    style={{ opacity }}
                  >
                    {/* depth bar */}
                    <div
                      className="absolute inset-y-0 right-0 rounded-[5px] bg-rose-500/[0.12] transition-[width] duration-150 ease-out"
                      style={{ width: `${width}%` }}
                    />
                    <span
                      className={`relative z-10 min-w-0 truncate tabular-nums font-medium transition-colors duration-300 ${
                        changed === "down"
                          ? "text-rose-400"
                          : changed === "up"
                            ? "text-emerald-300"
                            : "text-rose-300"
                      }`}
                    >
                      {fmtPrice(row.price)}
                    </span>
                    <span className="relative z-10 text-right tabular-nums text-foreground/60">
                      {fmtSize(row.size)}
                    </span>
                    <span className="relative z-10 text-right tabular-nums text-foreground/35">
                      {fmtSize(row.total)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Spread row */}
            <motion.div
              animate={
                spreadPulse
                  ? {
                      boxShadow:
                        spreadPulse === "up"
                          ? "0 0 0 1px rgba(16,185,129,0.3)"
                          : "0 0 0 1px rgba(244,63,94,0.3)",
                    }
                  : { boxShadow: "0 0 0 0px rgba(0,0,0,0)" }
              }
              transition={{ duration: 0.2 }}
              className="my-1 flex items-center justify-between rounded-[6px] border border-white/[0.06] bg-white/[0.03] px-3 py-1"
            >
              <span className="text-[10px] uppercase tracking-[0.14em] text-foreground/30">
                Spread
              </span>
              <span className="text-[11px] font-medium tabular-nums text-white/70">
                {spread > 0 ? fmtPrice(spread) : "—"}
              </span>
            </motion.div>

            {/* Bids (buys) — closest at top, farthest at bottom */}
            <div className="grid auto-rows-[22px] content-start gap-px overflow-hidden">
              {paddedBids.map(({ id, row }, i) => {
                if (!row) {
                  return <div key={id} className="h-[22px]" />;
                }
                const key = `bid-${row.price}`;
                const width = (row.total / maxTotal) * 100;
                const changed = changedRows[key];
                const opacity = depthOpacity(i, paddedBids.length, false);

                return (
                  <div
                    key={id}
                    className="relative grid h-[22px] grid-cols-[minmax(0,1fr)_72px_82px] items-center gap-x-2 rounded-[5px] px-2 text-[11px] leading-none"
                    style={{ opacity }}
                  >
                    {/* depth bar */}
                    <div
                      className="absolute inset-y-0 right-0 rounded-[5px] bg-emerald-500/[0.12] transition-[width] duration-150 ease-out"
                      style={{ width: `${width}%` }}
                    />
                    <span
                      className={`relative z-10 min-w-0 truncate tabular-nums font-medium transition-colors duration-300 ${
                        changed === "up"
                          ? "text-emerald-400"
                          : changed === "down"
                            ? "text-rose-300"
                            : "text-emerald-300"
                      }`}
                    >
                      {fmtPrice(row.price)}
                    </span>
                    <span className="relative z-10 text-right tabular-nums text-foreground/60">
                      {fmtSize(row.size)}
                    </span>
                    <span className="relative z-10 text-right tabular-nums text-foreground/35">
                      {fmtSize(row.total)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        {/* ── Trades tab ────────────────────────────────────────────────── */}
        <TabsContent
          forceMount
          value="trades"
          className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
        >
          {/* Column headers */}
          <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_72px_74px] items-center gap-x-2 px-4 py-1.5 text-[10px] uppercase tracking-[0.14em] text-foreground/30">
            <span className="min-w-0">Price</span>
            <span className="text-right">Size</span>
            <span className="text-right">Time</span>
          </div>

          <div
            ref={tradesListRef}
            className="min-h-0 flex-1 overflow-y-auto px-2 pb-2"
          >
            {trades.length === 0 ? (
              <div className="mt-4 rounded-[8px] border border-white/[0.06] bg-white/[0.02] px-3 py-4 text-center text-xs text-foreground/35">
                Waiting for trades…
              </div>
            ) : (
              <div>
                {trades.map((trade, i) => {
                  const isBuy = trade.side === "buy";
                  const opacity = Math.max(0.22, 1 - i * 0.03);
                  return (
                    <div
                      key={trade.id}
                      className="group grid h-[22px] grid-cols-[minmax(0,1fr)_72px_74px] items-center gap-x-2 rounded-[5px] px-2 text-[11px] leading-none"
                      style={{ opacity }}
                    >
                      {/* Arrow + Price */}
                      <span
                        className={`flex min-w-0 items-center gap-1 truncate tabular-nums font-semibold ${isBuy ? "text-emerald-400" : "text-rose-400"}`}
                      >
                        {isBuy ? (
                          // biome-ignore lint/a11y/noSvgWithoutTitle: <explanation>
                          <svg
                            width="8"
                            height="8"
                            viewBox="0 0 8 8"
                            fill="none"
                            className="shrink-0"
                          >
                            <path
                              d="M4 7V1M4 1L1.5 3.5M4 1L6.5 3.5"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        ) : (
                          // biome-ignore lint/a11y/noSvgWithoutTitle: <explanation>
                          <svg
                            width="8"
                            height="8"
                            viewBox="0 0 8 8"
                            fill="none"
                            className="shrink-0"
                          >
                            <path
                              d="M4 1V7M4 7L1.5 4.5M4 7L6.5 4.5"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                        {fmtPrice(trade.price)}
                      </span>
                      {/* Size */}
                      <span className="text-right tabular-nums text-foreground/55">
                        {fmtSize(trade.size)}
                      </span>
                      {/* Time */}
                      <span className="text-right tabular-nums text-[10px] text-foreground/30">
                        {fmtTradeTime(trade.time)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}
