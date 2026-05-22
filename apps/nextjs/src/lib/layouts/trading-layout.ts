import type { Layouts } from "react-grid-layout";

// Define the trading layout configuration for different breakpoints
export const tradingLayouts: Layouts = {
  lg: [
    // Header - spans full width
    // Order book - top right panel
    { i: "order-book", x: 8, y: 2, w: 4, h: 6, minW: 3, maxW: 6 },

    // Chart - takes up most of the left side
    { i: "chart", x: 0, y: 2, w: 8, h: 20, minW: 6, maxW: 10 },

    // Trading panel - middle right panel
    { i: "trading-panel", x: 8, y: 8, w: 4, h: 8, minW: 3, maxW: 6 },

    // Account overview - bottom right panel
    { i: "account-overview", x: 8, y: 16, w: 4, h: 6, minW: 3, maxW: 6 },

    // Status bar - spans full width at bottom
    { i: "status-bar", x: 0, y: 22, w: 12, h: 1, static: true },
  ],

  md: [
    // Medium screens - stack more vertically
    { i: "header", x: 0, y: 0, w: 10, h: 1, static: true },
    { i: "market-info", x: 0, y: 1, w: 10, h: 1, static: true },
    { i: "chart", x: 0, y: 2, w: 10, h: 12, minW: 8 },
    { i: "order-book", x: 0, y: 14, w: 5, h: 6, minW: 4 },
    { i: "trading-panel", x: 5, y: 14, w: 5, h: 6, minW: 4 },
    { i: "account-overview", x: 0, y: 20, w: 10, h: 6, minW: 8 },
    { i: "status-bar", x: 0, y: 26, w: 10, h: 1, static: true },
  ],

  sm: [
    // Small screens - single column layout
    { i: "header", x: 0, y: 0, w: 6, h: 1, static: true },
    { i: "market-info", x: 0, y: 1, w: 6, h: 1, static: true },
    { i: "chart", x: 0, y: 2, w: 6, h: 10, minW: 4 },
    { i: "order-book", x: 0, y: 12, w: 6, h: 6, minW: 4 },
    { i: "trading-panel", x: 0, y: 18, w: 6, h: 8, minW: 4 },
    { i: "account-overview", x: 0, y: 26, w: 6, h: 6, minW: 4 },
    { i: "status-bar", x: 0, y: 32, w: 6, h: 1, static: true },
  ],

  xs: [
    // Extra small screens - minimal layout
    { i: "header", x: 0, y: 0, w: 4, h: 1, static: true },
    { i: "market-info", x: 0, y: 1, w: 4, h: 1, static: true },
    { i: "chart", x: 0, y: 2, w: 4, h: 8, minW: 3 },
    { i: "order-book", x: 0, y: 10, w: 4, h: 4, minW: 3 },
    { i: "trading-panel", x: 0, y: 14, w: 4, h: 6, minW: 3 },
    { i: "account-overview", x: 0, y: 20, w: 4, h: 4, minW: 3 },
    { i: "status-bar", x: 0, y: 24, w: 4, h: 1, static: true },
  ],

  xxs: [
    // Extra extra small screens - very compact
    { i: "header", x: 0, y: 0, w: 2, h: 1, static: true },
    { i: "market-info", x: 0, y: 1, w: 2, h: 1, static: true },
    { i: "chart", x: 0, y: 2, w: 2, h: 6, minW: 2 },
    { i: "order-book", x: 0, y: 8, w: 2, h: 3, minW: 2 },
    { i: "trading-panel", x: 0, y: 11, w: 2, h: 4, minW: 2 },
    { i: "account-overview", x: 0, y: 15, w: 2, h: 3, minW: 2 },
    { i: "status-bar", x: 0, y: 18, w: 2, h: 1, static: true },
  ],
};

// Breakpoints configuration
export const breakpoints = {
  lg: 1200,
  md: 996,
  sm: 768,
  xs: 480,
  xxs: 0,
};

// Columns configuration
export const cols = {
  lg: 12,
  md: 10,
  sm: 6,
  xs: 4,
  xxs: 2,
};
