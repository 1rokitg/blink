"use client";

import { useMemo, useRef, useState } from "react";

import { useSearchParams } from "next/navigation";
import { Check, Loader2, PlayCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@acme/ui/button";
import { Input } from "@acme/ui/input";

import { BUILDER_ADDRESS, BUILDER_FEE_UNITS } from "~/lib/blink/builder";

type OrderType = "limit" | "market";
type Side = "buy" | "sell";

export function E2ETradingFlowHarness() {
  const searchParams = useSearchParams();
  const approved = searchParams.get("approved") === "1";
  const [tradeEnabled, setTradeEnabled] = useState(approved);
  const [builderModalOpen, setBuilderModalOpen] = useState(!approved);
  const [size, setSize] = useState("");
  const [price, setPrice] = useState("77000");
  const [orderType, setOrderType] = useState<OrderType>("market");
  const [side, setSide] = useState<Side>("buy");
  const [submitting, setSubmitting] = useState(false);
  const [lastPayload, setLastPayload] = useState<Record<string, unknown> | null>(
    null,
  );
  const retryOnceRef = useRef(true);

  const market = "BTC";
  const assetIndex = 0;
  const markPrice = 77000;

  const effectivePrice = useMemo(() => {
    if (orderType === "limit") return Number.parseFloat(price || "0");
    const slippage = side === "buy" ? markPrice * 1.05 : markPrice * 0.95;
    return Number(slippage.toFixed(2));
  }, [orderType, price, side]);

  const buildPayload = () => ({
    action: {
      type: "order",
      orders: [
        {
          a: assetIndex,
          b: side === "buy",
          p: effectivePrice.toString(),
          s: Number.parseFloat(size).toString(),
          r: false,
          t:
            orderType === "limit"
              ? { limit: { tif: "Gtc" } }
              : { limit: { tif: "Ioc" } },
        },
      ],
      grouping: "na",
      builder: { b: BUILDER_ADDRESS.toLowerCase(), f: BUILDER_FEE_UNITS },
    },
    nonce: Date.now(),
  });

  const submitOrder = async () => {
    const orderPayload = buildPayload();
    setLastPayload(orderPayload);

    if (retryOnceRef.current) {
      retryOnceRef.current = false;
      throw new Error("Invalid nonce: duplicate nonce 1779615531066");
    }

    return { status: "ok", response: { type: "order", data: { statuses: [{}] } } };
  };

  const handleSubmit = async () => {
    if (!tradeEnabled) {
      setBuilderModalOpen(true);
      return;
    }

    const sz = Number.parseFloat(size);
    if (!sz || sz <= 0) {
      toast.error("Enter a valid size");
      return;
    }
    if (orderType === "limit" && (!effectivePrice || effectivePrice <= 0)) {
      toast.error("Enter a valid limit price");
      return;
    }

    setSubmitting(true);
    const toastId = toast.loading(
      `${side === "buy" ? "Sending long" : "Sending short"} order…`,
    );

    try {
      try {
        await submitOrder();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.toLowerCase().includes("duplicate nonce")) {
          await submitOrder();
        } else {
          throw err;
        }
      }
      toast.success(
        `${side === "buy" ? "Buy" : "Sell"} ${orderType}: ${sz} ${market}`,
        { id: toastId },
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Order failed", {
        id: toastId,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-background p-8 text-foreground">
      <div className="mx-auto max-w-4xl space-y-4">
        <h1 className="text-3xl font-semibold text-white">E2E Trading Harness</h1>
        {!tradeEnabled ? (
          <div className="whop-yellow-banner">
            One-time setup required to route trades on Hyperliquid.
          </div>
        ) : null}

        {builderModalOpen ? (
          <section className="glass-panel p-5">
            <h2 className="text-4xl font-semibold text-[#8af2df]">Enable Trading</h2>
            <p className="mt-2 text-white">2 signatures needed</p>
            <p className="mt-2 text-sm text-foreground/70">Approve Builder Fee</p>
            <p className="text-sm text-foreground/70">Approve Agent Key</p>
            <Button
              className="mt-4"
              onClick={() => {
                setTradeEnabled(true);
                setBuilderModalOpen(false);
              }}
            >
              <Check className="mr-2 size-4" />
              Complete setup
            </Button>
          </section>
        ) : null}

        <section className="glass-panel p-5">
          <p className="terminal-label">Order entry</p>
          <div className="mt-3 flex items-center gap-2">
            <Button
              variant={side === "buy" ? "default" : "outline"}
              onClick={() => setSide("buy")}
            >
              Buy
            </Button>
            <Button
              variant={side === "sell" ? "default" : "outline"}
              onClick={() => setSide("sell")}
            >
              Sell
            </Button>
            <Button
              variant={orderType === "market" ? "default" : "outline"}
              onClick={() => setOrderType("market")}
            >
              Market
            </Button>
            <Button
              variant={orderType === "limit" ? "default" : "outline"}
              onClick={() => setOrderType("limit")}
            >
              Limit
            </Button>
          </div>

          {orderType === "limit" ? (
            <div className="mt-3">
              <p className="terminal-label">Price</p>
              <Input
                aria-label="Price"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
          ) : null}

          <div className="mt-3">
            <p className="terminal-label">Size ({market})</p>
            <Input
              aria-label={`Size (${market})`}
              value={size}
              onChange={(e) => setSize(e.target.value)}
            />
          </div>

          <Button className="mt-4" disabled={submitting} onClick={() => void handleSubmit()}>
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <PlayCircle className="mr-2 size-4" />
                Submit {orderType} order
              </>
            )}
          </Button>
        </section>

        <section className="glass-panel p-5">
          <p className="terminal-label">Last payload (prod-like shape)</p>
          <pre className="mt-2 overflow-auto rounded-md bg-black/30 p-3 text-xs text-foreground/80">
            {JSON.stringify(lastPayload, null, 2)}
          </pre>
        </section>
      </div>
    </main>
  );
}
