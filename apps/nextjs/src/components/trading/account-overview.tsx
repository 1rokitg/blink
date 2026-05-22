"use client";

import { useState } from "react";
import { Button } from "@acme/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@acme/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@acme/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@acme/ui/card";
import { Send, ArrowLeftRight } from "lucide-react";

export function AccountOverview() {
  const [selectedTab, setSelectedTab] = useState("balances");

  const mockBalances = [
    {
      coin: "USDC (Perps)",
      totalBalance: "0.00",
      availableBalance: "0.00",
      usdcValue: "0.00",
      pnl: "0.00",
      roe: "0.00%",
    },
  ];

  return (
    <Card className="h-full bg-muted">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Account Overview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-4 text-xs">
            <TabsTrigger value="balances" className="text-xs">
              Balances
            </TabsTrigger>
            <TabsTrigger value="positions" className="text-xs">
              Positions(0)
            </TabsTrigger>
            <TabsTrigger value="orders" className="text-xs">
              Orders(0)
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs">
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="balances" className="space-y-4">
            {/* Filters */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Select defaultValue="all">
                  <SelectTrigger className="w-20 h-6 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="spot">Spot</SelectItem>
                    <SelectItem value="perps">Perps</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <Button variant="ghost" size="sm" className="h-6 px-2">
                  <Send className="w-3 h-3" />
                </Button>
                <Button variant="ghost" size="sm" className="h-6 px-2">
                  <ArrowLeftRight className="w-3 h-3" />
                </Button>
              </div>
            </div>

            {/* Balances Table */}
            <div className="space-y-2">
              <div className="grid grid-cols-5 gap-2 text-xs text-muted-foreground">
                <span>COIN</span>
                <span className="text-right">TOTAL</span>
                <span className="text-right">AVAILABLE</span>
                <span className="text-right">USDC VALUE ↓</span>
                <span className="text-right">PNL (ROE %)</span>
              </div>

              {mockBalances.map((balance) => (
                <div
                  key={balance.coin}
                  className="grid grid-cols-5 gap-2 text-xs"
                >
                  <span className="text-foreground">{balance.coin}</span>
                  <span className="text-right text-foreground">
                    {balance.totalBalance}
                  </span>
                  <span className="text-right text-foreground">
                    {balance.availableBalance}
                  </span>
                  <span className="text-right text-foreground">
                    {balance.usdcValue}
                  </span>
                  <span className="text-right text-foreground">
                    {balance.pnl} ({balance.roe})
                  </span>
                </div>
              ))}
            </div>

            {/* Deposit/Withdraw Section */}
            <div className="space-y-3 pt-4 border-t border-border">
              <div className="flex space-x-2">
                <Button className="flex-1 h-8 bg-orange-600 hover:bg-orange-700 text-white text-xs">
                  Deposit
                </Button>
                <Button variant="outline" className="flex-1 h-8 text-xs">
                  Withdraw
                </Button>
              </div>

              <div className="flex items-center justify-center">
                <div className="flex items-center space-x-2 bg-background rounded-lg p-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                  >
                    Perps
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                  >
                    Spot
                  </Button>
                </div>
              </div>
            </div>

            {/* Account Equity */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Spot</span>
                <span className="text-foreground">$0.00</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Perps</span>
                <span className="text-foreground">$0.00</span>
              </div>
            </div>

            {/* Perps Overview */}
            <div className="space-y-2 text-xs pt-2 border-t border-border">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Balance</span>
                <span className="text-foreground">$0.00</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Unrealized PNL</span>
                <span className="text-green-500">+$0.00</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Cross Margin Ratio
                </span>
                <span className="text-foreground">0.00%</span>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="positions">
            <div className="text-center text-muted-foreground text-sm py-8">
              No open positions
            </div>
          </TabsContent>

          <TabsContent value="orders">
            <div className="text-center text-muted-foreground text-sm py-8">
              No open orders
            </div>
          </TabsContent>

          <TabsContent value="history">
            <div className="text-center text-muted-foreground text-sm py-8">
              No trade history
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
