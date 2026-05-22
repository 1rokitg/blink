"use client";

import React, { useState, useCallback, useMemo } from "react";
import { Responsive as ResponsiveGridLayout } from "react-grid-layout";
import { WidthProvider } from "react-grid-layout";

// Create responsive grid layout with width provider
const ResponsiveReactGridLayout = WidthProvider(ResponsiveGridLayout);

// TypeScript interfaces
interface GridItem {
  x: number;
  y: number;
  w: number;
  h: number;
  i: string;
  minW?: number;
  maxW?: number;
  minH?: number;
  maxH?: number;
  static?: boolean;
  isDraggable?: boolean;
  isResizable?: boolean;
}

interface Layouts {
  [key: string]: GridItem[];
}

interface CustomGridLayoutProps {
  className?: string;
  onLayoutChangeAction?: (layout: GridItem[]) => void;
}

/**
 * Custom Grid Layout with various item configurations
 * This demonstrates how to control individual items' dimensions, positioning, and behavior
 */
export function CustomGridLayout({
  className = "",
  onLayoutChangeAction = () => {},
}: CustomGridLayoutProps) {
  // Define custom layouts for different screen sizes
  const layouts = useMemo(
    () => ({
      xl: [
        {
          w: 29,
          h: 4,
          x: 0,
          y: 0,
          i: "watchlist",
          moved: false,
          static: false,
          isDraggable: true,
          isResizable: true,
        },
        {
          w: 29,
          h: 5,
          x: 0,
          y: 4,
          i: "marketInfoHeader",
          moved: false,
          static: false,
          isDraggable: true,
          isResizable: true,
        },
        {
          w: 29,
          h: 50,
          x: 0,
          y: 9,
          i: "tradingChart",
          moved: false,
          static: false,
          isDraggable: true,
          isResizable: true,
        },
        {
          w: 10,
          h: 56,
          x: 38,
          y: 0,
          i: "orderForm",
          moved: false,
          static: false,
          isDraggable: true,
          isResizable: true,
        },
        {
          w: 38,
          h: 30,
          x: 0,
          y: 59,
          i: "openOrders",
          moved: false,
          static: false,
          isDraggable: true,
          isResizable: true,
        },
        {
          w: 9,
          h: 59,
          x: 29,
          y: 0,
          i: "orderBookTradeHistory",
          moved: false,
          static: false,
          isDraggable: true,
          isResizable: true,
        },
        {
          w: 10,
          h: 33,
          x: 38,
          y: 56,
          i: "accountInfo",
          moved: false,
          static: false,
          isDraggable: true,
          isResizable: true,
        },
      ],
      lg: [
        {
          w: 48,
          h: 4,
          x: 0,
          y: 0,
          i: "watchlist",
          moved: false,
          static: false,
          isDraggable: true,
          isResizable: true,
        },
        {
          w: 36,
          h: 5,
          x: 0,
          y: 4,
          i: "marketInfoHeader",
          moved: false,
          static: false,
          isDraggable: true,
          isResizable: true,
        },
        {
          w: 26,
          h: 51,
          x: 0,
          y: 9,
          i: "tradingChart",
          moved: false,
          static: false,
          isDraggable: true,
          isResizable: true,
        },
        {
          w: 12,
          h: 56,
          x: 36,
          y: 4,
          i: "orderForm",
          moved: false,
          static: false,
          isDraggable: true,
          isResizable: true,
        },
        {
          w: 34,
          h: 28,
          x: 0,
          y: 60,
          i: "openOrders",
          moved: false,
          static: false,
          isDraggable: true,
          isResizable: true,
        },
        {
          w: 10,
          h: 51,
          x: 26,
          y: 9,
          i: "orderBookTradeHistory",
          moved: false,
          static: false,
          isDraggable: true,
          isResizable: true,
        },
        {
          w: 14,
          h: 28,
          x: 34,
          y: 60,
          i: "accountInfo",
          moved: false,
          static: false,
          isDraggable: true,
          isResizable: true,
        },
      ],
      md: [
        {
          w: 36,
          h: 4,
          x: 0,
          y: 0,
          i: "watchlist",
          moved: false,
          static: false,
          isDraggable: true,
          isResizable: true,
        },
        {
          w: 36,
          h: 5,
          x: 0,
          y: 4,
          i: "marketInfoHeader",
          moved: false,
          static: false,
          isDraggable: true,
          isResizable: true,
        },
        {
          w: 24,
          h: 32,
          x: 0,
          y: 9,
          i: "tradingChart",
          moved: false,
          static: false,
          isDraggable: true,
          isResizable: true,
        },
        {
          w: 12,
          h: 62,
          x: 24,
          y: 9,
          i: "orderForm",
          moved: false,
          static: false,
          isDraggable: true,
          isResizable: true,
        },
        {
          w: 36,
          h: 24,
          x: 0,
          y: 71,
          i: "openOrders",
          moved: false,
          static: false,
          isDraggable: true,
          isResizable: true,
        },
        {
          w: 12,
          h: 30,
          x: 0,
          y: 41,
          i: "orderBookTradeHistory",
          moved: false,
          static: false,
          isDraggable: true,
          isResizable: true,
        },
        {
          w: 12,
          h: 30,
          x: 12,
          y: 41,
          i: "accountInfo",
          moved: false,
          static: false,
          isDraggable: true,
          isResizable: true,
        },
      ],
      sm: [
        {
          w: 8,
          h: 4,
          x: 0,
          y: 0,
          i: "watchlist",
          moved: false,
          static: false,
          isDraggable: true,
          isResizable: true,
        },
        {
          w: 8,
          h: 5,
          x: 0,
          y: 4,
          i: "marketInfoHeader",
          moved: false,
          static: false,
          isDraggable: true,
          isResizable: true,
        },
        {
          w: 8,
          h: 30,
          x: 0,
          y: 9,
          i: "tradingChart",
          moved: false,
          static: false,
          isDraggable: true,
          isResizable: true,
        },
        {
          w: 4,
          h: 63,
          x: 4,
          y: 39,
          i: "orderForm",
          moved: false,
          static: false,
          isDraggable: true,
          isResizable: true,
        },
        {
          w: 8,
          h: 40,
          x: 0,
          y: 102,
          i: "openOrders",
          moved: false,
          static: false,
          isDraggable: true,
          isResizable: true,
        },
        {
          w: 4,
          h: 35,
          x: 0,
          y: 39,
          i: "orderBookTradeHistory",
          moved: false,
          static: false,
          isDraggable: true,
          isResizable: true,
        },
        {
          w: 4,
          h: 28,
          x: 0,
          y: 74,
          i: "accountInfo",
          moved: false,
          static: false,
          isDraggable: true,
          isResizable: true,
        },
      ],
      xs: [
        {
          w: 4,
          h: 4,
          x: 0,
          y: 0,
          i: "watchlist",
          moved: false,
          static: false,
          isDraggable: true,
          isResizable: true,
        },
        {
          w: 4,
          h: 5,
          x: 0,
          y: 4,
          i: "marketInfoHeader",
          moved: false,
          static: false,
          isDraggable: true,
          isResizable: true,
        },
        {
          w: 4,
          h: 30,
          x: 0,
          y: 9,
          i: "tradingChart",
          moved: false,
          static: false,
          isDraggable: true,
          isResizable: true,
        },
        {
          w: 4,
          h: 48,
          x: 0,
          y: 39,
          i: "orderForm",
          moved: false,
          static: false,
          isDraggable: true,
          isResizable: true,
        },
        {
          w: 4,
          h: 30,
          x: 0,
          y: 119,
          i: "openOrders",
          moved: false,
          static: false,
          isDraggable: true,
          isResizable: true,
        },
        {
          w: 1,
          h: 1,
          x: 0,
          y: 149,
          i: "orderBookTradeHistory",
          moved: false,
          static: false,
        },
        {
          w: 4,
          h: 32,
          x: 0,
          y: 87,
          i: "accountInfo",
          moved: false,
          static: false,
          isDraggable: true,
          isResizable: true,
        },
      ],
    }),
    [],
  );

  // Handle layout changes
  const handleLayoutChange = useCallback(
    (layout: GridItem[]) => {
      onLayoutChangeAction(layout);
    },
    [onLayoutChangeAction],
  );

  // Generate DOM elements with different styles based on item type
  const generateDOM = useMemo(() => {
    const items = [
      {
        id: "large-item",
        label: "Large Item",
        description: "6 cols, 4 rows",
        color: "bg-blue-500",
      },
      {
        id: "medium-item",
        label: "Medium Item",
        description: "3 cols, 3 rows",
        color: "bg-green-500",
      },
      {
        id: "small-item",
        label: "Small Item",
        description: "3 cols, 2 rows",
        color: "bg-yellow-500",
      },
      {
        id: "wide-item",
        label: "Wide Item",
        description: "Full width",
        color: "bg-purple-500",
      },
      {
        id: "static-item",
        label: "Static Item",
        description: "Cannot move/resize",
        color: "bg-red-500",
      },
      {
        id: "custom-item",
        label: "Custom Item",
        description: "Min/Max constraints",
        color: "bg-indigo-500",
      },
      {
        id: "no-drag-item",
        label: "No Drag",
        description: "Resizable only",
        color: "bg-pink-500",
      },
    ];

    return items.map((item) => (
      <div
        key={item.id}
        className={`${item.color} rounded-lg border border-white/20 flex flex-col items-center justify-center text-white shadow-lg`}
      >
        <span className="text-lg font-bold">{item.label}</span>
        <span className="text-xs text-white/80 text-center px-2">
          {item.description}
        </span>
      </div>
    ));
  }, []);

  return (
    <ResponsiveReactGridLayout
      className={`layout ${className}`}
      layouts={layouts}
      breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
      cols={{ lg: 24, md: 10, sm: 6, xs: 4, xxs: 2 }}
      rowHeight={40}
      margin={[10, 10]}
      containerPadding={[16, 16]}
      isDraggable={true}
      isResizable={true}
      useCSSTransforms={true}
      compactType="vertical"
      preventCollision={false}
      onLayoutChange={handleLayoutChange}
    >
      {generateDOM}
    </ResponsiveReactGridLayout>
  );
}

// Export types for external use
export type { GridItem, Layouts, CustomGridLayoutProps };
