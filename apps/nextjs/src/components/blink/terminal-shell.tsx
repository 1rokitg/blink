"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import {
  useLogout,
  usePrivy,
  useWallets,
} from "@privy-io/react-auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  LayoutDashboard,
  Loader2,
  LogOut,
  Search,
  Settings2,
  ShieldCheck,
  Star,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@acme/ui/badge";
import { Button } from "@acme/ui/button";
import { Input } from "@acme/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@acme/ui/tabs";

import {
  BUILDER_ADDRESS,
  BUILDER_FEE_UNITS,
  isBuilderApproved,
} from "~/lib/blink/builder";
import {
  createExchangeClient,
  getAssetIndex,
  infoClient,
} from "~/lib/blink/hyperliquid";
import {
  fetchTopMarketsByVolume,
  formatCompactNumber,
  formatUsd,
  marketToSlug,
} from "~/lib/blink/markets";

import { MarketInfoBar } from "./market-info-bar";
import { TerminalOrderBook } from "./terminal-order-book";
import { TradingViewPanel } from "./trading-view-panel";

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function readAdminAllowlist() {
  const source = process.env.NEXT_PUBLIC_ADMIN_WALLET_ALLOWLIST ?? "";
  return source
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function asHexAddress(address: string) {
  return address as `0x${string}`;
}

function ConnectGate() {
  const { login } = usePrivy();

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-10 text-foreground">
      <div className="glass-card noise-mask w-full max-w-lg p-8 md:p-10">
        <div className="flex size-12 items-center justify-center rounded-full bg-white/10 text-lg font-semibold text-white">
          B
        </div>

        <h1 className="mt-6 text-4xl font-semibold tracking-[-0.04em] text-white md:text-5xl">
          Sign in to trade.
        </h1>
        <p className="mt-4 text-base leading-7 text-foreground/55">
          Blink creates a non-custodial wallet for you automatically. No seed
          phrase, no extension — just Google.
        </p>

        <Button
          className="mt-8 h-12 w-full rounded-full bg-white text-sm font-semibold text-black hover:bg-white/90"
          onClick={() => login()}
        >
          {/* Google G */}
          <svg className="mr-2.5 size-4" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Continue with Google
        </Button>

        <div className="mt-6 grid grid-cols-3 gap-3">
          {[
            "Non-custodial embedded wallet",
            "No seed phrase needed",
            "Builder approval on first trade",
          ].map((item) => (
            <div key={item} className="rounded-[16px] border border-white/6 bg-white/[0.03] px-3 py-3">
              <p className="text-[11px] leading-5 text-foreground/52">{item}</p>
            </div>
          ))}
        </div>

        <Link
          href="/"
          className="mt-6 block text-center text-xs text-foreground/38 transition hover:text-foreground/65"
        >
          ← Back to landing
        </Link>
      </div>
    </main>
  );
}

function Watchlist(props: {
  market: string;
}) {
  const marketsQuery = useQuery({
    queryKey: ["blink", "watchlist"],
    queryFn: () => fetchTopMarketsByVolume(25),
    staleTime: 86_400_000,
    refetchInterval: 86_400_000,
  });

  return (
    <aside className="glass-panel flex min-h-[calc(100vh-10rem)] w-[280px] flex-col p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="terminal-label">Markets</p>
          <h2 className="mt-2 text-lg font-semibold text-white">Top 25</h2>
        </div>
        <Badge className="rounded-full border border-white/10 bg-white/8 px-2.5 py-1 text-[10px] font-medium text-foreground/60">
          Daily refresh
        </Badge>
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-3 py-2">
        <Search className="size-4 text-foreground/45" />
        <span className="text-sm text-foreground/45">Search markets soon</span>
      </div>

      <div className="mt-4 space-y-2 overflow-y-auto pr-1">
        {(marketsQuery.data ?? []).map((item) => {
          const selected = item.coin === props.market;
          const positive = item.changePct >= 0;

          return (
            <Link
              key={item.coin}
              href={`/app/${marketToSlug(item.coin)}`}
              className={`block rounded-[20px] border px-3 py-3 transition ${
                selected
                  ? "border-white/14 bg-white/[0.08]"
                  : "border-white/0 bg-transparent hover:border-white/8 hover:bg-white/[0.05]"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">{item.coin}</p>
                  <p className="mt-1 text-xs text-foreground/45">
                    {formatUsd(item.markPx)}
                  </p>
                </div>
                <span
                  className={`text-xs ${
                    positive ? "text-emerald-300" : "text-rose-300"
                  }`}
                >
                  {positive ? "+" : ""}
                  {item.changePct.toFixed(2)}%
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}

const LEVERAGE_PRESETS = [1, 2, 5, 10, 20];

function OrderEntryPanel(props: {
  market: string;
  walletAddress: string;
  tradeEnabled: boolean;
}) {
  const { wallets } = useWallets();
  const queryClient = useQueryClient();

  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [orderType, setOrderType] = useState<"limit" | "market">("limit");
  const [price, setPrice] = useState("");
  const [size, setSize] = useState("");
  const [leverage, setLeverage] = useState(10);
  const [updatingLeverage, setUpdatingLeverage] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Live mark price — poll allMids every 3s
  const markQuery = useQuery({
    queryKey: ["blink", "mark", props.market],
    queryFn: async () => {
      const mids = await infoClient.allMids();
      return Number(mids[props.market] ?? 0);
    },
    refetchInterval: 3_000,
    staleTime: 2_000,
  });

  // Share cached account state from AccountPanel (same query key)
  const accountQuery = useQuery({
    queryKey: ["blink", "account", props.walletAddress],
    queryFn: async () => {
      const state = await infoClient.clearinghouseState({
        user: asHexAddress(props.walletAddress),
      });
      return state;
    },
    refetchInterval: 15_000,
    staleTime: 10_000,
    enabled: !!props.walletAddress,
  });

  const markPrice = markQuery.data ?? 0;
  const accountValue = Number(
    accountQuery.data?.marginSummary.accountValue ?? 0,
  );
  const marginUsed = Number(
    accountQuery.data?.marginSummary.totalMarginUsed ?? 0,
  );
  const availableMargin = Math.max(0, accountValue - marginUsed);

  // Estimated notional value
  const sizeNum = Number.parseFloat(size) || 0;
  const priceNum = Number.parseFloat(price) || markPrice;
  const notional = sizeNum * (orderType === "limit" ? priceNum : markPrice);

  const handleLeverageChange = useCallback(
    async (newLeverage: number) => {
      setLeverage(newLeverage);
      const wallet = wallets[0];
      if (!wallet || !props.walletAddress) return;
      setUpdatingLeverage(true);
      try {
        const [exchClient, assetIdx] = await Promise.all([
          createExchangeClient(wallet),
          getAssetIndex(props.market),
        ]);
        await exchClient.updateLeverage({
          asset: assetIdx,
          isCross: true,
          leverage: newLeverage,
        });
      } catch {
        // Non-critical — leverage update failed silently, UI still shows selection
      } finally {
        setUpdatingLeverage(false);
      }
    },
    [wallets, props.market, props.walletAddress],
  );

  const handleSubmit = useCallback(async () => {
    const wallet = wallets[0];
    if (!wallet) return;
    if (!props.tradeEnabled) {
      window.location.href = `/app/setup/builder?market=${marketToSlug(props.market)}`;
      return;
    }

    const sz = Number.parseFloat(size);
    const px = orderType === "limit" ? Number.parseFloat(price) : 0;

    if (!sz || sz <= 0) { toast.error("Enter a valid size"); return; }
    if (orderType === "limit" && (!px || px <= 0)) { toast.error("Enter a valid limit price"); return; }

    setSubmitting(true);
    try {
      const [exchClient, assetIdx] = await Promise.all([
        createExchangeClient(wallet),
        getAssetIndex(props.market),
      ]);

      if (orderType === "limit") {
        await exchClient.order({
          orders: [{ a: assetIdx, b: side === "buy", p: px.toString(), s: sz.toString(), r: false, t: { limit: { tif: "Gtc" } } }],
          grouping: "na",
          builder: { b: BUILDER_ADDRESS, f: BUILDER_FEE_UNITS },
        });
        toast.success(`${side === "buy" ? "Buy" : "Sell"} limit: ${sz} ${props.market} @ ${px}`);
      } else {
        const mid = markPrice || (await infoClient.allMids().then((m) => Number(m[props.market] ?? 0)));
        if (!mid) throw new Error("Could not fetch mark price");
        const slippage = side === "buy" ? mid * 1.05 : mid * 0.95;
        await exchClient.order({
          orders: [{ a: assetIdx, b: side === "buy", p: slippage.toFixed(2), s: sz.toString(), r: false, t: { limit: { tif: "Ioc" } } }],
          grouping: "na",
          builder: { b: BUILDER_ADDRESS, f: BUILDER_FEE_UNITS },
        });
        toast.success(`${side === "buy" ? "Buy" : "Sell"} market: ${sz} ${props.market}`);
      }

      setSize("");
      setPrice("");
      // Refresh account state immediately
      void queryClient.invalidateQueries({ queryKey: ["blink", "account", props.walletAddress] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Order failed");
    } finally {
      setSubmitting(false);
    }
  }, [wallets, side, orderType, price, size, markPrice, props.market, props.tradeEnabled, props.walletAddress, queryClient]);

  return (
    <section className="glass-panel flex h-full flex-col p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="terminal-label">Order entry</p>
          <h2 className="mt-2 text-xl font-semibold text-white">{props.market}</h2>
        </div>
        <Badge className="rounded-full border border-white/10 bg-white/8 px-2.5 py-1 text-[10px] font-medium text-foreground/60">
          Live routing
        </Badge>
      </div>

      {/* Available margin */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-[16px] border border-white/6 bg-white/[0.03] px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.14em] text-foreground/35">Available</p>
          <p className="mt-0.5 font-mono text-sm font-medium text-white">
            {accountValue > 0 ? formatUsd(availableMargin) : "—"}
          </p>
        </div>
        <div className="rounded-[16px] border border-white/6 bg-white/[0.03] px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.14em] text-foreground/35">Mark price</p>
          <p className="mt-0.5 font-mono text-sm font-medium text-white">
            {markPrice > 0 ? formatUsd(markPrice) : "—"}
          </p>
        </div>
      </div>

      {/* Buy / Sell toggle */}
      <div className="mt-4 grid grid-cols-2 gap-2 rounded-full border border-white/8 bg-white/[0.04] p-1">
        <button
          type="button"
          onClick={() => setSide("buy")}
          className={`flex items-center justify-center gap-1.5 rounded-full py-2 text-sm font-medium transition ${side === "buy" ? "bg-emerald-400/15 text-emerald-200" : "text-foreground/50 hover:text-foreground/80"}`}
        >
          <ArrowUp className="size-3.5" />
          Buy / Long
        </button>
        <button
          type="button"
          onClick={() => setSide("sell")}
          className={`flex items-center justify-center gap-1.5 rounded-full py-2 text-sm font-medium transition ${side === "sell" ? "bg-rose-400/15 text-rose-200" : "text-foreground/50 hover:text-foreground/80"}`}
        >
          <ArrowDown className="size-3.5" />
          Sell / Short
        </button>
      </div>

      <Tabs value={orderType} onValueChange={(v) => setOrderType(v as "limit" | "market")} className="mt-3 flex flex-1 flex-col">
        <TabsList className="grid h-auto grid-cols-2 rounded-full border border-white/8 bg-white/[0.04] p-1">
          <TabsTrigger value="limit" className="rounded-full">Limit</TabsTrigger>
          <TabsTrigger value="market" className="rounded-full">Market</TabsTrigger>
        </TabsList>

        <TabsContent value="limit" className="mt-3 space-y-3">
          <div className="space-y-1.5">
            <p className="terminal-label">Price (USD)</p>
            <Input type="number" min="0" step="any" placeholder={markPrice > 0 ? markPrice.toFixed(2) : "0.00"} value={price} onChange={(e) => setPrice(e.target.value)} className="h-11 rounded-2xl border-white/8 bg-white/[0.04]" />
          </div>
          <div className="space-y-1.5">
            <p className="terminal-label">Size ({props.market})</p>
            <Input type="number" min="0" step="any" placeholder="0.0000" value={size} onChange={(e) => setSize(e.target.value)} className="h-11 rounded-2xl border-white/8 bg-white/[0.04]" />
          </div>
        </TabsContent>

        <TabsContent value="market" className="mt-3 space-y-3">
          <div className="space-y-1.5">
            <p className="terminal-label">Size ({props.market})</p>
            <Input type="number" min="0" step="any" placeholder="0.0000" value={size} onChange={(e) => setSize(e.target.value)} className="h-11 rounded-2xl border-white/8 bg-white/[0.04]" />
          </div>
          <p className="text-xs text-foreground/40">IOC limit at 5% slippage from mark.</p>
        </TabsContent>
      </Tabs>

      {/* Leverage */}
      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="terminal-label">Leverage</p>
          <span className="font-mono text-xs text-white">{leverage}×{updatingLeverage ? " …" : ""}</span>
        </div>
        <div className="flex gap-1.5">
          {LEVERAGE_PRESETS.map((lv) => (
            <button
              type="button"
              key={lv}
              onClick={() => void handleLeverageChange(lv)}
              className={`flex-1 rounded-full border py-1.5 text-[11px] font-medium transition ${leverage === lv ? "border-white/20 bg-white/10 text-white" : "border-white/6 bg-transparent text-foreground/45 hover:border-white/12 hover:text-foreground/75"}`}
            >
              {lv}×
            </button>
          ))}
        </div>
      </div>

      {/* Notional estimate */}
      {notional > 0 && (
        <div className="mt-2 flex items-center justify-between rounded-[14px] border border-white/6 bg-white/[0.02] px-3 py-2">
          <span className="text-xs text-foreground/40">Notional</span>
          <span className="font-mono text-xs text-foreground/72">{formatUsd(notional)}</span>
        </div>
      )}

      <Button
        onClick={() => void handleSubmit()}
        disabled={submitting}
        className={`mt-4 h-12 w-full rounded-full text-sm font-semibold disabled:opacity-50 ${side === "buy" ? "bg-emerald-400 text-black hover:bg-emerald-300" : "bg-rose-400 text-white hover:bg-rose-300"}`}
      >
        {submitting ? <Loader2 className="size-4 animate-spin" /> : `${side === "buy" ? "Buy / Long" : "Sell / Short"} ${props.market}`}
      </Button>

      <Link href={`/app/setup/builder?market=${marketToSlug(props.market)}`} className="mt-3 block text-center text-xs text-foreground/35 transition hover:text-foreground/60">
        <ShieldCheck className="mr-1 inline size-3" />
        Manage builder approval
      </Link>
    </section>
  );
}

function AccountPanel(props: { walletAddress: string }) {
  const { wallets } = useWallets();
  const queryClient = useQueryClient();
  const [cancellingOid, setCancellingOid] = useState<number | null>(null);

  const accountQuery = useQuery({
    queryKey: ["blink", "account", props.walletAddress],
    queryFn: async () => {
      const [state, openOrders, fills] = await Promise.all([
        infoClient.clearinghouseState({ user: asHexAddress(props.walletAddress) }),
        infoClient.frontendOpenOrders({ user: asHexAddress(props.walletAddress) }),
        infoClient.userFills({ user: asHexAddress(props.walletAddress) }),
      ]);
      return { state, openOrders, fills: fills.slice(0, 20) };
    },
    refetchInterval: 15_000,
  });

  const handleCancel = useCallback(async (coin: string, oid: number) => {
    const wallet = wallets[0];
    if (!wallet) return;
    setCancellingOid(oid);
    try {
      const [exchClient, assetIdx] = await Promise.all([
        createExchangeClient(wallet),
        getAssetIndex(coin),
      ]);
      await exchClient.cancel({ cancels: [{ a: assetIdx, o: oid }] });
      toast.success(`Order #${oid} cancelled`);
      void queryClient.invalidateQueries({ queryKey: ["blink", "account", props.walletAddress] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cancel failed");
    } finally {
      setCancellingOid(null);
    }
  }, [wallets, props.walletAddress, queryClient]);

  const positions = accountQuery.data?.state.assetPositions ?? [];
  const openOrders = accountQuery.data?.openOrders ?? [];
  const recentFills = accountQuery.data?.fills ?? [];
  const accountValue = Number(
    accountQuery.data?.state.marginSummary.accountValue ?? 0,
  );

  return (
    <section className="glass-panel mt-5 flex flex-col p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="terminal-label">Live account</p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            Positions, open orders, and recent history
          </h2>
        </div>
        <Badge className="rounded-full border border-white/10 bg-white/8 px-2.5 py-1 text-[10px] font-medium text-foreground/60">
          Polling every 15s
        </Badge>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div className="rounded-[20px] border border-white/8 bg-white/[0.04] p-4">
          <p className="terminal-label">Account value</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {formatUsd(accountValue)}
          </p>
        </div>
        <div className="rounded-[20px] border border-white/8 bg-white/[0.04] p-4">
          <p className="terminal-label">Open positions</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {positions.length}
          </p>
        </div>
        <div className="rounded-[20px] border border-white/8 bg-white/[0.04] p-4">
          <p className="terminal-label">Open orders</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {openOrders.length}
          </p>
        </div>
        <div className="rounded-[20px] border border-white/8 bg-white/[0.04] p-4">
          <p className="terminal-label">Recent fills</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {recentFills.length}
          </p>
        </div>
      </div>

      <Tabs defaultValue="positions" className="mt-5">
        <TabsList className="grid h-auto grid-cols-3 rounded-full border border-white/8 bg-white/[0.04] p-1 md:w-[420px]">
          <TabsTrigger value="positions" className="rounded-full">
            Positions
          </TabsTrigger>
          <TabsTrigger value="orders" className="rounded-full">
            Open Orders
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-full">
            Recent Fills
          </TabsTrigger>
        </TabsList>

        <TabsContent value="positions" className="mt-4">
          <div className="grid grid-cols-5 gap-3 px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-foreground/38">
            <span>Coin</span>
            <span className="text-right">Size</span>
            <span className="text-right">Entry</span>
            <span className="text-right">Value</span>
            <span className="text-right">Unrealized</span>
          </div>
          <div className="space-y-2">
            {positions.length > 0 ? (
              positions.map(({ position }) => (
                <div
                  key={`${position.coin}-${position.entryPx}`}
                  className="grid grid-cols-5 gap-3 rounded-[18px] border border-white/8 bg-white/[0.03] px-3 py-3 text-sm text-foreground/72"
                >
                  <span className="font-medium text-white">{position.coin}</span>
                  <span className="text-right">{position.szi}</span>
                  <span className="text-right">{position.entryPx}</span>
                  <span className="text-right">
                    {formatUsd(Number(position.positionValue))}
                  </span>
                  <span className="text-right text-white">
                    {formatUsd(Number(position.unrealizedPnl))}
                  </span>
                </div>
              ))
            ) : (
              <div className="rounded-[20px] border border-dashed border-white/8 bg-white/[0.03] px-4 py-8 text-sm text-foreground/48">
                No active positions yet.
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="orders" className="mt-4">
          <div className="grid grid-cols-[1fr_60px_80px_80px_80px_44px] gap-3 px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-foreground/38">
            <span>Coin</span>
            <span className="text-right">Side</span>
            <span className="text-right">Price</span>
            <span className="text-right">Size</span>
            <span className="text-right">Type</span>
            <span />
          </div>
          <div className="space-y-2">
            {openOrders.length > 0 ? (
              openOrders.map((order) => {
                const isCancelling = cancellingOid === order.oid;
                const isBuy = order.side === "B";
                return (
                  <div
                    key={order.oid}
                    className="grid grid-cols-[1fr_60px_80px_80px_80px_44px] gap-3 items-center rounded-[18px] border border-white/8 bg-white/[0.03] px-3 py-3 text-sm text-foreground/72"
                  >
                    <span className="font-medium text-white">{order.coin}</span>
                    <span className={`text-right text-xs font-medium ${isBuy ? "text-emerald-300" : "text-rose-300"}`}>
                      {isBuy ? "Buy" : "Sell"}
                    </span>
                    <span className="text-right font-mono text-xs">{Number(order.limitPx).toLocaleString()}</span>
                    <span className="text-right font-mono text-xs">{order.sz}</span>
                    <span className="text-right text-xs text-foreground/45">{order.orderType}</span>
                    <button
                      type="button"
                      onClick={() => void handleCancel(order.coin, order.oid)}
                      disabled={isCancelling}
                      className="flex items-center justify-center rounded-full border border-white/8 bg-white/[0.03] p-1.5 text-foreground/40 transition hover:border-rose-400/30 hover:bg-rose-400/10 hover:text-rose-300 disabled:opacity-40"
                      title="Cancel order"
                    >
                      {isCancelling ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3" />}
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="rounded-[20px] border border-dashed border-white/8 bg-white/[0.03] px-4 py-8 text-sm text-foreground/48">
                No open orders.
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <div className="grid grid-cols-6 gap-3 px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-foreground/38">
            <span>Coin</span>
            <span className="text-right">Side</span>
            <span className="text-right">Price</span>
            <span className="text-right">Size</span>
            <span className="text-right">Fee</span>
            <span className="text-right">Time</span>
          </div>
          <div className="space-y-2">
            {recentFills.length > 0 ? (
              recentFills.map((fill) => (
                <div
                  key={fill.tid}
                  className="grid grid-cols-6 gap-3 rounded-[18px] border border-white/8 bg-white/[0.03] px-3 py-3 text-sm text-foreground/72"
                >
                  <span className="font-medium text-white">{fill.coin}</span>
                  <span className="text-right">{fill.side}</span>
                  <span className="text-right">{fill.px}</span>
                  <span className="text-right">{fill.sz}</span>
                  <span className="text-right">{fill.fee}</span>
                  <span className="text-right text-foreground/48">
                    {new Date(fill.time).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))
            ) : (
              <div className="rounded-[20px] border border-dashed border-white/8 bg-white/[0.03] px-4 py-8 text-sm text-foreground/48">
                No recent fills.
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}

export function TerminalShell(props: { market: string }) {
  const { ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const { logout } = useLogout();

  const walletAddress = wallets[0]?.address ?? "";
  const allowlist = useMemo(() => readAdminAllowlist(), []);
  const isAdmin = walletAddress
    ? allowlist.includes(walletAddress.toLowerCase())
    : false;
  const approvalQuery = useQuery({
    queryKey: ["blink", "builder-approval", walletAddress],
    queryFn: () => isBuilderApproved(asHexAddress(walletAddress)),
    enabled: Boolean(walletAddress),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
  const tradeEnabled = approvalQuery.data === true;

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="glass-card px-6 py-5 text-sm text-foreground/65">
          Preparing Blink terminal...
        </div>
      </main>
    );
  }

  if (!authenticated || wallets.length === 0) {
    return <ConnectGate />;
  }

  return (
    <main className="min-h-screen bg-background px-5 pb-5 pt-5 text-foreground">
      <div className="mx-auto flex w-full max-w-[1720px] gap-5">
        <Watchlist market={props.market} />

        <div className="min-w-0 flex-1">
          <header className="glass-panel flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-4">
              <div className="flex size-11 items-center justify-center rounded-full bg-white/[0.08] text-sm font-semibold text-white">
                B
              </div>
              <div>
                <p className="terminal-label">Blink / {props.market}</p>
                <h1 className="mt-1 text-xl font-semibold text-white">
                  Calm-pro Hyperliquid workspace
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] px-3 py-2 lg:flex">
                <Search className="size-4 text-foreground/45" />
                <span className="text-sm text-foreground/45">
                  Search in terminal soon
                </span>
              </div>

              <Link
                href="/app/setup/builder"
                className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] px-3 py-2 text-sm text-foreground/72 transition hover:bg-white/[0.06]"
              >
                <ShieldCheck className="size-4" />
                Builder Setup
              </Link>

              {isAdmin ? (
                <Link
                  href="/app/admin"
                  className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] px-3 py-2 text-sm text-foreground/72 transition hover:bg-white/[0.06]"
                >
                  <LayoutDashboard className="size-4" />
                  Admin
                </Link>
              ) : null}

              <div className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] px-3 py-2 text-sm text-foreground/72">
                <Wallet className="size-4" />
                {truncateAddress(walletAddress)}
              </div>

              <Button
                variant="ghost"
                className="rounded-full text-foreground/55 hover:bg-white/[0.05] hover:text-white"
                onClick={() => void logout()}
              >
                <LogOut className="size-4" />
              </Button>
            </div>
          </header>

          <MarketInfoBar market={props.market} />
          {!tradeEnabled ? (
            <div className="mt-4 rounded-[20px] border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
              One-time setup required to route trades on Hyperliquid.
            </div>
          ) : null}

          <div className="mt-4 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px_360px]">
            <TradingViewPanel market={props.market} />
            <TerminalOrderBook market={props.market} />
            <OrderEntryPanel
              market={props.market}
              walletAddress={walletAddress}
              tradeEnabled={tradeEnabled}
            />
          </div>

          <AccountPanel walletAddress={walletAddress} />

          <footer className="mt-4 flex items-center justify-between px-2 text-xs text-foreground/38">
            <div className="flex items-center gap-4">
              <span>{user?.wallet?.address ? "Wallet connected" : "Connected"}</span>
              <span>{formatCompactNumber(wallets.length)} linked wallet session</span>
            </div>
            <div className="flex items-center gap-4">
              <span>Desktop-first v1</span>
              <span>Google + embedded wallet</span>
              <span>Market + limit orders first</span>
            </div>
          </footer>
        </div>

        <nav className="glass-panel hidden w-[92px] flex-col items-center gap-3 p-3 xl:flex">
          {[
            { icon: Star, label: "Core" },
            { icon: Settings2, label: "Setup" },
          ].map((item) => (
            <div
              key={item.label}
              className="flex w-full flex-col items-center rounded-[22px] border border-white/8 bg-white/[0.04] px-2 py-3 text-center"
            >
              <item.icon className="size-4 text-white" />
              <span className="mt-2 text-[11px] text-foreground/48">
                {item.label}
              </span>
            </div>
          ))}
        </nav>
      </div>
    </main>
  );
}
