"use client";

import { Button } from "@acme/ui/button";
import { Badge } from "@acme/ui/badge";
import { Twitter, MessageCircle, Globe } from "lucide-react";

export function StatusBar() {
  return (
    <div className="bg-background border-t border-border">
      <div className="flex items-center justify-between px-4 py-2">
        {/* Left side - Account metrics */}
        <div className="flex items-center space-x-6 text-xs text-muted-foreground">
          <div className="flex items-center space-x-2">
            <span>Open:</span>
            <span className="text-foreground">$0.00</span>
          </div>
          <div className="flex items-center space-x-2">
            <span>Longs:</span>
            <span className="text-foreground">$0.00</span>
          </div>
          <div className="flex items-center space-x-2">
            <span>Shorts:</span>
            <span className="text-foreground">$0.00</span>
          </div>
          <div className="flex items-center space-x-2">
            <span>Delta:</span>
            <span className="text-green-500">+$0.00</span>
          </div>
          <div className="flex items-center space-x-2">
            <span>UPnL:</span>
            <span className="text-green-500">+$0.00</span>
          </div>
          <div className="flex items-center space-x-2">
            <span>Orders:</span>
            <span className="text-foreground">0 ($0.00)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span>Buys/Sells:</span>
            <span className="text-foreground">0 ($0.00) / 0 ($0.00)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span>Vol + News</span>
          </div>
        </div>

        {/* Right side - Social links and user info */}
        <div className="flex items-center space-x-4">
          {/* Social media icons */}
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-muted"
            >
              <Twitter className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-muted"
            >
              <MessageCircle className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-muted"
            >
              <Globe className="w-4 h-4" />
            </Button>
          </div>

          {/* User info */}
          <div className="flex items-center space-x-2">
            <span className="text-xs text-muted-foreground">bbc3839</span>
            <Badge variant="destructive" className="h-4 px-1 text-xs">
              Offline
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}
