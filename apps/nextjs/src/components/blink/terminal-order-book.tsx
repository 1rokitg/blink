"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";

import type * as hl from "@nktkas/hyperliquid";

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
  const [changedRows, setChangedRows] = useState<Record<string, "up" | "down">>(
    {},
  );
  const [spreadPulse, setSpreadPulse] = useState<"up" | "down" | null>(null);
  const lastSizesRef = useRef<Map<string, number>>(new Map());
  const lastSpreadRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    let subscription: hl.Subscription | null = null;

    async function subscribe() {
      const client = createSubscriptionClient();
      subscription = await client.l2Book({ coin: props.market }, (data) => {
        if (!active) {
          return;
        }

        setBook(data);
      });
    }

    void subscribe();

    return () => {
      active = false;
      if (subscription) {
        void subscription.unsubscribe();
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
    <section className="glass-panel min-h-[640px] overflow-hidden p-3">
      <div className="mb-2">
        <p className="terminal-label">Order book</p>
        <h2 className="mt-2 text-xl font-semibold text-white">
          {props.market} live depth
        </h2>
      </div>

      <div className="rounded-[12px] border border-[#88b3ff2e] bg-[#060c18]">
        <div className="grid grid-cols-3 px-4 py-3 text-[11px] uppercase tracking-[0.14em] text-foreground/35">
          <span>Price</span>
          <span className="text-right">Size</span>
          <span className="text-right">Total</span>
        </div>

        <div className="space-y-1 px-2 pb-2">
          {asks.map((ask) => {
            const key = `ask-${ask.price}`;
            const width = (ask.total / maxTotal) * 100;
            const changed = changedRows[key];

            return (
              <motion.div
                key={key}
                layout
                initial={{ opacity: 0.7, y: -3 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.14, ease: "easeOut" }}
                className="relative grid grid-cols-3 rounded-[16px] px-2 py-2 text-sm"
              >
                <div
                  className="absolute inset-y-0 left-0 rounded-[16px] bg-rose-400/8 transition-[width] duration-300 ease-out"
                  style={{ width: `${width}%` }}
                />
                <span
                  className={`relative z-10 transition-colors duration-300 ${changed === "down" ? "text-rose-300" : changed === "up" ? "text-emerald-200" : "text-rose-200"}`}
                >
                  {ask.price.toLocaleString()}
                </span>
                <span
                  className={`relative z-10 text-right transition-colors duration-300 ${changed === "up" ? "text-emerald-300" : changed === "down" ? "text-rose-300" : "text-foreground/72"}`}
                >
                  {ask.size.toFixed(4)}
                </span>
                <span className="relative z-10 text-right text-foreground/52">
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
                        ? "0 0 0 1px rgba(16,185,129,0.35), 0 0 22px rgba(16,185,129,0.16)"
                        : "0 0 0 1px rgba(244,63,94,0.35), 0 0 22px rgba(244,63,94,0.16)",
                  }
                : { boxShadow: "0 0 0 0 rgba(0,0,0,0)" }
            }
            transition={{ duration: 0.24, ease: "easeOut" }}
            className="rounded-[18px] border border-white/6 bg-white/[0.03] px-3 py-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.14em] text-foreground/38">
                Spread
              </span>
              <span className="text-sm font-medium text-white">
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
                initial={{ opacity: 0.7, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.14, ease: "easeOut" }}
                className="relative grid grid-cols-3 rounded-[16px] px-2 py-2 text-sm"
              >
                <div
                  className="absolute inset-y-0 left-0 rounded-[16px] bg-emerald-400/8 transition-[width] duration-300 ease-out"
                  style={{ width: `${width}%` }}
                />
                <span
                  className={`relative z-10 transition-colors duration-300 ${changed === "up" ? "text-emerald-300" : changed === "down" ? "text-rose-200" : "text-emerald-200"}`}
                >
                  {bid.price.toLocaleString()}
                </span>
                <span
                  className={`relative z-10 text-right transition-colors duration-300 ${changed === "up" ? "text-emerald-300" : changed === "down" ? "text-rose-300" : "text-foreground/72"}`}
                >
                  {bid.size.toFixed(4)}
                </span>
                <span className="relative z-10 text-right text-foreground/52">
                  {bid.total.toFixed(4)}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
