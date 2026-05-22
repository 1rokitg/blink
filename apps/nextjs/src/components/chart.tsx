"use client";

import { Maximize2, Minimize2, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// Extend Window interface to include TradingView
declare global {
  interface Window {
    // biome-ignore lint/suspicious/noExplicitAny: tradingview
    TradingView?: any;
  }
}

// Popular cryptocurrency symbols for easy access
const POPULAR_CRYPTOS = [
  { symbol: "BTCUSD", name: "Bitcoin" },
  { symbol: "ETHUSD", name: "Ethereum" },
  { symbol: "BNBUSD", name: "BNB" },
  { symbol: "SOLUSD", name: "Solana" },
  { symbol: "ADAUSD", name: "Cardano" },
  { symbol: "XRPUSD", name: "XRP" },
  { symbol: "DOTUSD", name: "Polkadot" },
  { symbol: "AVAXUSD", name: "Avalanche" },
];

export default function Chart() {
  // State management
  const [currentSymbol, setCurrentSymbol] = useState("BTCUSD");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);

  // Refs for DOM elements
  const chartContainerRef = useRef<HTMLDivElement>(null);
  // biome-ignore lint/suspicious/noExplicitAny: tradingview
  const widgetRef = useRef<any>(null);

  // Load TradingView script only once
  useEffect(() => {
    // Check if script is already loaded
    if (window.TradingView) {
      setIsScriptLoaded(true);
      return;
    }

    // Create and load the TradingView script
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/tv.js";
    script.async = true;
    script.onload = () => {
      setIsScriptLoaded(true);
    };
    document.head.appendChild(script);

    // Cleanup function
    return () => {
      // Only remove if we added it
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  // Initialize or update the TradingView widget
  useEffect(() => {
    if (!isScriptLoaded || !chartContainerRef.current) return;

    // Clear previous widget if it exists
    if (widgetRef.current) {
      widgetRef.current.remove();
    }
    // Clear the container
    chartContainerRef.current.innerHTML = "";

    // Create new widget
    widgetRef.current = new window.TradingView.widget({
      autosize: true,
      symbol: currentSymbol,
      container_id: chartContainerRef.current.id,
      interval: "1D",
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "en",
      toolbar_bg: "#f1f3f6",
      enable_publishing: false,
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: true,
    });

    // Cleanup function
    return () => {
      if (widgetRef.current) {
        widgetRef.current.remove();
        widgetRef.current = null;
      }
    };
  }, [isScriptLoaded, currentSymbol]);

  // Handle custom search
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      // Ensure the symbol ends with USD for crypto pairs
      const symbol = searchTerm.toUpperCase().endsWith("USD")
        ? searchTerm.toUpperCase()
        : `${searchTerm.toUpperCase()}USD`;
      handleSymbolChange(symbol);
    }
  };

  // Handle symbol change
  const handleSymbolChange = (symbol: string) => {
    setCurrentSymbol(symbol.toUpperCase());
    setSearchTerm("");
  };

  // Toggle fullscreen mode
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  return (
    <div
      className={`bg-muted rounded-xl shadow-lg ${
        isFullscreen
          ? "fixed inset-0 z-50 rounded-none"
          : "relative h-full w-full rounded-xl "
      }`}
    >
      {/* Chart container */}
      <div className={`${isFullscreen ? "h-[calc(100vh-140px)]" : "h-full"}`}>
        <div
          ref={chartContainerRef}
          id="tradingview-chart"
          className="-m-px w-[calc(100%+2px)] h-[calc(100%+2px)]"
        />
      </div>
    </div>
  );
}
