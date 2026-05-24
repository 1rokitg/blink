"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";

import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Check,
  Loader2,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  X,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import {
  EVENT_DURATION,
  EVENT_PRIORITY,
  subscribeTradingEvents,
  type TradingEvent,
} from "~/lib/blink/island-bus";

// ─── Internal state machine ───────────────────────────────────────────────────

type IslandItem = {
  id: number;
  event: TradingEvent;
  /** Timestamp the item was added */
  at: number;
  /** If true, will not auto-dismiss */
  persistent: boolean;
};

type IslandState = {
  /** Currently displayed item (null = idle) */
  current: IslandItem | null;
  /** Pending queue, sorted by priority desc */
  queue: IslandItem[];
  /** Whether the user has expanded the island for detail */
  expanded: boolean;
};

let _uid = 0;

type IslandAction =
  | { type: "PUSH"; event: TradingEvent }
  | { type: "DISMISS"; id: number }
  | { type: "TOGGLE_EXPAND" }
  | { type: "NEXT" };

function reducer(state: IslandState, action: IslandAction): IslandState {
  switch (action.type) {
    case "PUSH": {
      const id = ++_uid;
      const persistent =
        action.event.type === "liq_warning" ||
        action.event.type === "loading" ||
        (action.event.type === "warning" && !!action.event.persistent);

      const item: IslandItem = { id, event: action.event, at: Date.now(), persistent };
      const priority = EVENT_PRIORITY[action.event.type];

      // Loading events replace existing loading
      if (action.event.type === "loading") {
        const filtered = state.queue.filter((q) => q.event.type !== "loading");
        if (state.current?.event.type === "loading") {
          const next = filtered[0] ?? null;
          return {
            ...state,
            current: item,
            queue: next ? filtered.slice(1) : filtered,
          };
        }
      }

      // success/error can resolve a pending loading event
      if (action.event.type === "success" || action.event.type === "error") {
        if (state.current?.event.type === "loading") {
          return { ...state, current: item, queue: state.queue, expanded: false };
        }
      }

      // If nothing is showing, show immediately
      if (!state.current) {
        return { ...state, current: item, expanded: false };
      }

      // Otherwise queue, sorted by priority
      const queue = [...state.queue, item].sort(
        (a, b) => EVENT_PRIORITY[b.event.type] - EVENT_PRIORITY[a.event.type],
      );

      // If new item has higher priority than current, swap
      if (priority > EVENT_PRIORITY[state.current.event.type] && !state.current.persistent) {
        return { ...state, current: item, queue: [state.current, ...queue.filter((q) => q.id !== item.id)], expanded: false };
      }

      return { ...state, queue };
    }

    case "DISMISS": {
      if (state.current?.id !== action.id) return state;
      const [next, ...rest] = state.queue;
      return { ...state, current: next ?? null, queue: rest, expanded: false };
    }

    case "NEXT": {
      const [next, ...rest] = state.queue;
      return { ...state, current: next ?? null, queue: rest, expanded: false };
    }

    case "TOGGLE_EXPAND":
      return { ...state, expanded: !state.expanded };

    default:
      return state;
  }
}

// ─── Visual config per event type ────────────────────────────────────────────

function getEventConfig(event: TradingEvent) {
  switch (event.type) {
    case "fill":
      return {
        glow: event.side === "Long" ? "rgba(59,225,186,0.35)" : "rgba(248,113,113,0.35)",
        accent: event.side === "Long" ? "#3be1ba" : "#f87171",
        bg: event.side === "Long" ? "rgba(59,225,186,0.06)" : "rgba(248,113,113,0.06)",
      };
    case "order_placed":
      return {
        glow: "rgba(44,107,255,0.35)",
        accent: "#6fa8ff",
        bg: "rgba(44,107,255,0.06)",
      };
    case "order_cancelled":
      return {
        glow: "rgba(255,255,255,0.08)",
        accent: "#888",
        bg: "rgba(255,255,255,0.03)",
      };
    case "loading":
      return {
        glow: "rgba(44,107,255,0.25)",
        accent: "#6fa8ff",
        bg: "rgba(44,107,255,0.05)",
      };
    case "success":
      return {
        glow: "rgba(59,225,186,0.30)",
        accent: "#3be1ba",
        bg: "rgba(59,225,186,0.05)",
      };
    case "error":
      return {
        glow: "rgba(248,113,113,0.35)",
        accent: "#f87171",
        bg: "rgba(248,113,113,0.06)",
      };
    case "warning":
      return {
        glow: "rgba(251,191,36,0.28)",
        accent: "#fbbf24",
        bg: "rgba(251,191,36,0.05)",
      };
    case "liq_warning":
      return {
        glow: event.distancePct < 5
          ? "rgba(239,68,68,0.55)"
          : "rgba(251,146,60,0.40)",
        accent: event.distancePct < 5 ? "#ef4444" : "#fb923c",
        bg: event.distancePct < 5
          ? "rgba(239,68,68,0.08)"
          : "rgba(251,146,60,0.07)",
      };
    case "price_alert":
      return {
        glow: "rgba(167,139,250,0.30)",
        accent: "#a78bfa",
        bg: "rgba(167,139,250,0.05)",
      };
  }
}

// ─── Content renderers ────────────────────────────────────────────────────────

function formatUsd(n: number) {
  const abs = Math.abs(n);
  const s =
    abs >= 1000
      ? abs.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })
      : abs.toFixed(2);
  return `$${s}`;
}

function IslandContent({
  item,
  expanded,
}: {
  item: IslandItem;
  expanded: boolean;
}) {
  const { event } = item;

  switch (event.type) {
    case "fill": {
      const isLong = event.side === "Long";
      const Icon = isLong ? ArrowUpRight : ArrowDownRight;
      const pnlPositive = (event.pnl ?? 0) >= 0;
      return (
        <div className="flex items-center gap-2.5">
          <span
            className="flex size-6 shrink-0 items-center justify-center rounded-full"
            style={{
              background: isLong ? "rgba(59,225,186,0.18)" : "rgba(248,113,113,0.18)",
            }}
          >
            <Icon
              className="size-3.5"
              style={{ color: isLong ? "#3be1ba" : "#f87171" }}
            />
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="font-semibold text-white">{event.coin}</span>
            <span
              className="text-[11px] font-medium"
              style={{ color: isLong ? "#3be1ba" : "#f87171" }}
            >
              {event.side}
            </span>
            <span className="font-mono text-xs text-white/55">
              {event.size} @ {event.price}
            </span>
          </div>
          {event.pnl !== undefined && (
            <span
              className={`ml-1 font-mono text-sm font-semibold ${pnlPositive ? "text-emerald-300" : "text-rose-300"}`}
            >
              {pnlPositive ? "+" : ""}
              {formatUsd(event.pnl)}
            </span>
          )}
          {event.closedPnl !== undefined && expanded && (
            <span className="ml-auto text-[11px] text-white/40">
              Closed PnL:{" "}
              <span
                className={event.closedPnl >= 0 ? "text-emerald-300" : "text-rose-300"}
              >
                {event.closedPnl >= 0 ? "+" : ""}
                {formatUsd(event.closedPnl)}
              </span>
            </span>
          )}
        </div>
      );
    }

    case "order_placed": {
      const isBuy = event.side === "Buy";
      return (
        <div className="flex items-center gap-2.5">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#2c6bff]/20">
            <Zap className="size-3 text-[#6fa8ff]" />
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="font-semibold text-white">{event.coin}</span>
            <span
              className={`text-[11px] font-medium ${isBuy ? "text-emerald-300" : "text-rose-300"}`}
            >
              {event.side}
            </span>
            <span className="text-[11px] text-white/45 capitalize">
              {event.orderType}
            </span>
          </div>
          {expanded && (
            <span className="ml-2 font-mono text-xs text-white/45">
              {event.size} @ {event.price}
            </span>
          )}
        </div>
      );
    }

    case "order_cancelled":
      return (
        <div className="flex items-center gap-2.5">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/[0.06]">
            <X className="size-3 text-white/50" />
          </span>
          <span className="text-sm text-white/75">
            {event.count && event.count > 1
              ? `${event.count} orders cancelled`
              : `${event.coin} order cancelled`}
          </span>
        </div>
      );

    case "loading":
      return (
        <div className="flex items-center gap-2.5">
          <Loader2 className="size-4 shrink-0 animate-spin text-[#6fa8ff]" />
          <span className="text-sm text-white/80">{event.message}</span>
        </div>
      );

    case "success":
      return (
        <div className="flex items-center gap-2.5">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-400/15">
            <Check className="size-3.5 text-emerald-300" />
          </span>
          <div>
            <span className="text-sm font-medium text-white">{event.message}</span>
            {expanded && event.detail && (
              <p className="mt-0.5 text-xs text-white/45">{event.detail}</p>
            )}
          </div>
        </div>
      );

    case "error":
      return (
        <div className="flex items-center gap-2.5">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-rose-400/15">
            <X className="size-3.5 text-rose-300" />
          </span>
          <div>
            <span className="text-sm font-medium text-white">{event.message}</span>
            {expanded && event.detail && (
              <p className="mt-0.5 text-xs text-white/45">{event.detail}</p>
            )}
          </div>
        </div>
      );

    case "warning":
      return (
        <div className="flex items-center gap-2.5">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-400/15">
            <AlertTriangle className="size-3.5 text-amber-300" />
          </span>
          <div>
            <span className="text-sm font-medium text-white">{event.message}</span>
            {expanded && event.detail && (
              <p className="mt-0.5 text-xs text-white/45">{event.detail}</p>
            )}
          </div>
        </div>
      );

    case "liq_warning": {
      const critical = event.distancePct < 5;
      const Icon = event.side === "Long" ? TrendingDown : TrendingUp;
      return (
        <div className="flex items-center gap-2.5">
          <span
            className="flex size-6 shrink-0 items-center justify-center rounded-full"
            style={{
              background: critical ? "rgba(239,68,68,0.2)" : "rgba(251,146,60,0.18)",
            }}
          >
            <TriangleAlert
              className="size-3.5"
              style={{ color: critical ? "#ef4444" : "#fb923c" }}
            />
          </span>
          <div>
            <div className="flex items-center gap-1.5">
              <span
                className="text-sm font-semibold"
                style={{ color: critical ? "#ef4444" : "#fb923c" }}
              >
                {critical ? "LIQUIDATION IMMINENT" : "Liq. warning"}
              </span>
              <span className="text-xs text-white/55">
                {event.coin} {event.side}
              </span>
            </div>
            {expanded && (
              <p className="mt-0.5 text-xs text-white/45">
                Liq. price {event.liqPrice} · {event.distancePct.toFixed(1)}% away
              </p>
            )}
          </div>
          {!expanded && (
            <span className="ml-1 font-mono text-xs text-white/45">
              @ {event.liqPrice}
            </span>
          )}
        </div>
      );
    }

    case "price_alert":
      return (
        <div className="flex items-center gap-2.5">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-violet-400/15">
            {event.direction === "above" ? (
              <ArrowUpRight className="size-3.5 text-violet-300" />
            ) : (
              <ArrowDownRight className="size-3.5 text-violet-300" />
            )}
          </span>
          <span className="text-sm text-white/80">
            <span className="font-semibold text-white">{event.coin}</span>{" "}
            crossed {event.direction} {event.price}
          </span>
        </div>
      );
  }
}

// ─── Idle dot ─────────────────────────────────────────────────────────────────

function IdlePill() {
  return (
    <motion.div
      layout
      layoutId="island-pill"
      className="flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-[#090c14f0] px-3 py-1.5 shadow-[0_4px_24px_rgba(0,0,0,0.5)]"
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85 }}
      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* HL live dot */}
      <span
        className="size-1.5 rounded-full bg-emerald-400"
        style={{ boxShadow: "0 0 6px 2px #34d39966" }}
      />
      <span className="text-[10px] text-white/30">live</span>
    </motion.div>
  );
}

// ─── Main island ──────────────────────────────────────────────────────────────

export function TradingIsland() {
  const [state, dispatch] = useReducer(reducer, {
    current: null,
    queue: [],
    expanded: false,
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Subscribe to events
  useEffect(() => {
    return subscribeTradingEvents((event) => {
      dispatch({ type: "PUSH", event });
    });
  }, []);

  // Auto-dismiss timer
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!state.current || state.current.persistent) return;

    const duration = EVENT_DURATION[state.current.event.type] ?? 4_000;
    timerRef.current = setTimeout(() => {
      dispatch({ type: "DISMISS", id: state.current!.id });
    }, duration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [state.current]);

  const dismiss = useCallback(() => {
    if (state.current) dispatch({ type: "DISMISS", id: state.current.id });
  }, [state.current]);

  const { current, expanded, queue } = state;
  const config = current ? getEventConfig(current.event) : null;

  return (
    <div className="pointer-events-none fixed left-1/2 top-3 z-[9999] -translate-x-1/2">
      <AnimatePresence mode="wait">
        {!current ? (
          <IdlePill key="idle" />
        ) : (
          <motion.div
            key={current.id}
            layoutId="island-pill"
            layout
            className="pointer-events-auto relative cursor-pointer overflow-hidden rounded-[20px] border border-white/[0.09] shadow-[0_8px_40px_rgba(0,0,0,0.6)]"
            style={{
              background: `linear-gradient(135deg, #090c14f5 60%, ${config!.bg})`,
              boxShadow: `0 0 0 1px rgba(255,255,255,0.06), 0 8px 40px rgba(0,0,0,0.55), 0 0 32px 0 ${config!.glow}`,
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
            }}
            initial={{ opacity: 0, scale: 0.88, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.88, y: -8 }}
            transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }}
            onClick={() => dispatch({ type: "TOGGLE_EXPAND" })}
          >
            {/* Accent top border glow */}
            <div
              className="absolute inset-x-0 top-0 h-px opacity-60"
              style={{
                background: `linear-gradient(90deg, transparent, ${config!.accent}88, transparent)`,
              }}
            />

            {/* Content */}
            <div
              className={`px-4 transition-all duration-200 ${expanded ? "py-4" : "py-2.5"}`}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${current.id}-${expanded}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                >
                  <IslandContent item={current} expanded={expanded} />
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Queue badge */}
            {queue.length > 0 && (
              <div
                className="absolute right-2 top-2 flex size-4 items-center justify-center rounded-full text-[9px] font-bold text-black"
                style={{ background: config!.accent }}
              >
                {queue.length}
              </div>
            )}

            {/* Dismiss button for persistent events */}
            {current.persistent && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  dismiss();
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-white/30 transition hover:text-white/70"
              >
                <X className="size-3" />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
