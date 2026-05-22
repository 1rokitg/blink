"use client";

import React, { useCallback, useMemo } from "react";
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

interface SimpleCustomLayoutProps {
  className?: string;
  onLayoutChangeAction?: (layout: GridItem[]) => void;
}

/**
 * Simple example showing how to create custom layouts
 * This is a great starting point for understanding grid customization
 */
export function SimpleCustomLayout({
  className = "",
  onLayoutChangeAction = () => {},
}: SimpleCustomLayoutProps) {
  // Define your custom layout for different screen sizes
  const layouts = useMemo(
    () => ({
      lg: [
        // Header - full width, 2 rows tall, static (cannot be moved)
        { i: "header", x: 0, y: 0, w: 12, h: 2, static: true },

        // Sidebar - 3 columns wide, 8 rows tall
        { i: "sidebar", x: 0, y: 2, w: 3, h: 8, minW: 2, maxW: 4 },

        // Main content - 6 columns wide, 8 rows tall
        { i: "main", x: 3, y: 2, w: 6, h: 8, minW: 4, maxW: 8 },

        // Right panel - 3 columns wide, 8 rows tall
        { i: "right", x: 9, y: 2, w: 3, h: 8, minW: 2, maxW: 4 },

        // Footer - full width, 2 rows tall, static
        { i: "footer", x: 0, y: 10, w: 12, h: 2, static: true },
      ],

      md: [
        // Medium screens - stack sidebar and right panel vertically
        { i: "header", x: 0, y: 0, w: 10, h: 2, static: true },
        { i: "sidebar", x: 0, y: 2, w: 5, h: 4, minW: 3, maxW: 7 },
        { i: "main", x: 5, y: 2, w: 5, h: 6, minW: 3, maxW: 7 },
        { i: "right", x: 0, y: 6, w: 5, h: 4, minW: 3, maxW: 7 },
        { i: "footer", x: 0, y: 10, w: 10, h: 2, static: true },
      ],

      sm: [
        // Small screens - single column layout
        { i: "header", x: 0, y: 0, w: 6, h: 2, static: true },
        { i: "sidebar", x: 0, y: 2, w: 6, h: 3, minW: 4, maxW: 6 },
        { i: "main", x: 0, y: 5, w: 6, h: 4, minW: 4, maxW: 6 },
        { i: "right", x: 0, y: 9, w: 6, h: 3, minW: 4, maxW: 6 },
        { i: "footer", x: 0, y: 12, w: 6, h: 2, static: true },
      ],

      xs: [
        // Extra small screens - compact single column
        { i: "header", x: 0, y: 0, w: 4, h: 2, static: true },
        { i: "sidebar", x: 0, y: 2, w: 4, h: 2, minW: 3, maxW: 4 },
        { i: "main", x: 0, y: 4, w: 4, h: 3, minW: 3, maxW: 4 },
        { i: "right", x: 0, y: 7, w: 4, h: 2, minW: 3, maxW: 4 },
        { i: "footer", x: 0, y: 9, w: 4, h: 2, static: true },
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

  // Generate DOM elements with different styles for each section
  const generateDOM = useMemo(() => {
    const sections = [
      {
        id: "header",
        label: "Header",
        description: "Full width, static",
        color: "bg-blue-600",
        icon: "🏠",
      },
      {
        id: "sidebar",
        label: "Sidebar",
        description: "3 cols, resizable",
        color: "bg-green-600",
        icon: "📋",
      },
      {
        id: "main",
        label: "Main Content",
        description: "6 cols, main area",
        color: "bg-purple-600",
        icon: "📄",
      },
      {
        id: "right",
        label: "Right Panel",
        description: "3 cols, resizable",
        color: "bg-orange-600",
        icon: "⚙️",
      },
      {
        id: "footer",
        label: "Footer",
        description: "Full width, static",
        color: "bg-gray-600",
        icon: "📊",
      },
    ];

    return sections.map((section) => (
      <div
        key={section.id}
        className={`${section.color} rounded-lg border border-white/20 flex flex-col items-center justify-center text-white shadow-lg`}
      >
        <div className="text-2xl mb-2">{section.icon}</div>
        <span className="text-lg font-bold">{section.label}</span>
        <span className="text-xs text-white/80 text-center px-2">
          {section.description}
        </span>
      </div>
    ));
  }, []);

  return (
    <ResponsiveReactGridLayout
      className={`layout ${className}`}
      layouts={layouts}
      breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
      cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
      rowHeight={40}
      margin={[8, 8]}
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
export type { GridItem, Layouts, SimpleCustomLayoutProps };
