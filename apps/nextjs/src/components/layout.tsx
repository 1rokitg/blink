"use client";

import React, { useMemo } from "react";
import { Responsive as RGL } from "react-grid-layout";
import { WidthProvider } from "react-grid-layout";
import {
  layouts as layoutsConst,
  cols,
  breakpoints,
  type GridItem,
} from "~/lib/constants/layout";

const ResponsiveGridLayout = WidthProvider(RGL);

export interface GridLayoutProps {
  className?: string;
  rowHeight?: number;
  margin?: [number, number];
  containerPadding?: [number, number];
}

export function GridLayout({
  className = "",
  rowHeight = 8,
  margin = [8, 8],
  containerPadding = [12, 12],
}: GridLayoutProps) {
  const layouts = useMemo(() => layoutsConst, []);

  return (
    <ResponsiveGridLayout
      className={`layout ${className}`}
      layouts={layouts as unknown as Record<string, GridItem[]>}
      breakpoints={breakpoints}
      cols={cols}
      rowHeight={rowHeight}
      margin={margin}
      containerPadding={containerPadding}
      isDraggable
      isResizable
      useCSSTransforms
      compactType="vertical"
      preventCollision={false}
    >
      <div key="watchlist" className="rounded-md border border-border bg-muted">
        {/* TODO: Replace with <WatchlistWidget /> */}
        <div className="h-full w-full flex items-center justify-center text-sm text-foreground/80">
          Watchlist
        </div>
      </div>
      <div
        key="marketInfoHeader"
        className="rounded-md border border-border bg-muted"
      >
        {/* TODO: Replace with <MarketInfoHeaderWidget /> */}
        <div className="h-full w-full flex items-center justify-center text-sm text-foreground/80">
          Market Info
        </div>
      </div>
      <div
        key="tradingChart"
        className="rounded-md border border-border bg-muted"
      >
        {/* TODO: Replace with <TradingChartWidget /> */}
        <div className="h-full w-full flex items-center justify-center text-sm text-foreground/80">
          Trading Chart
        </div>
      </div>
      <div key="orderForm" className="rounded-md border border-border bg-muted">
        {/* TODO: Replace with <OrderFormWidget /> */}
        <div className="h-full w-full flex items-center justify-center text-sm text-foreground/80">
          Order Form
        </div>
      </div>
      <div
        key="openOrders"
        className="rounded-md border border-border bg-muted"
      >
        {/* TODO: Replace with <OpenOrdersWidget /> */}
        <div className="h-full w-full flex items-center justify-center text-sm text-foreground/80">
          Open Orders
        </div>
      </div>
      <div
        key="orderBookTradeHistory"
        className="rounded-md border border-border bg-muted"
      >
        {/* TODO: Replace with <OrderBookTradeHistoryWidget /> */}
        <div className="h-full w-full flex items-center justify-center text-sm text-foreground/80">
          Order Book & Trades
        </div>
      </div>
      <div
        key="accountInfo"
        className="rounded-md border border-border bg-muted"
      >
        {/* TODO: Replace with <AccountInfoWidget /> */}
        <div className="h-full w-full flex items-center justify-center text-sm text-foreground/80">
          Account Info
        </div>
      </div>
    </ResponsiveGridLayout>
  );
}
