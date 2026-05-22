"use client";

import React from "react";

/**
 * Comprehensive guide for customizing react-grid-layout items
 */
export function GridGuide() {
  return (
    <div className="space-y-8 p-6 bg-background">
      <div>
        <h1 className="text-3xl font-bold mb-4">
          React Grid Layout Customization Guide
        </h1>
        <p className="text-muted-foreground text-lg">
          Learn how to customize individual grid items, control dimensions, and
          create specific layouts.
        </p>
      </div>

      {/* Basic Properties */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Basic Grid Item Properties</h2>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-muted p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Position & Size</h3>
            <ul className="space-y-1 text-sm">
              <li>
                <code className="bg-background px-1 rounded">x</code> - Column
                position (0-based)
              </li>
              <li>
                <code className="bg-background px-1 rounded">y</code> - Row
                position (0-based)
              </li>
              <li>
                <code className="bg-background px-1 rounded">w</code> - Width in
                grid units
              </li>
              <li>
                <code className="bg-background px-1 rounded">h</code> - Height
                in grid units
              </li>
              <li>
                <code className="bg-background px-1 rounded">i</code> - Unique
                identifier
              </li>
            </ul>
          </div>

          <div className="bg-muted p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Constraints</h3>
            <ul className="space-y-1 text-sm">
              <li>
                <code className="bg-background px-1 rounded">minW</code> -
                Minimum width
              </li>
              <li>
                <code className="bg-background px-1 rounded">maxW</code> -
                Maximum width
              </li>
              <li>
                <code className="bg-background px-1 rounded">minH</code> -
                Minimum height
              </li>
              <li>
                <code className="bg-background px-1 rounded">maxH</code> -
                Maximum height
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Behavior Properties */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Item Behavior Properties</h2>

        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-muted p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Static Items</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Items that cannot be moved or resized
            </p>
            <code className="bg-background px-2 py-1 rounded text-sm block">
              static: true
            </code>
          </div>

          <div className="bg-muted p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Draggable Control</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Control if item can be dragged
            </p>
            <code className="bg-background px-2 py-1 rounded text-sm block">
              isDraggable: false
            </code>
          </div>

          <div className="bg-muted p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Resizable Control</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Control if item can be resized
            </p>
            <code className="bg-background px-2 py-1 rounded text-sm block">
              isResizable: false
            </code>
          </div>
        </div>
      </section>

      {/* Layout Examples */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Common Layout Patterns</h2>

        <div className="space-y-6">
          {/* Full Width Item */}
          <div className="bg-muted p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Full Width Item</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Spans the entire width of the grid
            </p>
            <code className="bg-background px-2 py-1 rounded text-sm">
              {`{ i: "wide-item", x: 0, y: 0, w: 12, h: 2 }`}
            </code>
          </div>

          {/* Half Width Items */}
          <div className="bg-muted p-4 rounded-lg">
            <h3 className="font-semibold mb-2">
              Half Width Items (Side by Side)
            </h3>
            <p className="text-sm text-muted-foreground mb-2">
              Two items each taking half the width
            </p>
            <div className="space-y-2">
              <code className="bg-background px-2 py-1 rounded text-sm block">
                {`{ i: "left-item", x: 0, y: 0, w: 6, h: 3 }`}
              </code>
              <code className="bg-background px-2 py-1 rounded text-sm block">
                {`{ i: "right-item", x: 6, y: 0, w: 6, h: 3 }`}
              </code>
            </div>
          </div>

          {/* Three Column Layout */}
          <div className="bg-muted p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Three Column Layout</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Three equal-width columns
            </p>
            <div className="space-y-2">
              <code className="bg-background px-2 py-1 rounded text-sm block">
                {`{ i: "col1", x: 0, y: 0, w: 4, h: 3 }`}
              </code>
              <code className="bg-background px-2 py-1 rounded text-sm block">
                {`{ i: "col2", x: 4, y: 0, w: 4, h: 3 }`}
              </code>
              <code className="bg-background px-2 py-1 rounded text-sm block">
                {`{ i: "col3", x: 8, y: 0, w: 4, h: 3 }`}
              </code>
            </div>
          </div>

          {/* Mixed Layout */}
          <div className="bg-muted p-4 rounded-lg">
            <h3 className="font-semibold mb-2">
              Mixed Layout with Constraints
            </h3>
            <p className="text-sm text-muted-foreground mb-2">
              Different sized items with min/max constraints
            </p>
            <div className="space-y-2">
              <code className="bg-background px-2 py-1 rounded text-sm block">
                {`{ i: "large", x: 0, y: 0, w: 8, h: 4, minW: 4, maxW: 10 }`}
              </code>
              <code className="bg-background px-2 py-1 rounded text-sm block">
                {`{ i: "small", x: 8, y: 0, w: 4, h: 2, minW: 2, maxW: 6 }`}
              </code>
              <code className="bg-background px-2 py-1 rounded text-sm block">
                {`{ i: "static", x: 0, y: 4, w: 6, h: 3, static: true }`}
              </code>
            </div>
          </div>
        </div>
      </section>

      {/* Responsive Layouts */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Responsive Layouts</h2>

        <div className="bg-muted p-4 rounded-lg">
          <p className="text-sm text-muted-foreground mb-4">
            Define different layouts for different screen sizes. The grid will
            automatically switch between them based on the current breakpoint.
          </p>

          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Breakpoints</h4>
              <code className="bg-background px-2 py-1 rounded text-sm">
                breakpoints=&#123;&#123; lg: 1200, md: 996, sm: 768, xs: 480,
                xxs: 0 &#125;&#125;
              </code>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Columns per Breakpoint</h4>
              <code className="bg-background px-2 py-1 rounded text-sm">
                cols=&#123;&#123; lg: 12, md: 10, sm: 6, xs: 4, xxs: 2
                &#125;&#125;
              </code>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Layout Structure</h4>
              <pre className="bg-background p-3 rounded text-sm overflow-x-auto">
                {`const layouts = {
  lg: [
    { i: "item1", x: 0, y: 0, w: 6, h: 4 },
    { i: "item2", x: 6, y: 0, w: 6, h: 4 }
  ],
  md: [
    { i: "item1", x: 0, y: 0, w: 5, h: 4 },
    { i: "item2", x: 5, y: 0, w: 5, h: 4 }
  ],
  sm: [
    { i: "item1", x: 0, y: 0, w: 6, h: 4 },
    { i: "item2", x: 0, y: 4, w: 6, h: 4 }
  ]
};`}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* Grid Configuration */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Grid Configuration</h2>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-muted p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Basic Settings</h3>
            <ul className="space-y-1 text-sm">
              <li>
                <code className="bg-background px-1 rounded">rowHeight</code> -
                Height of each row in pixels
              </li>
              <li>
                <code className="bg-background px-1 rounded">margin</code> -
                Space between items [x, y]
              </li>
              <li>
                <code className="bg-background px-1 rounded">
                  containerPadding
                </code>{" "}
                - Padding inside container [x, y]
              </li>
              <li>
                <code className="bg-background px-1 rounded">cols</code> -
                Number of columns
              </li>
            </ul>
          </div>

          <div className="bg-muted p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Behavior Settings</h3>
            <ul className="space-y-1 text-sm">
              <li>
                <code className="bg-background px-1 rounded">isDraggable</code>{" "}
                - Allow dragging
              </li>
              <li>
                <code className="bg-background px-1 rounded">isResizable</code>{" "}
                - Allow resizing
              </li>
              <li>
                <code className="bg-background px-1 rounded">compactType</code>{" "}
                - "vertical", "horizontal", or null
              </li>
              <li>
                <code className="bg-background px-1 rounded">
                  preventCollision
                </code>{" "}
                - Prevent items from overlapping
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Tips */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Pro Tips</h2>

        <div className="bg-muted p-4 rounded-lg space-y-3">
          <div>
            <h4 className="font-semibold">1. Use Constraints Wisely</h4>
            <p className="text-sm text-muted-foreground">
              Set minW/maxW and minH/maxH to prevent items from becoming too
              small or too large.
            </p>
          </div>

          <div>
            <h4 className="font-semibold">2. Plan Your Responsive Layouts</h4>
            <p className="text-sm text-muted-foreground">
              Design for mobile first, then add more complex layouts for larger
              screens.
            </p>
          </div>

          <div>
            <h4 className="font-semibold">
              3. Use Static Items for Fixed Elements
            </h4>
            <p className="text-sm text-muted-foreground">
              Headers, footers, and navigation elements should be static.
            </p>
          </div>

          <div>
            <h4 className="font-semibold">4. Test on Different Screen Sizes</h4>
            <p className="text-sm text-muted-foreground">
              Always test your layouts on various devices and screen sizes.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
