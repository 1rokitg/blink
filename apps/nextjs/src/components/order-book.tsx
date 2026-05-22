"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import * as hl from "@nktkas/hyperliquid";
import { Button } from "@acme/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@acme/ui/dropdown-menu";
import { ChevronDownIcon, EllipsisIcon } from "lucide-react";
import { motion } from "motion/react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@acme/ui/tabs";

interface OrderBookProps {
  symbol: string;
}

interface Level {
  price: number;
  size: number;
  rawSize: number;
  rawTotal: number;
}

interface Book {
  asks: Level[];
  bids: Level[];
  spread: number;
  spreadPercentage: number;
}

export function OrderBook({ symbol }: OrderBookProps) {
  const [orderbook, setOrderbook] = useState<hl.Book | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unit, setUnit] = useState<string>("USD");
  const previousBarWidths = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    let subscription: hl.Subscription | null = null;

    const connectToOrderBook = async () => {
      try {
        // Clear previous bar widths when symbol changes
        previousBarWidths.current.clear();

        const subsClient = new hl.SubscriptionClient({
          transport: new hl.WebSocketTransport({
            url: "wss://api.hyperliquid.xyz/ws",
          }),
        });

        // Subscribe to L2 orderbook updates
        subscription = await subsClient.l2Book(
          { coin: "BTC" },
          (data: hl.Book) => {
            setOrderbook(data);
            setIsConnected(true);
            setError(null);
          },
        );

        console.log(`Connected to ${symbol} orderbook`);
      } catch (err) {
        console.error("Failed to connect to orderbook:", err);
        setError("Failed to connect to orderbook");
        setIsConnected(false);
      }
    };

    connectToOrderBook();

    // Cleanup on unmount or symbol change
    return () => {
      if (subscription) {
        subscription.unsubscribe();
        setIsConnected(false);
      }
    };
  }, [symbol]);

  // Construct orderbook
  const book = useMemo((): Book => {
    if (!orderbook)
      return { asks: [], bids: [], spread: 0, spreadPercentage: 0 };

    const rawBids = orderbook.levels[0] || [];
    const rawAsks = orderbook.levels[1] || [];

    // Process asks
    const asks = rawAsks.slice(0, 7).map((ask, index) => {
      const price = Number.parseFloat(ask.px);
      const size = Number.parseFloat(ask.sz);

      // Calculate size and cumulative based on unit (USD or asset)
      let displaySize: number;
      let cumulative: number;

      if (unit === "USD") {
        // For USD: multiply size by price
        displaySize = size * price;
        cumulative = rawAsks
          .slice(0, index + 1)
          .reduce(
            (sum, level) =>
              sum + Number.parseFloat(level.sz) * Number.parseFloat(level.px),
            0,
          );
      } else {
        // For asset: use raw size (no conversion)
        displaySize = size;
        cumulative = rawAsks
          .slice(0, index + 1)
          .reduce((sum, level) => sum + Number.parseFloat(level.sz), 0);
      }

      return {
        price,
        size: displaySize,
        rawSize: size,
        rawTotal: cumulative,
      };
    });

    // Process bids
    const bids = rawBids.slice(0, 8).map((bid, index) => {
      const price = Number.parseFloat(bid.px);
      const size = Number.parseFloat(bid.sz);

      // Calculate size and cumulative based on unit (USD or asset)
      let displaySize: number;
      let cumulative: number;

      if (unit === "USD") {
        // For USD: multiply size by price (conversion)
        displaySize = size * price;
        cumulative = rawBids
          .slice(0, index + 1)
          .reduce(
            (sum, level) =>
              sum + Number.parseFloat(level.sz) * Number.parseFloat(level.px),
            0,
          );
      } else {
        // For asset: use raw size (no conversion)
        displaySize = size;
        cumulative = rawBids
          .slice(0, index + 1)
          .reduce((sum, level) => sum + Number.parseFloat(level.sz), 0);
      }

      return {
        price,
        size: displaySize,
        rawSize: size,
        rawTotal: cumulative,
      };
    });

    // Calculate spread and spread percentage
    const bestBid = Math.max(...bids.map((b) => b.price));
    const bestAsk = Math.min(...asks.map((a) => a.price));

    const spread = bestAsk - bestBid;
    const spreadPercentage = ((bestAsk - bestBid) / bestBid) * 100;

    return { asks: asks.reverse(), bids, spread, spreadPercentage };
  }, [orderbook, unit]);

  if (error) {
    return (
      <div className="h-[600px] overflow-scroll no-scrollbar">
        <div className="text-red-500 text-sm text-center p-4">{error}</div>
      </div>
    );
  }

  if (!orderbook) {
    return <OrderBookSkeleton />;
  }

  const maxAskTotal = Math.max(...book.asks.map((a) => a.rawTotal));
  const maxBidTotal = Math.max(...book.bids.map((b) => b.rawTotal));

  return (
    <div className="w-full h-full no-scrollbar">
      <div className="h-full flex flex-col overflow-hidden bg-muted">
        <Tabs defaultValue="orderbook" className="h-full flex flex-col">
          {/* Tab Headers */}

          {/* Order Book Tab Content */}
          <TabsContent value="orderbook" className="flex-1 flex flex-col mt-0">
            <div className="py-1 px-3 bg-[#0D0D0D] border-y border-[#1D1D1D]">
              <div className="grid grid-cols-3 text-xs text-[#8C8C8C] my-1">
                <span className="text-left">Price</span>
                <span className="text-right">Size ({unit})</span>
                <span className="text-right">Total ({unit})</span>
              </div>
            </div>

            {/* Asks Section - Ladder Effect */}
            <div className="flex-1 bg-background">
              <div className="space-y-0.5">
                {book.asks.map((ask, index) => {
                  const barWidth =
                    maxAskTotal > 0 ? (ask.rawTotal / maxAskTotal) * 100 : 0;
                  const barKey = `ask-${ask.price}`;
                  const previousWidth =
                    previousBarWidths.current.get(barKey) || 0;

                  // Update the previous width for next render
                  previousBarWidths.current.set(barKey, barWidth);

                  return (
                    <div
                      key={barKey}
                      className="grid grid-cols-3 items-center px-3 text-xs relative h-6"
                    >
                      <motion.div
                        className="absolute left-0 top-0 h-full bg-rose-500 opacity-10"
                        initial={{ width: `${previousWidth}%` }}
                        animate={{ width: `${barWidth}%` }}
                        transition={{
                          duration: 0.3,
                          ease: "easeOut",
                          type: "spring",
                          stiffness: 120,
                          damping: 25,
                        }}
                      />
                      <span className="text-red-500 font-medium leading-tight z-10 text-left">
                        {ask.price.toLocaleString()}
                      </span>
                      <span className="text-white z-10 text-right">
                        {unit === "USD"
                          ? `${ask.size.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                          : ask.size.toLocaleString(undefined, {
                              maximumFractionDigits: 4,
                            })}
                      </span>
                      <span className="text-white z-10 text-right">
                        {unit === "USD"
                          ? `${ask.rawTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                          : ask.rawTotal.toLocaleString(undefined, {
                              maximumFractionDigits: 4,
                            })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Spread Section */}
            <div className="py-1 px-3 bg-[#0D0D0D] border-y border-[#1D1D1D] flex-shrink-0">
              <div className="grid grid-cols-3 items-center text-xs relative h-6">
                <span className="text-white z-10 text-left">Spread</span>
                <span className="text-white z-10 text-right">
                  {book.spread.toFixed()}
                </span>
                <span className="text-white z-10 text-right">
                  {book.spreadPercentage.toFixed(3)}%
                </span>
              </div>
            </div>

            {/* Bids Section - Ladder Effect */}
            <div className="flex-1 bg-background">
              <div className="space-y-0.5">
                {book.bids.map((bid, index) => {
                  const barWidth =
                    maxBidTotal > 0 ? (bid.rawTotal / maxBidTotal) * 100 : 0;
                  const barKey = `bid-${bid.price}`;
                  const previousWidth =
                    previousBarWidths.current.get(barKey) || 0;

                  // Update the previous width for next render
                  previousBarWidths.current.set(barKey, barWidth);

                  return (
                    <div
                      key={barKey}
                      className="grid grid-cols-3 items-center px-3 text-xs relative h-6"
                    >
                      <motion.div
                        className="absolute left-0 top-0 h-full bg-emerald-500 opacity-10"
                        initial={{ width: `${previousWidth}%` }}
                        animate={{ width: `${barWidth}%` }}
                        transition={{
                          duration: 0.3,
                          ease: "easeOut",
                          type: "spring",
                          stiffness: 150,
                          damping: 25,
                        }}
                      />
                      <button
                        type="button"
                        className="text-green-500 hover:text-green-500 hover:font-semibold font-medium leading-tight z-10 text-left"
                      >
                        {bid.price.toLocaleString()}
                      </button>
                      <span className="text-white z-10 text-right">
                        {unit === "USD"
                          ? `${bid.size.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                          : bid.size.toLocaleString(undefined, {
                              maximumFractionDigits: 4,
                            })}
                      </span>
                      <span className="text-white z-10 text-right">
                        {unit === "USD"
                          ? `${bid.rawTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                          : bid.rawTotal.toLocaleString(undefined, {
                              maximumFractionDigits: 4,
                            })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          {/* Trades Tab Content */}
          <TabsContent value="trades" className="flex-1 flex flex-col mt-0">
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted-foreground text-sm">
                No recent trades
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export const OrderBookSkeleton = () => {
  return (
    <div className="w-full h-full bg-muted rounded-2xl">
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
        <span className="text-sm text-muted-foreground">
          Loading orderbook...
        </span>
      </div>
    </div>
  );
};
