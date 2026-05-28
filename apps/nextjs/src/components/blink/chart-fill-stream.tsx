"use client";

import { AnimatePresence, motion } from "motion/react";

import { formatTradeNotional } from "~/lib/blink/chart/use-market-chart";

export type ChartFillStreamMarker = {
  id: string;
  side: "buy" | "sell";
  notionalUsd: number;
  x: number;
  y: number;
};

function ChartFillStreamLabel({ trade }: { trade: ChartFillStreamMarker }) {
  const tone = trade.side === "buy" ? "text-emerald-400" : "text-rose-400";
  const prefix = trade.side === "buy" ? "+" : "−";

  return (
    <motion.div
      className="pointer-events-none absolute z-20 whitespace-nowrap"
      style={{ left: trade.x, top: trade.y }}
      initial={{ opacity: 0, y: 18, x: "-50%" }}
      animate={{ opacity: 1, y: 0, x: "-50%" }}
      exit={{
        opacity: 0,
        y: -58,
        x: "-50%",
        transition: {
          y: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
          opacity: { duration: 0.55, ease: "easeOut" },
        },
      }}
      transition={{
        type: "spring",
        stiffness: 720,
        damping: 34,
        mass: 0.38,
      }}
    >
      <span
        className={`text-[11px] font-medium tabular-nums tracking-tight ${tone}`}
      >
        {prefix}
        {formatTradeNotional(trade.notionalUsd)}
      </span>
    </motion.div>
  );
}

export function ChartFillStream(props: { trades: ChartFillStreamMarker[] }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <AnimatePresence mode="popLayout">
        {props.trades.map((trade) => (
          <ChartFillStreamLabel key={trade.id} trade={trade} />
        ))}
      </AnimatePresence>
    </div>
  );
}
