"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
  const previousWidths = useRef<Map<string, number>>(new Map());

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

  return (
    <section className="glass-panel min-h-[620px] overflow-hidden p-5">
      <div className="mb-4">
        <p className="terminal-label">Order book</p>
        <h2 className="mt-2 text-xl font-semibold text-white">
          {props.market} live depth
        </h2>
      </div>

      <div className="rounded-[24px] border border-white/8 bg-[#0b1018]">
        <div className="grid grid-cols-3 px-4 py-3 text-[11px] uppercase tracking-[0.14em] text-foreground/35">
          <span>Price</span>
          <span className="text-right">Size</span>
          <span className="text-right">Total</span>
        </div>

        <div className="space-y-1 px-2 pb-2">
          {asks.map((ask) => {
            const key = `ask-${ask.price}`;
            const width = (ask.total / maxTotal) * 100;
            previousWidths.current.set(key, width);

            return (
              <div
                key={key}
                className="relative grid grid-cols-3 rounded-[16px] px-2 py-2 text-sm"
              >
                <div
                  className="absolute inset-y-0 left-0 rounded-[16px] bg-rose-400/8"
                  style={{ width: `${width}%` }}
                />
                <span className="relative z-10 text-rose-200">
                  {ask.price.toLocaleString()}
                </span>
                <span className="relative z-10 text-right text-foreground/72">
                  {ask.size.toFixed(4)}
                </span>
                <span className="relative z-10 text-right text-foreground/52">
                  {ask.total.toFixed(4)}
                </span>
              </div>
            );
          })}

          <div className="rounded-[18px] border border-white/6 bg-white/[0.03] px-3 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.14em] text-foreground/38">
                Spread
              </span>
              <span className="text-sm font-medium text-white">
                {spread.toFixed(2)}
              </span>
            </div>
          </div>

          {bids.map((bid) => {
            const key = `bid-${bid.price}`;
            const width = (bid.total / maxTotal) * 100;
            previousWidths.current.set(key, width);

            return (
              <div
                key={key}
                className="relative grid grid-cols-3 rounded-[16px] px-2 py-2 text-sm"
              >
                <div
                  className="absolute inset-y-0 left-0 rounded-[16px] bg-emerald-400/8"
                  style={{ width: `${width}%` }}
                />
                <span className="relative z-10 text-emerald-200">
                  {bid.price.toLocaleString()}
                </span>
                <span className="relative z-10 text-right text-foreground/72">
                  {bid.size.toFixed(4)}
                </span>
                <span className="relative z-10 text-right text-foreground/52">
                  {bid.total.toFixed(4)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
