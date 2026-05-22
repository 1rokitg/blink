"use client";

import { useEffect, useRef } from "react";

function toTradingViewSymbol(market: string) {
  return `BINANCE:${market}USDT`;
}

export function TradingViewPanel(props: { market: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<{ remove?: () => void } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function mountChart() {
      if (!window.TradingView) {
        const script = document.createElement("script");
        script.src = "https://s3.tradingview.com/tv.js";
        script.async = true;

        await new Promise<void>((resolve, reject) => {
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Failed to load TradingView"));
          document.head.appendChild(script);
        });
      }

      if (cancelled || !containerRef.current || !window.TradingView) {
        return;
      }

      const tradingView = window.TradingView as
        | {
            widget: new (config: Record<string, unknown>) => {
              remove?: () => void;
            };
          }
        | undefined;

      if (widgetRef.current?.remove) {
        widgetRef.current.remove();
      }

      containerRef.current.innerHTML = "";

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
        widgetRef.current.remove();
        widgetRef.current = null;
      }
    };
  }, [props.market]);

  return (
    <section className="glass-panel flex min-h-[620px] flex-col overflow-hidden p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="terminal-label">Chart</p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            {props.market} market structure
          </h2>
        </div>
      </div>

      <div
        ref={containerRef}
        id={`tradingview-${props.market.toLowerCase()}`}
        className="min-h-[540px] flex-1 overflow-hidden rounded-[24px] border border-white/6 bg-[#0b1018]"
      />
    </section>
  );
}
