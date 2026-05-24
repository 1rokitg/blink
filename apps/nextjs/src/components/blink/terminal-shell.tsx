"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useLogout, usePrivy, useWallets } from "@privy-io/react-auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  ArrowUp,
  Check,
  CircleDot,
  Disc,
  ExternalLink,
  EyeOff,
  Gift,
  LayoutDashboard,
  Loader2,
  LogOut,
  User,
  UserCog,
  PlayCircle,
  Search,
  Settings2,
  ShieldCheck,
  Star,
  Wallet,
  X,
  Banknote,
  ArrowDownRight,
  Share,
  TicketPercent,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@acme/ui/badge";
import { Button } from "@acme/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@acme/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@acme/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@acme/ui/dropdown-menu";
import { Input } from "@acme/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@acme/ui/tabs";

import {
  BUILDER_ADDRESS,
  builderMaxFeeRate,
  getApprovedBuilderFee,
  isBuilderApproved,
} from "~/lib/blink/builder";
import { getAssetIndex, getAssetIndexSync, infoClient } from "~/lib/blink/hyperliquid";
import { createAgentExchangeClient } from "~/lib/blink/agent-wallet";
import {
  fetchTopMarketsByVolume,
  formatCompactNumber,
  formatUsd,
  marketToSlug,
} from "~/lib/blink/markets";

import { AccountManagementModal } from "./account-management-modal";
import { BuilderSetupModal } from "./builder-setup-modal";
import { MarketInfoBar } from "./market-info-bar";
import { ReferralsModal } from "./referrals-modal";
import { TerminalOrderBook } from "./terminal-order-book";
import { TradingViewPanel } from "./trading-view-panel";
import { AssetIcon } from "./asset-icon";

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

function getHyperliquidPerpPriceDecimals(price: number, szDecimals: number) {
  // Hyperliquid perp constraints:
  // - up to 5 significant figures for price
  // - up to (6 - szDecimals) decimal places
  const finitePrice = Number.isFinite(price) && price > 0 ? price : 1;
  const magnitude = Math.floor(Math.log10(Math.abs(finitePrice)));
  const sigDecimals = Math.max(0, 5 - magnitude - 1);
  const bySizeDecimals = Math.max(0, 6 - Math.max(0, szDecimals));
  return Math.max(0, Math.min(sigDecimals, bySizeDecimals));
}

function roundWithMode(value: number, decimals: number, mode: "up" | "down" | "nearest") {
  if (!Number.isFinite(value) || value <= 0) return "0";
  const factor = 10 ** Math.max(0, decimals);
  const scaled = value * factor;
  const rounded =
    mode === "up"
      ? Math.ceil(scaled)
      : mode === "down"
        ? Math.floor(scaled)
        : Math.round(scaled);
  const normalized = (rounded / factor).toFixed(Math.max(0, decimals));
  return normalized.replace(/\.?0+$/, "");
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
          Blink creates a non-custodial wallet for you automatically. Continue
          with Google, or use wallet login if OAuth is unavailable.
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
          Continue
        </Button>

        <div className="mt-6 grid grid-cols-3 gap-3">
          {[
            "Non-custodial embedded wallet",
            "Google or wallet fallback",
            "Builder approval on first trade",
          ].map((item) => (
            <div
              key={item}
              className="rounded-[16px] border border-white/6 bg-white/[0.03] px-3 py-3"
            >
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

function LeftRail(props: {
  market: string;
}) {
  const marketsQuery = useQuery({
    queryKey: ["blink", "watchlist"],
    queryFn: () => fetchTopMarketsByVolume(25),
    staleTime: 86_400_000,
    refetchInterval: 86_400_000,
  });

  const marketRows = marketsQuery.data ?? [];
  const walletRows = marketRows.slice(0, 8);
  return (
    <aside className="flex min-h-[calc(100vh-7rem)] w-[366px] flex-col gap-2.5">
      <div className="flex h-[68px] items-end px-1 py-1">
        <motion.div
          aria-hidden="true"
          className="text-4xl md:text-5xl"
          initial={{ opacity: 1 }}
          animate={{
            // Slower and clearer blink: open (1) for 1s, closing (0.3) for 0.2s, closed (0) for 0.15s, reopening (0.3) for 0.17s, open (1) for 1s
            opacity: [1, 1, 0.3, 0, 0.3, 1, 1],
          }}
          transition={{
            duration: 1000,
            times: [0, 0.35, 0.45, 0.525, 0.61, 0.7, 1],
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
          }}
        >
          👀
        </motion.div>
      </div>
      <div className="mb-3 h-[68px]" />

      <section className="glass-panel flex min-h-[392px] flex-col overflow-hidden p-0">
        <div className="border-b border-white/10 px-2.5 pb-1.5 pt-1.5">
          <div className="mb-1.5 flex items-center gap-1 text-sm text-foreground/60">
            <span className="rounded-md px-2 py-1">Alerts</span>
            <span className="rounded-md border border-[#41ddb670] bg-[#41ddb626] px-2 py-1 text-white">
              Watchlist
            </span>
            <span className="rounded-md px-2 py-1">Leaderboard</span>
          </div>
          <div className="flex items-center gap-2 rounded-[9px] border border-[#8fc2ff3d] bg-[#111d3cad] px-2.5 py-1.5">
            <Search className="size-3.5 text-foreground/45" />
            <span className="text-xs text-foreground/45">Search perps</span>
          </div>
        </div>

        <div className="flex-1 space-y-1 overflow-y-auto p-1.5">
          {marketRows.map((item) => {
            const selected = item.coin === props.market;
            const positive = item.changePct >= 0;
            return (
              <Link
                key={item.coin}
                href={`/trade/${marketToSlug(item.coin)}`}
                className={`block rounded-[10px] border px-2.5 py-2 transition ${
                  selected
                    ? "border-[#3be1ba9e] bg-[#2dc9ff2b]"
                    : "border-white/0 bg-transparent hover:border-[#89c0ff57] hover:bg-[#89c0ff14]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">
                      {item.coin}
                    </p>
                    <p className="mt-0.5 text-xs text-foreground/45">
                      {formatUsd(item.markPx)}
                    </p>
                  </div>
                  <span
                    className={`text-xs ${positive ? "text-emerald-300" : "text-rose-300"}`}
                  >
                    {positive ? "+" : ""}
                    {item.changePct.toFixed(2)}%
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </aside>
  );
}

const LEVERAGE_PRESETS = [1, 2, 5, 10, 20];

function OrderEntryPanel(props: {
  market: string;
  walletAddress: string;
  builderFeeUnits: number;
  tradeEnabled: boolean;
  onRequireBuilderSetup: () => void;
}) {
  const queryClient = useQueryClient();

  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [orderType, setOrderType] = useState<"limit" | "market">("limit");
  const [price, setPrice] = useState("");
  const [size, setSize] = useState("");
  // "coin" = raw coin units; "usd" = notional USD (divided by mark on submit)
  const [sizeMode, setSizeMode] = useState<"coin" | "usd">("coin");
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
    accountQuery.data?.marginSummary?.accountValue ?? 0,
  );
  const marginUsed = Number(
    accountQuery.data?.marginSummary?.totalMarginUsed ?? 0,
  );
  const availableMargin = Math.max(0, accountValue - marginUsed);

  // ── Size / notional derivation ──────────────────────────────────────
  const rawSizeInput = Number.parseFloat(size) || 0;
  const entryPrice = Number.parseFloat(price) || markPrice;

  // Coin units the order will use (divide by price when in USD mode)
  const coinSize =
    sizeMode === "usd" && entryPrice > 0
      ? rawSizeInput / entryPrice
      : rawSizeInput;

  const notional = coinSize * (orderType === "limit" ? entryPrice : markPrice);
  const standardBuilderFeeUnits = Math.max(
    0,
    Number.parseInt(process.env.NEXT_PUBLIC_BUILDER_FEE_BPS ?? "100", 10) || 100,
  );
  const isProRouting = props.builderFeeUnits < standardBuilderFeeUnits;
  const savingsBps = Math.max(
    0,
    (standardBuilderFeeUnits - props.builderFeeUnits) * 0.0001,
  );
  const savingsUsd = Math.max(0, notional * (savingsBps / 100));

  // Legacy aliases used in handleSubmit
  const sizeNum = coinSize;
  const priceNum = entryPrice;

  // ── Liquidation price (isolated-margin approx, HL MM ≈ 0.5%) ─────────
  const MM_RATE = 0.005;
  const liqPrice =
    coinSize > 0 && entryPrice > 0
      ? side === "buy"
        ? entryPrice * (1 - 1 / leverage + MM_RATE)
        : entryPrice * (1 + 1 / leverage - MM_RATE)
      : null;
  const marginRequired = coinSize > 0 ? notional / leverage : null;

  // ── % size shortcuts ───────────────────────────────────────────────────
  const fillSizePct = useCallback(
    (pct: number) => {
      if (!availableMargin || !entryPrice) return;
      const notionalTarget = availableMargin * leverage * pct;
      if (sizeMode === "usd") {
        setSize(notionalTarget.toFixed(2));
      } else {
        setSize((notionalTarget / entryPrice).toFixed(6));
      }
    },
    [availableMargin, leverage, entryPrice, sizeMode],
  );

  const handleLeverageChange = useCallback(
    async (newLeverage: number) => {
      setLeverage(newLeverage);
      if (!props.walletAddress) return;
      setUpdatingLeverage(true);
      try {
        const [exchClient, assetIdx] = await Promise.all([
          Promise.resolve(
            createAgentExchangeClient(props.walletAddress as `0x${string}`),
          ),
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
    [props.market, props.walletAddress],
  );

  const handleSubmit = useCallback(async () => {
    if (!props.tradeEnabled) {
      props.onRequireBuilderSetup();
      return;
    }
    const liveApprovedFee = await getApprovedBuilderFee(
      asHexAddress(props.walletAddress),
    );
    const liveRequiredFee = props.builderFeeUnits * 0.0001;
    if (liveApprovedFee < liveRequiredFee) {
      toast.error("Builder fee has not been approved.");
      props.onRequireBuilderSetup();
      return;
    }

    const sz = Number.parseFloat(size);
    const px = orderType === "limit" ? Number.parseFloat(price) : 0;

    if (!sz || sz <= 0) {
      toast.error("Enter a valid size");
      return;
    }
    if (orderType === "limit" && (!px || px <= 0)) {
      toast.error("Enter a valid limit price");
      return;
    }

    setSubmitting(true);
    const toastId = toast.loading(
      `${side === "buy" ? "Sending long" : "Sending short"} order…`,
    );
    try {
      const [exchClient, metaAndCtxs, mids] = await Promise.all([
        Promise.resolve(
          createAgentExchangeClient(props.walletAddress as `0x${string}`),
        ),
        infoClient.metaAndAssetCtxs(),
        infoClient.allMids(),
      ]);
      const [meta] = metaAndCtxs;
      const assetIdx = getAssetIndexSync(props.market, meta);
      const universeEntry = meta.universe[assetIdx];
      const sizeDecimals = Math.max(0, universeEntry?.szDecimals ?? 6);
      const marketMidRaw = mids[props.market];
      const priceDecimals = getHyperliquidPerpPriceDecimals(
        Number(marketMidRaw ?? 0),
        sizeDecimals,
      );
      const sizeStr = roundWithMode(sz, sizeDecimals, "down");
      const limitPxStr = roundWithMode(px, priceDecimals, "nearest");

      const placeOrder = async () => {
        if (orderType === "limit") {
          await exchClient.order({
            orders: [
              {
                a: assetIdx,
                b: side === "buy",
                p: limitPxStr,
                s: sizeStr,
                r: false,
                t: { limit: { tif: "Gtc" } },
              },
            ],
            grouping: "na",
            builder: { b: BUILDER_ADDRESS, f: props.builderFeeUnits },
          });
          return;
        }

        const mid = markPrice || Number(marketMidRaw ?? 0);
        if (!mid) throw new Error("Could not fetch mark price");
        const slippage = side === "buy" ? mid * 1.05 : mid * 0.95;
        const marketPxStr =
          side === "buy"
            ? roundWithMode(slippage, priceDecimals, "up")
            : roundWithMode(slippage, priceDecimals, "down");
        await exchClient.order({
          orders: [
            {
              a: assetIdx,
              b: side === "buy",
              p: marketPxStr,
              s: sizeStr,
              r: false,
              t: { limit: { tif: "Ioc" } },
            },
          ],
          grouping: "na",
          builder: { b: BUILDER_ADDRESS, f: props.builderFeeUnits },
        });
      };

      if (orderType === "limit") {
        try {
          await placeOrder();
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.toLowerCase().includes("duplicate nonce")) {
            console.warn("[order] duplicate nonce detected, retrying once", {
              market: props.market,
              side,
              type: orderType,
              size: sz,
            });
            await placeOrder();
          } else {
            throw err;
          }
        }
        toast.success(
          `${side === "buy" ? "Buy" : "Sell"} limit: ${sz} ${props.market} @ ${px}`,
          { id: toastId },
        );
      } else {
        try {
          await placeOrder();
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.toLowerCase().includes("duplicate nonce")) {
            console.warn("[order] duplicate nonce detected, retrying once", {
              market: props.market,
              side,
              type: orderType,
              size: sz,
            });
            await placeOrder();
          } else {
            throw err;
          }
        }
        toast.success(
          `${side === "buy" ? "Buy" : "Sell"} market: ${sz} ${props.market}`,
          { id: toastId },
        );
      }

      setSize("");
      setPrice("");
      // Refresh account state immediately
      void queryClient.invalidateQueries({
        queryKey: ["blink", "account", props.walletAddress],
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Agent key not approved yet — re-trigger setup automatically
      if (msg.toLowerCase().includes("does not exist")) {
        props.onRequireBuilderSetup();
        toast.error("Agent session expired — re-approve to resume trading.", {
          id: toastId,
        });
      } else {
        toast.error(msg || "Order failed", { id: toastId });
      }
    } finally {
      setSubmitting(false);
    }
  }, [
    side,
    orderType,
    price,
    size,
    markPrice,
    props.market,
    props.tradeEnabled,
    props.builderFeeUnits,
    props.onRequireBuilderSetup,
    props.walletAddress,
    queryClient,
  ]);

  return (
    <section className="glass-panel flex h-full flex-col p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="terminal-label">Order entry</p>
          <h2 className="mt-2 flex items-center gap-2 text-xl font-semibold text-white">
            <AssetIcon asset={props.market} className="size-7" />
            {props.market}/USDC
          </h2>
          {isProRouting && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-gradient-to-r from-amber-300/15 to-yellow-300/10 px-2.5 py-1 text-[10px] font-medium text-amber-200">
              <TicketPercent className="size-3" />
              BLINK PRO: Lower builder fee, faster fills.
            </div>
          )}
        </div>
        <Badge className="rounded-full border border-white/10 bg-white/8 px-2.5 py-1 text-[10px] font-medium text-foreground/60">
          Live routing
        </Badge>
      </div>

      {/* Available margin */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-[16px] border border-white/6 bg-white/[0.03] px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.14em] text-foreground/35">
            Available
          </p>
          <p className="mt-0.5 font-mono text-sm font-medium text-white">
            {accountValue > 0 ? formatUsd(availableMargin) : "—"}
          </p>
        </div>
        <div className="rounded-[16px] border border-white/6 bg-white/[0.03] px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.14em] text-foreground/35">
            Mark price
          </p>
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
          {accountValue <= 0 && (
            <span className="ml-2 text-xs text-amber-300">
              <a
                href="/deposit"
                className="underline underline-offset-2 hover:text-amber-400"
                onClick={(e) => {
                  e.stopPropagation();
                  // Could route to deposit page here with router if SPA.
                }}
              >
                Add funds
              </a>
            </span>
          )}
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

      <Tabs
        value={orderType}
        onValueChange={(v) => setOrderType(v as "limit" | "market")}
        className="mt-3 flex flex-1 flex-col"
      >
        <TabsList className="grid h-auto grid-cols-2 rounded-full border border-white/8 bg-white/[0.04] p-1">
          <TabsTrigger value="limit" className="rounded-full">
            Limit
          </TabsTrigger>
          <TabsTrigger value="market" className="rounded-full">
            Market
          </TabsTrigger>
        </TabsList>

        <TabsContent value="limit" className="mt-3 space-y-3">
          <div className="space-y-1.5">
            <p className="terminal-label">Price (USD)</p>
            <Input
              type="number"
              min="0"
              step="any"
              placeholder={markPrice > 0 ? markPrice.toFixed(2) : "0.00"}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="h-11 rounded-2xl border-white/8 bg-white/[0.04]"
            />
          </div>
          {/* Size input — coin or USD mode */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="terminal-label">
                Size ({sizeMode === "usd" ? "USD" : props.market})
              </p>
              <button
                type="button"
                onClick={() => {
                  setSizeMode((m) => (m === "coin" ? "usd" : "coin"));
                  setSize("");
                }}
                className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-foreground/50 transition hover:bg-white/[0.08] hover:text-white"
              >
                {sizeMode === "coin" ? "→ USD" : "→ COIN"}
              </button>
            </div>
            <div className="relative">
              {sizeMode === "usd" && (
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-foreground/45">
                  $
                </span>
              )}
              <Input
                type="number"
                min="0"
                step="any"
                placeholder={sizeMode === "usd" ? "0.00" : "0.0000"}
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className={`h-11 rounded-2xl border-white/8 bg-white/[0.04] ${sizeMode === "usd" ? "pl-7" : ""}`}
              />
            </div>
            {/* Coin ↔ USD conversion hint */}
            {size && entryPrice > 0 && (
              <p className="px-1 text-[11px] text-foreground/38">
                {sizeMode === "usd"
                  ? `≈ ${coinSize.toFixed(6)} ${props.market}`
                  : `≈ ${formatUsd(notional)} notional`}
              </p>
            )}
          </div>

          {/* % quick-fill buttons */}
          {availableMargin > 0 && (
            <div className="flex gap-1.5">
              {([0.25, 0.5, 0.75, 1] as const).map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => fillSizePct(pct)}
                  className="flex-1 rounded-full border border-white/8 bg-white/[0.03] py-1.5 text-[11px] font-medium text-foreground/50 transition hover:border-white/16 hover:bg-white/[0.07] hover:text-white"
                >
                  {pct === 1 ? "Max" : `${pct * 100}%`}
                </button>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="market" className="mt-3 space-y-3">
          {/* Size input — coin or USD mode */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="terminal-label">
                Size ({sizeMode === "usd" ? "USD" : props.market})
              </p>
              <button
                type="button"
                onClick={() => {
                  setSizeMode((m) => (m === "coin" ? "usd" : "coin"));
                  setSize("");
                }}
                className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-foreground/50 transition hover:bg-white/[0.08] hover:text-white"
              >
                {sizeMode === "coin" ? "→ USD" : "→ COIN"}
              </button>
            </div>
            <div className="relative">
              {sizeMode === "usd" && (
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-foreground/45">
                  $
                </span>
              )}
              <Input
                type="number"
                min="0"
                step="any"
                placeholder={sizeMode === "usd" ? "0.00" : "0.0000"}
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className={`h-11 rounded-2xl border-white/8 bg-white/[0.04] ${sizeMode === "usd" ? "pl-7" : ""}`}
              />
            </div>
            {size && entryPrice > 0 && (
              <p className="px-1 text-[11px] text-foreground/38">
                {sizeMode === "usd"
                  ? `≈ ${coinSize.toFixed(6)} ${props.market}`
                  : `≈ ${formatUsd(notional)} notional`}
              </p>
            )}
          </div>

          {/* % quick-fill */}
          {availableMargin > 0 && (
            <div className="flex gap-1.5">
              {([0.25, 0.5, 0.75, 1] as const).map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => fillSizePct(pct)}
                  className="flex-1 rounded-full border border-white/8 bg-white/[0.03] py-1.5 text-[11px] font-medium text-foreground/50 transition hover:border-white/16 hover:bg-white/[0.07] hover:text-white"
                >
                  {pct === 1 ? "Max" : `${pct * 100}%`}
                </button>
              ))}
            </div>
          )}

          <p className="text-xs text-foreground/40">
            IOC limit at 5% slippage from mark.
          </p>
        </TabsContent>
      </Tabs>

      {/* Leverage */}
      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="terminal-label">Leverage</p>
          <span className="font-mono text-xs text-white">
            {leverage}×{updatingLeverage ? " …" : ""}
          </span>
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

      {/* Order summary — notional / margin required / liq price */}
      {coinSize > 0 && (
        <div className="mt-2 divide-y divide-white/[0.05] overflow-hidden rounded-[14px] border border-white/6 bg-white/[0.02]">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-xs text-foreground/40">Notional</span>
            <span className="font-mono text-xs text-foreground/72">
              {formatUsd(notional)}
            </span>
          </div>
          {marginRequired !== null && (
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-xs text-foreground/40">Margin req.</span>
              <span className="font-mono text-xs text-foreground/72">
                {formatUsd(marginRequired)}
              </span>
            </div>
          )}
          {liqPrice !== null && (
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-xs text-foreground/40">
                Est. liq. price
              </span>
              <span
                className={`font-mono text-xs font-medium ${side === "buy" ? "text-rose-300" : "text-emerald-300"}`}
              >
                {formatUsd(liqPrice)}
              </span>
            </div>
          )}
          {isProRouting && savingsUsd > 0 && (
            <div className="flex items-center justify-between bg-amber-300/8 px-3 py-2">
              <span className="text-xs text-amber-100/90">You are saving</span>
              <span className="font-mono text-xs font-semibold text-amber-200">
                {formatUsd(savingsUsd)}
              </span>
            </div>
          )}
        </div>
      )}

      <Button
        onClick={() => void handleSubmit()}
        disabled={submitting}
        className={`mt-4 h-12 w-full rounded-full text-sm font-semibold disabled:opacity-50 ${side === "buy" ? "bg-emerald-400 text-black hover:bg-emerald-300" : "bg-rose-400 text-white hover:bg-rose-300"}`}
      >
        {submitting ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          `${side === "buy" ? "Buy / Long" : "Sell / Short"} ${props.market}`
        )}
      </Button>

      <button
        type="button"
        onClick={props.onRequireBuilderSetup}
        className="mt-3 block w-full text-center text-xs text-foreground/35 transition hover:text-foreground/60"
      >
        <ShieldCheck className="mr-1 inline size-3" />
        Manage builder approval
      </button>
    </section>
  );
}

function AccountPanel(props: { walletAddress: string; builderFeeUnits: number }) {
  const queryClient = useQueryClient();
  const [cancellingOid, setCancellingOid] = useState<number | null>(null);
  const [positionActionKey, setPositionActionKey] = useState<string | null>(
    null,
  );
  const [editingCoin, setEditingCoin] = useState<string | null>(null);
  const [editExitPrice, setEditExitPrice] = useState("");
  const [editExitSize, setEditExitSize] = useState("");

  const accountQuery = useQuery({
    queryKey: ["blink", "account", props.walletAddress],
    queryFn: async () => {
      const [state, openOrders, fills] = await Promise.all([
        infoClient.clearinghouseState({
          user: asHexAddress(props.walletAddress),
        }),
        infoClient.openOrders({
          user: asHexAddress(props.walletAddress),
        }),
        infoClient.userFills({ user: asHexAddress(props.walletAddress) }),
      ]);
      return { state, openOrders, fills: fills.slice(0, 20) };
    },
    enabled: Boolean(props.walletAddress),
    staleTime: 2_000,
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
  });

  const handleCancel = useCallback(
    async (coin: string, oid: number) => {
      setCancellingOid(oid);
      try {
        const [exchClient, assetIdx] = await Promise.all([
          Promise.resolve(
            createAgentExchangeClient(props.walletAddress as `0x${string}`),
          ),
          getAssetIndex(coin),
        ]);
        await exchClient.cancel({ cancels: [{ a: assetIdx, o: oid }] });
        toast.success(`Order #${oid} cancelled`);
        void queryClient.invalidateQueries({
          queryKey: ["blink", "account", props.walletAddress],
        });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Cancel failed");
      } finally {
        setCancellingOid(null);
      }
    },
    [props.walletAddress, queryClient],
  );

  const positions = accountQuery.data?.state?.assetPositions ?? [];
  const openOrders = accountQuery.data?.openOrders ?? [];
  const recentFills = accountQuery.data?.fills ?? [];
  const accountValue = Number(
    accountQuery.data?.state?.marginSummary?.accountValue ?? 0,
  );

  const runPositionOrder = useCallback(
    async (params: {
      coin: string;
      isBuy: boolean;
      size: number;
      reduceOnly: boolean;
      tif: "Gtc" | "Ioc";
      limitPrice?: number;
    }) => {
      const actionToast = toast.loading("Submitting position action…");
      setPositionActionKey(
        `${params.coin}-${params.isBuy ? "buy" : "sell"}-${params.tif}`,
      );
      try {
        const [exchClient, [meta], mids] = await Promise.all([
          Promise.resolve(
            createAgentExchangeClient(props.walletAddress as `0x${string}`),
          ),
          infoClient.metaAndAssetCtxs(),
          infoClient.allMids(),
        ]);
        const assetIdx = getAssetIndexSync(params.coin, meta);
        const szDecimals = Math.max(0, meta.universe[assetIdx]?.szDecimals ?? 6);
        const midRaw = mids[params.coin];
        const mid = Number(midRaw ?? 0);
        const pxDecimals = getHyperliquidPerpPriceDecimals(mid, szDecimals);

        if (!mid && params.tif === "Ioc") {
          throw new Error("Could not fetch mark price for market action");
        }

        const sizeStr = roundWithMode(params.size, szDecimals, "down");
        const resolvedPx =
          params.limitPrice && params.limitPrice > 0
            ? roundWithMode(params.limitPrice, pxDecimals, "nearest")
            : params.tif === "Ioc"
              ? params.isBuy
                ? roundWithMode(mid * 1.02, pxDecimals, "up")
                : roundWithMode(mid * 0.98, pxDecimals, "down")
              : roundWithMode(mid, pxDecimals, "nearest");

        await exchClient.order({
          orders: [
            {
              a: assetIdx,
              b: params.isBuy,
              p: resolvedPx,
              s: sizeStr,
              r: params.reduceOnly,
              t: { limit: { tif: params.tif } },
            },
          ],
          grouping: "na",
          builder: { b: BUILDER_ADDRESS, f: props.builderFeeUnits },
        });

        toast.success("Position action submitted", { id: actionToast });
        await queryClient.invalidateQueries({
          queryKey: ["blink", "account", props.walletAddress],
        });
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Position action failed",
          { id: actionToast },
        );
      } finally {
        setPositionActionKey(null);
      }
    },
    [props.builderFeeUnits, props.walletAddress, queryClient],
  );

  const cancelCoinOrders = useCallback(
    async (coin: string) => {
      const coinOrders = openOrders.filter((order) => order.coin === coin);
      if (coinOrders.length === 0) {
        toast.message(`No open orders for ${coin}`);
        return;
      }
      const toastId = toast.loading(`Cancelling ${coinOrders.length} orders…`);
      setPositionActionKey(`${coin}-cancel`);
      try {
        const [exchClient, assetIdx] = await Promise.all([
          Promise.resolve(
            createAgentExchangeClient(props.walletAddress as `0x${string}`),
          ),
          getAssetIndex(coin),
        ]);
        await exchClient.cancel({
          cancels: coinOrders.map((order) => ({ a: assetIdx, o: order.oid })),
        });
        toast.success(`Cancelled ${coinOrders.length} ${coin} orders`, {
          id: toastId,
        });
        await queryClient.invalidateQueries({
          queryKey: ["blink", "account", props.walletAddress],
        });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Cancel failed", {
          id: toastId,
        });
      } finally {
        setPositionActionKey(null);
      }
    },
    [openOrders, props.walletAddress, queryClient],
  );

  return (
    <section className="glass-panel mt-5 flex flex-col p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="terminal-label mb-1">Summary</p>
          <div className="flex gap-2">
            <div className="flex flex-col items-start">
              <span className="text-[10px] uppercase tracking-[0.14em] text-foreground/30">
                Account value
              </span>
              <span className="font-mono font-semibold text-white text-base mt-1">
                {formatUsd(accountValue)}
              </span>
            </div>
            <div className="flex flex-col items-start">
              <span className="text-[10px] uppercase tracking-[0.14em] text-foreground/30">
                Open positions
              </span>
              <span className="font-mono font-semibold text-white text-base mt-1">
                {positions.length}
              </span>
            </div>
            <div className="flex flex-col items-start">
              <span className="text-[10px] uppercase tracking-[0.14em] text-foreground/30">
                Open orders
              </span>
              <span className="font-mono font-semibold text-white text-base mt-1">
                {openOrders.length}
              </span>
            </div>
            <div className="flex flex-col items-start">
              <span className="text-[10px] uppercase tracking-[0.14em] text-foreground/30">
                Recent fills
              </span>
              <span className="font-mono font-semibold text-white text-base mt-1">
                {recentFills.length}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void accountQuery.refetch()}
            disabled={accountQuery.isFetching}
            className="h-7 rounded-full border-white/10 bg-white/[0.04] px-2.5 text-[10px] text-foreground/70 hover:bg-white/[0.1]"
          >
            {accountQuery.isFetching ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              "Refresh now"
            )}
          </Button>
          <Badge className="rounded-full border border-white/10 bg-white/8 px-2.5 py-1 text-[10px] font-medium text-foreground/60">
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-[10px] text-foreground/55">
                Refreshes every 5s
              </span>
              <span className="text-[11px] text-foreground/65">
                <strong>Open notional:&nbsp;</strong>
                {formatUsd(
                  Number(
                    accountQuery.data?.state?.marginSummary?.totalNtlPos ?? 0,
                  ),
                )}
              </span>
              <span className="text-[11px] text-foreground/65">
                <strong>Margin used:&nbsp;</strong>
                {formatUsd(
                  Number(
                    accountQuery.data?.state?.marginSummary?.totalMarginUsed ?? 0,
                  ),
                )}
              </span>
            </div>
          </Badge>
        </div>
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
          <div className="grid grid-cols-[1fr_60px_72px_72px_80px_80px_260px] gap-2 px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-foreground/38">
            <span>Coin</span>
            <span className="text-right">Side</span>
            <span className="text-right">Entry</span>
            <span className="text-right">Liq.</span>
            <span className="text-right">Value</span>
            <span className="text-right">PnL</span>
            <span className="text-right">Actions</span>
          </div>
          <div className="space-y-2">
            {positions.length > 0 ? (
              positions.map(({ position }) => {
                const sz = Number(position.szi);
                const isLong = sz > 0;
                const absSz = Math.abs(sz);
                const entry = Number(position.entryPx);
                // Same isolated-margin liq formula used in OrderEntryPanel
                const posLiq =
                  entry > 0
                    ? isLong
                      ? entry *
                        (1 - 1 / Number(position.leverage?.value ?? 10) + 0.005)
                      : entry *
                        (1 + 1 / Number(position.leverage?.value ?? 10) - 0.005)
                    : null;
                const pnl = Number(position.unrealizedPnl);
                return (
                  <div
                    key={`${position.coin}-${position.entryPx}`}
                    className="rounded-[18px] border border-white/8 bg-white/[0.03] px-3 py-3 text-sm text-foreground/72"
                  >
                    <div className="grid grid-cols-[1fr_60px_72px_72px_80px_80px_260px] items-center gap-2">
                      <span className="font-medium text-white">
                        {position.coin}
                      </span>
                      <span
                        className={`text-right text-xs font-medium ${isLong ? "text-emerald-300" : "text-rose-300"}`}
                      >
                        {isLong ? "Long" : "Short"}
                      </span>
                      <span className="text-right font-mono text-xs">
                        {position.entryPx}
                      </span>
                      <span className="text-right font-mono text-xs text-rose-300/80">
                        {posLiq ? formatUsd(posLiq) : "—"}
                      </span>
                      <span className="text-right">
                        {formatUsd(Number(position.positionValue))}
                      </span>
                      <span
                        className={`text-right font-medium ${pnl >= 0 ? "text-emerald-300" : "text-rose-300"}`}
                      >
                        {pnl >= 0 ? "+" : ""}
                        {formatUsd(pnl)}
                      </span>
                      <div className="ml-auto flex items-center justify-end gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 rounded-full border-white/10 bg-white/[0.03] px-2.5 text-[11px]"
                          onClick={() => {
                            setEditingCoin(position.coin);
                            setEditExitPrice(position.entryPx);
                            setEditExitSize(absSz.toString());
                          }}
                        >
                          Edit exit
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={positionActionKey === `${position.coin}-cancel`}
                          className="h-7 rounded-full border-white/10 bg-white/[0.03] px-2.5 text-[11px]"
                          onClick={() => void cancelCoinOrders(position.coin)}
                        >
                          Cancel exits
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={
                            positionActionKey ===
                            `${position.coin}-${isLong ? "sell" : "buy"}-Ioc`
                          }
                          className="h-7 rounded-full border-white/10 bg-white/[0.03] px-2.5 text-[11px]"
                          onClick={() =>
                            void runPositionOrder({
                              coin: position.coin,
                              isBuy: !isLong,
                              size: absSz,
                              reduceOnly: true,
                              tif: "Ioc",
                            })
                          }
                        >
                          Close
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={
                            positionActionKey ===
                            `${position.coin}-${isLong ? "sell" : "buy"}-Ioc`
                          }
                          className="h-7 rounded-full bg-emerald-400 px-2.5 text-[11px] font-semibold text-black hover:bg-emerald-300"
                          onClick={() =>
                            void runPositionOrder({
                              coin: position.coin,
                              isBuy: !isLong,
                              size: absSz * 2,
                              reduceOnly: false,
                              tif: "Ioc",
                            })
                          }
                        >
                          Reverse
                        </Button>
                      </div>
                    </div>
                    {editingCoin === position.coin && (
                      <div className="mt-3 grid grid-cols-[1fr_1fr_auto_auto] items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-2">
                        <Input
                          value={editExitPrice}
                          onChange={(event) => setEditExitPrice(event.target.value)}
                          placeholder="Exit price"
                          className="h-8 rounded-lg border-white/10 bg-white/[0.04] text-xs"
                        />
                        <Input
                          value={editExitSize}
                          onChange={(event) => setEditExitSize(event.target.value)}
                          placeholder="Exit size"
                          className="h-8 rounded-lg border-white/10 bg-white/[0.04] text-xs"
                        />
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 rounded-lg bg-[#2c6bff] px-2.5 text-[11px] hover:bg-[#1f5df2]"
                          onClick={() =>
                            void runPositionOrder({
                              coin: position.coin,
                              isBuy: !isLong,
                              size: Number.parseFloat(editExitSize) || 0,
                              limitPrice: Number.parseFloat(editExitPrice) || 0,
                              reduceOnly: true,
                              tif: "Gtc",
                            })
                          }
                        >
                          Save
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 rounded-lg border-white/10 bg-white/[0.03] px-2.5 text-[11px]"
                          onClick={() => setEditingCoin(null)}
                        >
                          Dismiss
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })
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
            <span className="text-right">Orig size</span>
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
                    <span
                      className={`text-right text-xs font-medium ${isBuy ? "text-emerald-300" : "text-rose-300"}`}
                    >
                      {isBuy ? "Buy" : "Sell"}
                    </span>
                    <span className="text-right font-mono text-xs">
                      {Number(order.limitPx).toLocaleString()}
                    </span>
                    <span className="text-right font-mono text-xs">
                      {order.sz}
                    </span>
                    <span className="text-right text-xs text-foreground/45">
                      {order.origSz}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleCancel(order.coin, order.oid)}
                      disabled={isCancelling}
                      className="flex items-center justify-center rounded-full border border-white/8 bg-white/[0.03] p-1.5 text-foreground/40 transition hover:border-rose-400/30 hover:bg-rose-400/10 hover:text-rose-300 disabled:opacity-40"
                      title="Cancel order"
                    >
                      {isCancelling ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <X className="size-3" />
                      )}
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

function TerminalLoader() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(38,92,255,0.22),transparent_48%),radial-gradient(circle_at_70%_75%,rgba(26,204,188,0.16),transparent_42%)] blur-2xl" />
      <div className="relative z-10 flex flex-col items-center text-center">
        <motion.div
          aria-hidden="true"
          className="text-8xl md:text-9xl"
          animate={{
            scale: [1, 1.1, 0.96, 1],
            y: [0, -3, 2, 0],
            opacity: [0.72, 1, 0.82, 1],
          }}
          transition={{
            duration: 1.35,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
          }}
        >
          👀
        </motion.div>
      </div>
    </main>
  );
}

export function TerminalShell(props: { market: string }) {
  const { ready, authenticated, user } = usePrivy();
  const router = useRouter();
  const { wallets } = useWallets();
  const { logout } = useLogout();
  const e2eModeEnabled = process.env.NEXT_PUBLIC_E2E_MODE === "1";
  const [e2eConfig, setE2eConfig] = useState<{
    enabled: boolean;
    approved: boolean;
    walletAddress: string;
  }>({
    enabled: false,
    approved: false,
    walletAddress: "",
  });

  const walletAddress = wallets[0]?.address ?? "";
  const effectiveWalletAddress = e2eConfig.enabled
    ? e2eConfig.walletAddress
    : walletAddress;
  const effectiveReady = e2eConfig.enabled ? true : ready;
  const effectiveAuthenticated = e2eConfig.enabled ? true : authenticated;
  const allowlist = useMemo(() => readAdminAllowlist(), []);
  const isAdmin = effectiveWalletAddress
    ? allowlist.includes(effectiveWalletAddress.toLowerCase())
    : false;
  useEffect(() => {
    if (!e2eModeEnabled || typeof window === "undefined") return;
    const search = new URLSearchParams(window.location.search);
    if (search.get("e2e") !== "1") return;
    setE2eConfig({
      enabled: true,
      approved: search.get("approved") === "1",
      walletAddress:
        search.get("wallet") ?? "0x1111111111111111111111111111111111111111",
    });
  }, [e2eModeEnabled]);
  const approvalQuery = useQuery({
    queryKey: ["blink", "builder-approval", effectiveWalletAddress],
    queryFn: () => isBuilderApproved(asHexAddress(effectiveWalletAddress)),
    enabled: Boolean(effectiveWalletAddress) && !e2eConfig.enabled,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
  const builderFeeQuery = useQuery({
    queryKey: ["blink", "builder-fee", effectiveWalletAddress],
    queryFn: async () => {
      const response = await fetch(
        `/api/builder/fee?wallet=${encodeURIComponent(effectiveWalletAddress)}`,
      );
      if (!response.ok) throw new Error("Failed to resolve builder fee");
      return (await response.json()) as { feeUnits: number; isPro: boolean };
    },
    enabled: Boolean(effectiveWalletAddress),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const resolvedBuilderFeeUnits = builderFeeQuery.data?.feeUnits ?? 100;
  const tradeEnabled = e2eConfig.enabled
    ? e2eConfig.approved
    : approvalQuery.data === true;
  const [builderModalOpen, setBuilderModalOpen] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [referralsModalOpen, setReferralsModalOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [blurBalances, setBlurBalances] = useState(false);
  const [autoPromptDismissed, setAutoPromptDismissed] = useState(false);
  const accountAvatar = `https://avatar.vercel.sh/${effectiveWalletAddress || "blink-user"}.png?size=56`;

  useEffect(() => {
    if (accountModalOpen || referralsModalOpen || builderModalOpen) {
      setProfileMenuOpen(false);
    }
  }, [accountModalOpen, referralsModalOpen, builderModalOpen]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setGlobalSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!effectiveWalletAddress) return;
    if (approvalQuery.isLoading) return;
    if (tradeEnabled) return;
    if (autoPromptDismissed) return;
    setBuilderModalOpen(true);
  }, [
    effectiveWalletAddress,
    approvalQuery.isLoading,
    tradeEnabled,
    autoPromptDismissed,
  ]);

  if (!effectiveReady) {
    return <TerminalLoader />;
  }

  if (!effectiveAuthenticated || (!e2eConfig.enabled && wallets.length === 0)) {
    return <ConnectGate />;
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-background px-3 pb-14 pt-3 text-foreground">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(58,102,255,0.24),transparent_44%),radial-gradient(circle_at_78%_14%,rgba(39,198,181,0.2),transparent_42%),radial-gradient(circle_at_50%_78%,rgba(35,73,168,0.16),transparent_48%)] blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,8,24,0.18)_0%,rgba(2,8,24,0.4)_100%)]" />
      </div>
      <div className="relative z-10 mx-auto flex w-full max-w-[1900px] gap-3">
        <LeftRail market={props.market} />

        <div className="min-w-0 flex-1">
          <div className="mb-3 flex h-[68px] items-center justify-center">
            <button
              type="button"
              onClick={() => setGlobalSearchOpen(true)}
              className="inline-flex h-12 w-full max-w-lg items-center justify-between rounded-[14px] border border-white/10 bg-[#0c101c] px-4 text-sm text-foreground/60 transition hover:border-white/20 hover:text-foreground/80"
            >
              <span className="inline-flex items-center gap-2">
                <Search className="size-4" />
                Search for tokens or traders...
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[11px] text-foreground/50">
                  Paste
                </span>
                <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[11px] text-foreground/50">
                  ESC
                </span>
              </span>
            </button>
          </div>

          <MarketInfoBar
            market={props.market}
            rightSlot={
              <AnimatePresence mode="wait" initial={false}>
                {tradeEnabled ? (
                  <motion.div
                    key="account-cta"
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    transition={{ duration: 0.2 }}
                    className="relative"
                  >
                    <DropdownMenu
                      open={profileMenuOpen}
                      onOpenChange={setProfileMenuOpen}
                    >
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex h-[52px] items-center overflow-hidden rounded-[15px] border border-[#7ea9ff45] bg-[#0f1528f2] text-white shadow-[0_8px_28px_rgba(6,14,35,0.45)] transition hover:border-[#91b8ff73] hover:bg-[#151f38]"
                        >
                          <Link
                            href="/deposit"
                            onClick={() => setProfileMenuOpen(false)}
                            className="flex h-full flex-col justify-center border-r border-white/10 px-3.5 py-1.5 text-left leading-tight"
                          >
                            <span className="text-[14px] font-medium text-foreground/70">
                              100 USDC
                            </span>
                            <span className="text-[14px] font-semibold text-[#7fa8ff]">
                              Deposit more
                            </span>
                          </Link>
                          <span className="flex h-full items-center gap-2.5 px-3 py-1.5">
                            <span className="flex flex-col text-left leading-tight">
                              <span className="text-[15px] font-semibold text-white">
                                $1.61
                              </span>
                              <span className="text-[13px] font-medium text-rose-300">
                                -$0.67 24h
                              </span>
                            </span>
                            <img
                              src={accountAvatar}
                              alt="User avatar"
                              className="size-9 rounded-full border border-white/20"
                            />
                          </span>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        sideOffset={10}
                        className="z-[120] w-[240px] rounded-[14px] border border-white/10 bg-[#0f141fd9] p-1.5 shadow-[0_24px_65px_rgba(0,0,0,0.5)] backdrop-blur-xl"
                      >
                        <DropdownMenuItem
                          asChild
                          className="rounded-[10px] px-3 py-2 text-sm text-white focus:bg-white/[0.08] focus:text-white"
                        >
                          <Link href="/deposit">
                            <Gift className="size-4" />
                            Gift
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          asChild
                          className="rounded-[10px] px-3 py-2 text-sm text-white focus:bg-white/[0.08] focus:text-white"
                        >
                          <Link href="/deposit">
                            <ArrowDownRight className="size-4" />
                            Deposit USDC
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          asChild
                          className="rounded-[10px] px-3 py-2 text-sm text-white focus:bg-white/[0.08] focus:text-white"
                        >
                          <Link
                            href={`/profile/${encodeURIComponent(user?.twitter?.username ?? user?.google?.email?.split("@")[0] ?? user?.email?.address?.split("@")[0] ?? user?.twitter?.username ?? user?.id ?? "me")}`}
                          >
                            <User className="size-4" />
                            Your profile
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="rounded-[10px] px-3 py-2 text-sm text-white focus:bg-white/[0.08] focus:text-white"
                          onClick={() => {
                            setProfileMenuOpen(false);
                            setAccountModalOpen(true);
                          }}
                        >
                          <UserCog className="size-4" />
                          Manage account
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="rounded-[10px] px-3 py-2 text-sm text-white focus:bg-white/[0.08] focus:text-white"
                          onClick={() => setBlurBalances((prev) => !prev)}
                        >
                          <EyeOff className="size-4" />
                          Blur balances
                          <span className="ml-auto">
                            <span
                              className={`block h-2.5 w-2.5 rounded-full ${blurBalances ? "bg-emerald-300" : "bg-white/30"}`}
                            />
                          </span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="rounded-[10px] px-3 py-2 text-sm text-white focus:bg-white/[0.08] focus:text-white"
                          onClick={() => {
                            setProfileMenuOpen(false);
                            setReferralsModalOpen(true);
                          }}
                        >
                          <Gift className="size-4" />
                          Referrals
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="rounded-[10px] px-3 py-2 text-sm text-rose-200 focus:bg-rose-400/10 focus:text-rose-100"
                          onClick={() => logout()}
                        >
                          <LogOut className="size-4" />
                          Log out
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          asChild
                          className="rounded-[10px] px-3 py-2 text-sm text-white focus:bg-white/[0.08] focus:text-white"
                        >
                          <a
                            href="https://home.privy.io"
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ExternalLink className="size-4" />
                            Privy Home
                          </a>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </motion.div>
                ) : (
                  <motion.div
                    key="enable-cta"
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Link
                      href="#"
                      className="whop-blue-btn"
                      onClick={(event) => {
                        event.preventDefault();
                        setBuilderModalOpen(true);
                      }}
                    >
                      <PlayCircle className="size-4" />
                      Enable Trading
                    </Link>
                  </motion.div>
                )}
              </AnimatePresence>
            }
          />
          {!tradeEnabled ? (
            <div className="whop-yellow-banner mt-3">
              One-time setup required to route trades on Hyperliquid.
            </div>
          ) : null}

          <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_300px_340px]">
            {e2eConfig.enabled ? (
              <section className="glass-panel flex h-[520px] items-center justify-center">
                <p className="text-sm text-foreground/50">
                  E2E mode: chart widget disabled
                </p>
              </section>
            ) : (
              <TradingViewPanel market={props.market} />
            )}
            {e2eConfig.enabled ? (
              <section className="glass-panel flex h-[520px] items-center justify-center">
                <p className="text-sm text-foreground/50">
                  E2E mode: order book widget disabled
                </p>
              </section>
            ) : (
              <TerminalOrderBook market={props.market} />
            )}
            <OrderEntryPanel
              market={props.market}
              walletAddress={effectiveWalletAddress}
              builderFeeUnits={resolvedBuilderFeeUnits}
              tradeEnabled={tradeEnabled}
              onRequireBuilderSetup={() => setBuilderModalOpen(true)}
            />
          </div>

          {e2eConfig.enabled ? null : (
            <AccountPanel
              walletAddress={effectiveWalletAddress}
              builderFeeUnits={resolvedBuilderFeeUnits}
            />
          )}

          <footer className="mt-3 flex items-center justify-between px-2 text-xs text-foreground/38">
            <div className="flex items-center gap-4">
              <span>
                {user?.wallet?.address ? "Wallet connected" : "Connected"}
              </span>
              <span>
                {formatCompactNumber(e2eConfig.enabled ? 1 : wallets.length)}{" "}
                linked wallet session
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span>Desktop-first v1</span>
              <span>Google + embedded wallet</span>
              <span>Perps execution first</span>
            </div>
          </footer>
        </div>

        <nav className="glass-panel hidden w-[82px] flex-col items-center gap-2 p-2 xl:flex">
          {[
            { icon: Star, label: "Core" },
            { icon: Settings2, label: "Setup" },
          ].map((item) => (
            <div
              key={item.label}
              className="flex w-full flex-col items-center rounded-[14px] border border-white/8 bg-white/[0.04] px-2 py-3 text-center"
            >
              <item.icon className="size-4 text-white" />
              <span className="mt-2 text-[11px] text-foreground/48">
                {item.label}
              </span>
            </div>
          ))}
        </nav>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#7fb0ff45] bg-[#060e24d6] backdrop-blur-xl">
        <div className="mx-auto flex h-10 w-full max-w-[1900px] items-center justify-between px-3 text-xs">
          <div className="flex items-center gap-4 text-foreground/70">
            <Link
              href="#"
              className="inline-flex items-center gap-1.5 text-foreground/72 transition hover:text-white"
            >
              <Disc className="size-3.5 text-[#6fb3ff]" />
              Watchlist
            </Link>
            <a
              href="https://rokitg.fun"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-[#8fb9ff] transition hover:text-[#c3d7ff]"
            >
              <Star className="size-3.5" />
              rokitg.fun
              <ArrowUpRight className="size-3" />
            </a>
            <Link
              href="https://status.hyperliquid.xyz"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-foreground/72 transition hover:text-white"
            >
              <CircleDot className="size-3.5 text-[#31de9e]" />
              Status
              <ArrowUpRight className="size-3" />
            </Link>
          </div>
          <div className="flex items-center gap-3 text-foreground/55">
            <a
              href="https://x.com/rokitdotgg"
              target="_blank"
              rel="noreferrer"
              className="transition hover:text-white"
            >
              X
            </a>
            <a
              href="https://discord.gg"
              target="_blank"
              rel="noreferrer"
              className="transition hover:text-white"
            >
              Discord
            </a>
            <a
              href="https://t.me"
              target="_blank"
              rel="noreferrer"
              className="transition hover:text-white"
            >
              Telegram
            </a>
          </div>
        </div>
      </div>
      <BuilderSetupModal
        open={builderModalOpen}
        walletAddress={effectiveWalletAddress}
        market={props.market}
        onClose={() => {
          setBuilderModalOpen(false);
          setAutoPromptDismissed(true);
        }}
        onApproved={() => {
          setAutoPromptDismissed(false);
          void approvalQuery.refetch();
        }}
      />
      <AccountManagementModal
        open={accountModalOpen}
        walletAddress={effectiveWalletAddress}
        onClose={() => {
          setAccountModalOpen(false);
          setProfileMenuOpen(false);
        }}
      />
      <ReferralsModal
        open={referralsModalOpen}
        walletAddress={effectiveWalletAddress}
        alias="rokitg"
        onClose={() => {
          setReferralsModalOpen(false);
          setProfileMenuOpen(false);
        }}
      />
      <CommandDialog open={globalSearchOpen} onOpenChange={setGlobalSearchOpen}>
        <CommandInput placeholder="Search markets, traders, wallets..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Markets">
            {["BTC", "ETH", "SOL", "HYPE", "NEAR", "DOGE"].map((coin) => (
              <CommandItem
                key={coin}
                onSelect={() => {
                  window.location.href = `/trade/${coin}`;
                }}
              >
                {coin} Perps
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Actions">
            <CommandItem onSelect={() => setBuilderModalOpen(true)}>
              Open Builder Setup
            </CommandItem>
            <CommandItem onSelect={() => setAccountModalOpen(true)}>
              Open Account Settings
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </main>
  );
}
