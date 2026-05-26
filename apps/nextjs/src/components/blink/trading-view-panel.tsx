"use client";

import { useEffect, useRef } from "react";

function toTradingViewSymbol(market: string) {
  return `BINANCE:${market}USDT`;
}

function isExternalChartSupported(market: string) {
  return !market.includes(":");
}

export function TradingViewPanel(props: { market: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<{ remove?: () => void } | null>(null);

  useEffect(() => {
    if (!isExternalChartSupported(props.market)) {
      return;
    }

    let cancelled = false;

    async function mountChart() {
      if (!window.TradingView) {
        const script = document.createElement("script");
        script.src = "https://s3.tradingview.com/tv.js";
        script.async = true;

        await new Promise<void>((resolve, reject) => {
          script.onload = () => resolve();
          script.onerror = () =>
            reject(new Error("Failed to load TradingView"));
          document.head.appendChild(script);
        });
      }

      if (cancelled || !containerRef.current || !window.TradingView) {
        return;
      }

      const tradingView = window.TradingView as
        | {
            widget: new (
              config: Record<string, unknown>,
            ) => {
              remove?: () => void;
            };
          }
        | undefined;

      if (widgetRef.current?.remove) {
        try {
          widgetRef.current.remove();
        } catch {
          // TradingView can throw during rapid remount/unmount transitions.
        }
      }
      if (!containerRef.current.parentNode) return;

      widgetRef.current = tradingView
        ? new tradingView.widget({
            autosize: true,
            container_id: containerRef.current.id,
            symbol: toTradingViewSymbol(props.market),
            interval: "60",
            timezone: "Etc/UTC",
            theme: "dark",
            style: "1",
            locale: "en",
            hide_top_toolbar: false,
            hide_legend: false,
            save_image: false,
            toolbar_bg: "#0b1018",
          })
        : null;
    }

    void mountChart();

    return () => {
      cancelled = true;
      if (widgetRef.current?.remove) {
        try {
          widgetRef.current.remove();
        } catch {
          // Ignore cleanup errors from third-party widget internals.
        }
        widgetRef.current = null;
      }
    };
  }, [props.market]);

  if (!isExternalChartSupported(props.market)) {
    return (
      <section className="glass-panel flex min-h-[640px] flex-col overflow-hidden p-2">
        <div className="flex h-full min-h-[620px] flex-1 flex-col items-center justify-center rounded-[12px] border border-[#88b3ff2e] bg-[#060c18] px-8 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8fbaff80]">
            HIP-3 Chart
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-white">
            {props.market}
          </h2>
          <p className="mt-3 max-w-md text-sm text-foreground/50">
            External TradingView mappings are not available for this
            builder-deployed market yet. Live Hyperliquid price, book, and
            trading are still active on this route.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="glass-panel flex min-h-[640px] flex-col overflow-hidden p-2">
      <div
        ref={containerRef}
        id={`tradingview-${props.market.toLowerCase()}`}
        className="h-full min-h-[620px] flex-1 overflow-hidden rounded-[12px] border border-[#88b3ff2e] bg-[#060c18]"
      />
    </section>
  );
}
