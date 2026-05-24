"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";

import type * as hl from "@nktkas/hyperliquid";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@acme/ui/tabs";

import { createSubscriptionClient } from "~/lib/blink/hyperliquid";

type BookLevelRow = {
  price: number;
  size: number;
  total: number;
};

function formatBookLevels(levels: hl.Book["levels"][0], reverse = false) {
  const rows = levels.slice(0, 8).map((level, index) => {
    const price = Number(level.px);
    const size = Number(level.sz);
    const total = levels
      .slice(0, index + 1)
      .reduce((sum, current) => sum + Number(current.sz), 0);

    return {
      price,
      size,
      total,
    } satisfies BookLevelRow;
  });

  return reverse ? rows.reverse() : rows;
}

export function TerminalOrderBook(props: { market: string }) {
  const [book, setBook] = useState<hl.Book | null>(null);
  const [trades, setTrades] = useState<hl.WsTrade[]>([]);
  const [changedRows, setChangedRows] = useState<Record<string, "up" | "down">>(
    {},
  );
  const [spreadPulse, setSpreadPulse] = useState<"up" | "down" | null>(null);
  const lastSizesRef = useRef<Map<string, number>>(new Map());
  const lastSpreadRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    let bookSubscription: hl.Subscription | null = null;
    let tradesSubscription: hl.Subscription | null = null;

    async function subscribe() {
      const client = createSubscriptionClient();
      bookSubscription = await client.l2Book({ coin: props.market }, (data) => {
        if (!active) {
          return;
        }

        setBook(data);
      });

      tradesSubscription = await client.trades({ coin: props.market }, (data) => {
        if (!active) {
          return;
        }
        setTrades((prev) => [...data, ...prev].slice(0, 40));
      });
    }

    void subscribe();

    return () => {
      active = false;
      if (bookSubscription) {
        void bookSubscription.unsubscribe();
      }
      if (tradesSubscription) {
        void tradesSubscription.unsubscribe();
      }
    };
  }, [props.market]);

  const asks = useMemo(
    () => (book ? formatBookLevels(book.levels[1], true) : []),
    [book],
  );
  const bids = useMemo(
    () => (book ? formatBookLevels(book.levels[0]) : []),
    [book],
  );

  const bestAsk = asks.at(-1)?.price ?? 0;
  const bestBid = bids.at(0)?.price ?? 0;
  const spread = bestAsk && bestBid ? bestAsk - bestBid : 0;
  const maxTotal = Math.max(
    1,
    ...asks.map((item) => item.total),
    ...bids.map((item) => item.total),
  );

  const formattedTrades = useMemo(
    () =>
      trades.map((trade) => {
        const price = Number(trade.px);
        const size = Number(trade.sz);
        return {
          time: trade.time,
          side: trade.side === "A" ? "sell" : "buy",
          price,
          size,
          notional: price * size,
          id: `${trade.time}-${trade.px}-${trade.sz}-${trade.side}`,
        };
      }),
    [trades],
  );

  useEffect(() => {
    if (!asks.length && !bids.length) return;
    const updates: Record<string, "up" | "down"> = {};
    const nowSizes = new Map<string, number>();

    for (const ask of asks) {
      const key = `ask-${ask.price}`;
      const prev = lastSizesRef.current.get(key);
      if (prev !== undefined && prev !== ask.size) {
        updates[key] = ask.size > prev ? "up" : "down";
      }
      nowSizes.set(key, ask.size);
    }
    for (const bid of bids) {
      const key = `bid-${bid.price}`;
      const prev = lastSizesRef.current.get(key);
      if (prev !== undefined && prev !== bid.size) {
        updates[key] = bid.size > prev ? "up" : "down";
      }
      nowSizes.set(key, bid.size);
    }

    lastSizesRef.current = nowSizes;
    if (Object.keys(updates).length > 0) {
      setChangedRows((prev) => ({ ...prev, ...updates }));
      const timeout = window.setTimeout(() => {
        setChangedRows((prev) => {
          const next = { ...prev };
          for (const key of Object.keys(updates)) {
            delete next[key];
          }
          return next;
        });
      }, 550);
      return () => window.clearTimeout(timeout);
    }
  }, [asks, bids]);

  useEffect(() => {
    if (!spread) return;
    const prev = lastSpreadRef.current;
    if (prev !== null && prev !== spread) {
      setSpreadPulse(spread < prev ? "up" : "down");
      const timeout = window.setTimeout(() => setSpreadPulse(null), 500);
      lastSpreadRef.current = spread;
      return () => window.clearTimeout(timeout);
    }
    lastSpreadRef.current = spread;
  }, [spread]);

  return (
    <section className="glass-panel flex h-[640px] flex-col overflow-hidden p-3">
      <div className="mb-2 shrink-0">
        <p className="terminal-label">Order book</p>
        <h2 className="mt-2 text-xl font-semibold text-white">
          {props.market} live depth
        </h2>
      </div>

      <Tabs defaultValue="orderbook" className="flex min-h-0 flex-1 flex-col rounded-[12px] border border-[#88b3ff2e] bg-[#060c18]">
        <div className="shrink-0 border-b border-white/10 px-2 pt-2">
          <TabsList className="grid h-9 w-full grid-cols-2 rounded-[10px] bg-white/[0.02] p-1">
            <TabsTrigger
              value="orderbook"
              className="rounded-[8px] text-xs data-[state=active]:bg-white/[0.08]"
            >
              Order Book
            </TabsTrigger>
            <TabsTrigger
              value="trades"
              className="rounded-[8px] text-xs data-[state=active]:bg-white/[0.08]"
            >
              Trades
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="orderbook" className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="shrink-0 grid grid-cols-3 px-4 py-2 text-[11px] uppercase tracking-[0.14em] text-foreground/35">
            <span>Price</span>
            <span className="text-right">Size</span>
            <span className="text-right">Total</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-0.5 px-2 pb-2">
            {asks.map((ask) => {
              const key = `ask-${ask.price}`;
              const width = (ask.total / maxTotal) * 100;
              const changed = changedRows[key];

              return (
                <motion.div
                  key={key}
                  layout
                  initial={{ opacity: 0.7, y: -2 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.1, ease: "easeOut" }}
                  className="relative grid grid-cols-3 rounded-[6px] px-2 py-1.5 text-sm"
                >
                  <div
                    className="absolute inset-y-0 left-0 rounded-[6px] bg-rose-400/10 transition-[width] duration-200 ease-out"
                    style={{ width: `${width}%` }}
                  />
                  <span
                    className={`relative z-10 tabular-nums transition-colors duration-300 ${changed === "down" ? "text-rose-300" : changed === "up" ? "text-emerald-200" : "text-rose-200"}`}
                  >
                    {ask.price.toLocaleString()}
                  </span>
                  <span
                    className={`relative z-10 text-right tabular-nums transition-colors duration-300 ${changed === "up" ? "text-emerald-300" : changed === "down" ? "text-rose-300" : "text-foreground/72"}`}
                  >
                    {ask.size.toFixed(4)}
                  </span>
                  <span className="relative z-10 text-right tabular-nums text-foreground/52">
                    {ask.total.toFixed(4)}
                  </span>
                </motion.div>
              );
            })}

            <motion.div
              animate={
                spreadPulse
                  ? {
                      boxShadow:
                        spreadPulse === "up"
                          ? "0 0 0 1px rgba(16,185,129,0.35), 0 0 18px rgba(16,185,129,0.14)"
                          : "0 0 0 1px rgba(244,63,94,0.35), 0 0 18px rgba(244,63,94,0.14)",
                    }
                  : { boxShadow: "0 0 0 0 rgba(0,0,0,0)" }
              }
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="rounded-[6px] border border-white/8 bg-white/[0.04] px-3 py-1.5"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="uppercase tracking-[0.14em] text-foreground/38">
                  Spread
                </span>
                <span className="font-medium tabular-nums text-white">
                  {spread.toFixed(2)}
                </span>
              </div>
            </motion.div>

            {bids.map((bid) => {
              const key = `bid-${bid.price}`;
              const width = (bid.total / maxTotal) * 100;
              const changed = changedRows[key];

              return (
                <motion.div
                  key={key}
                  layout
                  initial={{ opacity: 0.7, y: 2 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.1, ease: "easeOut" }}
                  className="relative grid grid-cols-3 rounded-[6px] px-2 py-1.5 text-sm"
                >
                  <div
                    className="absolute inset-y-0 left-0 rounded-[6px] bg-emerald-400/10 transition-[width] duration-200 ease-out"
                    style={{ width: `${width}%` }}
                  />
                  <span
                    className={`relative z-10 tabular-nums transition-colors duration-300 ${changed === "up" ? "text-emerald-300" : changed === "down" ? "text-rose-200" : "text-emerald-200"}`}
                  >
                    {bid.price.toLocaleString()}
                  </span>
                  <span
                    className={`relative z-10 text-right tabular-nums transition-colors duration-300 ${changed === "up" ? "text-emerald-300" : changed === "down" ? "text-rose-300" : "text-foreground/72"}`}
                  >
                    {bid.size.toFixed(4)}
                  </span>
                  <span className="relative z-10 text-right tabular-nums text-foreground/52">
                    {bid.total.toFixed(4)}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="trades" className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="shrink-0 grid grid-cols-3 px-4 py-2 text-[11px] uppercase tracking-[0.14em] text-foreground/35">
            <span>Price</span>
            <span className="text-right">Size</span>
            <span className="text-right">Time</span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-0.5 px-2 pb-2">
            {formattedTrades.length === 0 ? (
              <div className="rounded-[8px] border border-white/8 bg-white/[0.02] px-3 py-4 text-center text-sm text-foreground/45">
                Waiting for trades stream…
              </div>
            ) : (
              formattedTrades.slice(0, 28).map((trade) => (
                <motion.div
                  key={trade.id}
                  layout
                  initial={{ opacity: 0.7, y: 2 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.12, ease: "easeOut" }}
                  className={`grid grid-cols-3 rounded-[6px] px-2 py-1.5 text-sm ${
                    trade.side === "buy" ? "bg-emerald-400/6" : "bg-rose-400/6"
                  }`}
                >
                  <span
                    className={`tabular-nums ${
                      trade.side === "buy" ? "text-emerald-300" : "text-rose-300"
                    }`}
                  >
                    {trade.price.toLocaleString()}
                  </span>
                  <span className="text-right tabular-nums text-foreground/80">
                    {trade.size.toFixed(4)}
                  </span>
                  <span className="text-right tabular-nums text-foreground/52">
                    {new Date(trade.time).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                </motion.div>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}
