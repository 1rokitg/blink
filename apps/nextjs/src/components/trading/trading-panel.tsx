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
import { Input } from "@acme/ui/input";
import { Label } from "@acme/ui/label";
import { Checkbox } from "@acme/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@acme/ui/card";

export function TradingPanel() {
  const [orderType, setOrderType] = useState("limit");
  const [side, setSide] = useState<"long" | "short">("long");
  const [leverage, setLeverage] = useState("25x");
  const [price, setPrice] = useState("");
  const [amount, setAmount] = useState("");
  const [reduceOnly, setReduceOnly] = useState(false);
  const [tpSl, setTpSl] = useState(false);

  const handlePercentageClick = (percentage: number) => {
    // Mock calculation - in real app, this would calculate based on available balance
    const mockBalance = 1000;
    const calculatedAmount = (mockBalance * percentage) / 100;
    setAmount(calculatedAmount.toString());
  };

  return (
    <Card className="h-full bg-muted">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Trading Panel</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Order Settings */}
        <div className="flex items-center space-x-2">
          <Select defaultValue="cross">
            <SelectTrigger className="w-20 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cross">Cross</SelectItem>
              <SelectItem value="isolated">Isolated</SelectItem>
            </SelectContent>
          </Select>

          <Select value={leverage} onValueChange={setLeverage}>
            <SelectTrigger className="w-16 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1x">1x</SelectItem>
              <SelectItem value="5x">5x</SelectItem>
              <SelectItem value="10x">10x</SelectItem>
              <SelectItem value="25x">25x</SelectItem>
              <SelectItem value="50x">50x</SelectItem>
            </SelectContent>
          </Select>

          <Select value={orderType} onValueChange={setOrderType}>
            <SelectTrigger className="w-20 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="limit">Limit</SelectItem>
              <SelectItem value="market">Market</SelectItem>
              <SelectItem value="stop">Stop</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Long/Short Buttons */}
        <div className="flex space-x-2">
          <Button
            variant={side === "long" ? "default" : "outline"}
            size="sm"
            className={`flex-1 h-8 text-xs ${
              side === "long" ? "bg-green-600 hover:bg-green-700" : ""
            }`}
            onClick={() => setSide("long")}
          >
            Long
          </Button>
          <Button
            variant={side === "short" ? "default" : "outline"}
            size="sm"
            className={`flex-1 h-8 text-xs ${
              side === "short" ? "bg-red-600 hover:bg-red-700" : ""
            }`}
            onClick={() => setSide("short")}
          >
            Short
          </Button>
        </div>

        {/* Account Info */}
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Available Funds</span>
            <span className="text-foreground">0.00 USDC</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Current Position</span>
            <span className="text-foreground">0.0000 ETH</span>
          </div>
        </div>

        {/* Price Input */}
        <div className="space-y-2">
          <Label htmlFor="price" className="text-xs">
            Price
          </Label>
          <div className="relative">
            <Input
              id="price"
              type="number"
              placeholder="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="h-8 text-xs pr-8"
            />
            <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-muted-foreground">
              USDC
            </span>
          </div>
        </div>

        {/* Amount Input */}
        <div className="space-y-2">
          <Label htmlFor="amount" className="text-xs">
            Amount
          </Label>
          <div className="relative">
            <Input
              id="amount"
              type="number"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-8 text-xs pr-8"
            />
            <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-muted-foreground">
              ETH
            </span>
          </div>
        </div>

        {/* Percentage Buttons */}
        <div className="grid grid-cols-3 gap-1">
          {[25, 33, 50, 66, 75, 100].map((percentage) => (
            <Button
              key={percentage}
              variant="outline"
              size="sm"
              className="h-6 text-xs"
              onClick={() => handlePercentageClick(percentage)}
            >
              {percentage}%
            </Button>
          ))}
        </div>

        {/* Checkboxes */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="reduce"
              checked={reduceOnly}
              onCheckedChange={(checked) => setReduceOnly(checked === true)}
            />
            <Label htmlFor="reduce" className="text-xs">
              Reduce
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="tpsl"
              checked={tpSl}
              onCheckedChange={(checked) => setTpSl(checked === true)}
            />
            <Label htmlFor="tpsl" className="text-xs">
              TP/SL
            </Label>
          </div>
        </div>

        {/* Order Type */}
        <Select defaultValue="gtc">
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="gtc">GTC</SelectItem>
            <SelectItem value="ioc">IOC</SelectItem>
            <SelectItem value="fok">FOK</SelectItem>
          </SelectContent>
        </Select>

        {/* Connect Button */}
        <Button className="w-full h-10 bg-orange-600 hover:bg-orange-700 text-white font-medium">
          Connect
        </Button>

        {/* Order Details */}
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Est Liq:</span>
            <span className="text-foreground">$0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Order Val:</span>
            <span className="text-foreground">$0.00</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Margin Req:</span>
            <span className="text-foreground">$0.00</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
