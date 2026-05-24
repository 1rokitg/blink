/**
 * Trading Island — event bus
 *
 * Lightweight pub-sub that connects any part of the app to the
 * TradingIsland component without prop-drilling or a global store.
 *
 * Usage:
 *   import { emitTradingEvent } from "~/lib/blink/island-bus";
 *   emitTradingEvent({ type: "fill", coin: "BTC", side: "Long", ... });
 */

// ─── Event shape ─────────────────────────────────────────────────────────────

export type TradingEvent =
  /** A position fill confirmed by Hyperliquid */
  | {
      type: "fill";
      coin: string;
      side: "Long" | "Short";
      size: string;
      price: string;
      /** Unrealized PnL change from this fill (optional) */
      pnl?: number;
      /** Closed PnL if this was a closing fill */
      closedPnl?: number;
      /** Hyperliquid transaction hash — links to the block explorer */
      txHash?: string;
      /** Whether this was a market (taker) or limit (maker) fill */
      orderType?: "market" | "limit";
    }
  /** An order was successfully placed */
  | {
      type: "order_placed";
      coin: string;
      side: "Buy" | "Sell";
      price: string;
      size: string;
      orderType: "limit" | "market";
    }
  /** One or more orders cancelled */
  | {
      type: "order_cancelled";
      coin: string;
      count?: number;
    }
  /** Async operation in progress (replaces toast.loading) */
  | {
      type: "loading";
      message: string;
      /** Optional ID to resolve this later with success/error */
      id?: string;
    }
  /** Async operation resolved successfully */
  | {
      type: "success";
      message: string;
      detail?: string;
      id?: string;
    }
  /** Async operation failed */
  | {
      type: "error";
      message: string;
      detail?: string;
      id?: string;
    }
  /** Non-critical warning (auto-dismisses) */
  | {
      type: "warning";
      message: string;
      detail?: string;
      /** If true, stays until manually dismissed */
      persistent?: boolean;
    }
  /** Liquidation proximity alert — high priority, persistent */
  | {
      type: "liq_warning";
      coin: string;
      side: "Long" | "Short";
      liqPrice: string;
      /** How close we are to liquidation as a percentage (0–100, lower = closer) */
      distancePct: number;
    }
  /** User-configured price alert triggered */
  | {
      type: "price_alert";
      coin: string;
      price: string;
      direction: "above" | "below";
    };

// ─── Priority map (higher = shown first when queue is full) ──────────────────

export const EVENT_PRIORITY: Record<TradingEvent["type"], number> = {
  liq_warning: 100,
  error: 80,
  warning: 60,
  fill: 50,
  success: 40,
  order_placed: 30,
  order_cancelled: 20,
  price_alert: 45,
  loading: 10,
};

// ─── Auto-dismiss durations (ms) ─────────────────────────────────────────────

export const EVENT_DURATION: Partial<Record<TradingEvent["type"], number>> = {
  fill: 5_000,
  order_placed: 3_500,
  order_cancelled: 2_500,
  success: 3_000,
  error: 5_000,
  warning: 4_000,
  price_alert: 4_500,
  // loading: stays until replaced by success/error
  // liq_warning: stays until dismissed (persistent)
};

// ─── Pub-sub ─────────────────────────────────────────────────────────────────

type Listener = (event: TradingEvent) => void;
const _listeners = new Set<Listener>();

export function emitTradingEvent(event: TradingEvent): void {
  _listeners.forEach((l) => l(event));
}

export function subscribeTradingEvents(listener: Listener): () => void {
  _listeners.add(listener);
  return () => {
    _listeners.delete(listener);
  };
}
