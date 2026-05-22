"use client";

import { TrendingUp, TrendingDown } from "lucide-react";

interface MarketData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
}

const mockMarketData: MarketData[] = [
  { symbol: "BTC", price: 122231.0, change: 1.39, changePercent: 1.39 },
  { symbol: "ETH", price: 4514.1, change: 1.09, changePercent: 1.09 },
  { symbol: "HYPE", price: 49.497, change: -2.09, changePercent: -2.09 },
];

export function MarketInfoBar() {
  return (
    <div className="bg-background border-b border-border">
      <div className="flex items-center justify-between px-4 py-2">
        {/* Market tickers */}
        <div className="flex items-center space-x-6">
          {mockMarketData.map((data) => (
            <div key={data.symbol} className="flex items-center space-x-2">
              {data.change >= 0 ? (
                <TrendingUp className="w-4 h-4 text-green-500" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-500" />
              )}
              <span
                className={`text-sm font-medium ${
                  data.change >= 0 ? "text-green-500" : "text-red-500"
                }`}
              >
                +{data.change}%
              </span>
              <span className="text-sm font-semibold text-foreground">
                {data.symbol}
              </span>
              <span className="text-sm text-muted-foreground">
                {data.price.toLocaleString()}
              </span>
            </div>
          ))}
        </div>

        {/* Current trading pair info */}
        <div className="flex items-center space-x-4">
          <div className="text-sm">
            <span className="text-muted-foreground">&lt; ETH-USD</span>
          </div>
          <div className="flex items-center space-x-4 text-sm">
            <div>
              <span className="text-muted-foreground">Mark </span>
              <span className="text-foreground">0.00</span>
            </div>
            <div>
              <span className="text-muted-foreground">24h Change </span>
              <span className="text-green-500">48.55 / +1.09%</span>
            </div>
            <div>
              <span className="text-muted-foreground">24h Vol </span>
              <span className="text-foreground">$0.00</span>
            </div>
            <div>
              <span className="text-muted-foreground">Open Interest </span>
              <span className="text-foreground">$0.00</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
