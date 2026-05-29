"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowUpRight,
  Loader2,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@acme/ui/button";
import { Input } from "@acme/ui/input";

import { BUILDER_FEE_UNITS, isBlinkTradingEnabled } from "~/lib/blink/builder";
import {
  GROWTH_ZERO_FEE_MARKETS,
  isGrowthModeEnabled,
} from "~/lib/blink/growth-mode";
import { resolvePerpMarket } from "~/lib/blink/hyperliquid";
import { emitTradingEvent } from "~/lib/blink/island-bus";
import {
  formatCompactNumber,
  formatUsd,
  marketToSlug,
} from "~/lib/blink/markets";
import { parseIntentLimitPrice } from "~/lib/blink/parse-intent-limit-price";
import {
  placePerpLimitOrder,
  placePerpMarketOrder,
} from "~/lib/blink/place-perp-order";
import { runWalletConnect } from "~/lib/blink/wallet-connect";

import { AssetIcon } from "./asset-icon";
import { BuilderSetupModal } from "./builder-setup-modal";
import { IntentMiniChart } from "./intent-mini-chart";
import { TradingIsland } from "./trading-island";

const SIZE_PRESETS_USD = [25, 50, 100, 250] as const;
const INTENT_SIZE_KEY = "blink:intent:size-usd";
const DEFAULT_SIZE_USD = 100;

function asHexAddress(address: string) {
  return address as `0x${string}`;
}

function displaySymbol(market: string) {
  if (!market.includes(":")) return market;
  return market.split(":").at(-1) ?? market;
}

function changePct(markPx: number, prevDayPx: number) {
  if (prevDayPx <= 0) return 0;
  return ((markPx - prevDayPx) / prevDayPx) * 100;
}

export function IntentTradePage(props: {
  market: string;
  mode: "market" | "limit";
  /** Raw `price` query for limit intents (`mid`, `70000`, etc.) */
  priceParam?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { ready, authenticated, login, linkWallet } = usePrivy();
  const { wallets } = useWallets();

  const walletAddress = wallets[0]?.address ?? "";
  const sideParam = searchParams.get("side");
  const initialSide =
    sideParam === "sell" || sideParam === "short" ? "sell" : "buy";

  const [side, setSide] = useState<"buy" | "sell">(initialSide);
  const [sizeUsd, setSizeUsd] = useState(() => {
    const fromQuery = searchParams.get("size");
    if (fromQuery) {
      const n = Number.parseFloat(fromQuery);
      if (Number.isFinite(n) && n > 0) return String(n);
    }
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(INTENT_SIZE_KEY);
      if (stored) return stored;
    }
    return String(DEFAULT_SIZE_USD);
  });
  const [submitting, setSubmitting] = useState(false);
  const [fillGlow, setFillGlow] = useState(false);
  const [builderModalOpen, setBuilderModalOpen] = useState(false);
  const [tradeEnabled, setTradeEnabled] = useState(false);
  const referralClaimedRef = useRef(false);

  const marketQuery = useQuery({
    queryKey: ["blink", "market", props.market],
    queryFn: () => resolvePerpMarket(props.market),
    refetchInterval: 3_000,
    staleTime: 2_000,
  });

  const markPrice = marketQuery.data?.midPrice ?? 0;
  const prevDayPx = Number(marketQuery.data?.assetCtx?.prevDayPx ?? 0);
  const pct24h = changePct(markPrice, prevDayPx);
  const universeEntry =
    marketQuery.data?.meta.universe[marketQuery.data.localIndex];
  const szDecimals = Math.max(0, universeEntry?.szDecimals ?? 4);
  const minSizeCoin = 10 ** -szDecimals;

  const limitPrice = useMemo(
    () => parseIntentLimitPrice(props.priceParam, markPrice),
    [props.priceParam, markPrice],
  );

  const usdAmount = Number.parseFloat(sizeUsd) || 0;
  const coinSize = markPrice > 0 && usdAmount > 0 ? usdAmount / markPrice : 0;
  const isZeroFee =
    isGrowthModeEnabled() && GROWTH_ZERO_FEE_MARKETS.includes(props.market);

  useEffect(() => {
    if (!walletAddress) {
      setTradeEnabled(false);
      return;
    }
    let cancelled = false;
    void isBlinkTradingEnabled(asHexAddress(walletAddress)).then((ok) => {
      if (!cancelled) setTradeEnabled(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [walletAddress]);

  useEffect(() => {
    if (!walletAddress || referralClaimedRef.current) return;
    const refCode = document.cookie
      .split("; ")
      .find((row) => row.startsWith("blink_ref="))
      ?.split("=")[1];
    if (!refCode) return;
    referralClaimedRef.current = true;
    fetch("/api/referrals/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ referredAddress: walletAddress, code: refCode }),
    })
      .then(() => {
        document.cookie = "blink_ref=; Max-Age=0; path=/";
      })
      .catch(() => {
        referralClaimedRef.current = false;
      });
  }, [walletAddress]);

  const persistSize = useCallback((value: string) => {
    if (typeof window !== "undefined" && value) {
      window.localStorage.setItem(INTENT_SIZE_KEY, value);
    }
  }, []);

  const handleConnect = useCallback(async () => {
    await runWalletConnect(
      { authenticated, login, linkWallet },
      { source: "intent-page" },
    );
  }, [authenticated, linkWallet, login]);

  const handleSubmit = useCallback(async () => {
    if (!walletAddress) {
      await handleConnect();
      return;
    }
    if (!tradeEnabled) {
      setBuilderModalOpen(true);
      return;
    }
    if (!usdAmount || usdAmount <= 0) {
      toast.error("Enter a valid size in USD");
      return;
    }
    if (coinSize < minSizeCoin) {
      toast.error(
        `Minimum size is ~${formatUsd(minSizeCoin * markPrice)} for ${displaySymbol(props.market)}`,
      );
      return;
    }
    if (props.mode === "limit" && (!limitPrice || limitPrice <= 0)) {
      toast.error("Invalid limit price");
      return;
    }

    setSubmitting(true);
    emitTradingEvent({
      type: "loading",
      message: `${props.mode === "market" ? "Market" : "Limit"} ${side} ${props.market}`,
      id: "intent-order",
    });

    try {
      if (props.mode === "market") {
        const result = await placePerpMarketOrder({
          walletAddress: asHexAddress(walletAddress),
          market: props.market,
          side,
          sizeCoin: coinSize,
          builderFeeUnits: BUILDER_FEE_UNITS,
        });
        setFillGlow(true);
        setTimeout(() => setFillGlow(false), 2000);
        toast.success("Position opened", {
          description: `${side === "buy" ? "Long" : "Short"} ${result.sizeStr} ${displaySymbol(props.market)}`,
        });
        emitTradingEvent({
          type: "success",
          id: "intent-order",
          message: "Market order filled",
          detail: `${side} ${result.sizeStr}`,
        });
      } else {
        const result = await placePerpLimitOrder({
          walletAddress: asHexAddress(walletAddress),
          market: props.market,
          side,
          sizeCoin: coinSize,
          limitPrice,
          builderFeeUnits: BUILDER_FEE_UNITS,
        });
        toast.success("Limit order placed", {
          description: `${side === "buy" ? "Buy" : "Sell"} @ $${result.priceStr}`,
        });
        emitTradingEvent({
          type: "order_placed",
          coin: props.market,
          side: side === "buy" ? "Buy" : "Sell",
          price: result.priceStr,
          size: result.sizeStr,
          orderType: "limit",
        });
      }
      persistSize(sizeUsd);
      void queryClient.invalidateQueries({
        queryKey: ["blink", "account", walletAddress],
      });
      router.push(`/trade/${marketToSlug(props.market)}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const lower = msg.toLowerCase();
      if (
        lower.includes("builder fee") ||
        lower.includes("does not exist") ||
        lower.includes("agent")
      ) {
        setBuilderModalOpen(true);
      }
      toast.error(msg || "Order failed");
      emitTradingEvent({
        type: "error",
        id: "intent-order",
        message: msg || "Order failed",
      });
    } finally {
      setSubmitting(false);
    }
  }, [
    walletAddress,
    tradeEnabled,
    usdAmount,
    coinSize,
    minSizeCoin,
    markPrice,
    props.mode,
    props.market,
    side,
    limitPrice,
    handleConnect,
    persistSize,
    sizeUsd,
    queryClient,
    router,
  ]);

  const symbol = displaySymbol(props.market);
  const modeLabel = props.mode === "market" ? "Market" : "Limit";
  const ctaLabel =
    props.mode === "market"
      ? side === "buy"
        ? `Long ${symbol}`
        : `Short ${symbol}`
      : side === "buy"
        ? `Buy ${symbol} @ ${formatUsd(limitPrice)}`
        : `Sell ${symbol} @ ${formatUsd(limitPrice)}`;

  return (
    <main className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-[#060510] px-4 py-10 text-[#f2f4f7]">
      <TradingIsland />

      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 70% at 50% 0%, rgba(44,107,255,0.18), transparent 60%), radial-gradient(ellipse 50% 40% at 80% 90%, rgba(59,225,186,0.08), transparent 55%)",
        }}
      />

      <div className="relative z-10 mb-6 flex w-full max-w-lg items-center justify-between">
        <Link
          href="/"
          className="text-sm font-semibold tracking-[-0.03em] text-white/80 transition hover:text-white"
        >
          blink
        </Link>
        <Link
          href={`/trade/${marketToSlug(props.market)}`}
          className="inline-flex items-center gap-1 text-xs text-white/50 transition hover:text-white/80"
        >
          Full terminal
          <ArrowUpRight className="size-3" />
        </Link>
      </div>

      <div
        className={`relative z-10 w-full max-w-lg transition-[box-shadow] duration-700 ${
          fillGlow
            ? "shadow-[0_0_80px_rgba(59,225,186,0.35)]"
            : "shadow-[0_0_60px_rgba(44,107,255,0.12)]"
        }`}
      >
        <div
          className="rounded-3xl border border-white/[0.08] bg-[#0a0918]/90 p-6 backdrop-blur-xl sm:p-8"
          style={{
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.06), 0 24px 80px rgba(0,0,0,0.45)",
          }}
        >
          <div className="mb-5 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <AssetIcon asset={props.market} size={48} />
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
                  {modeLabel} intent
                </p>
                <h1 className="text-2xl font-bold tracking-[-0.03em] text-white">
                  {symbol}
                </h1>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold tabular-nums text-white">
                {markPrice > 0 ? formatUsd(markPrice) : "—"}
              </p>
              <p
                className={`flex items-center justify-end gap-0.5 text-sm font-medium tabular-nums ${
                  pct24h >= 0 ? "text-[#3be1ba]" : "text-[#ff6b8a]"
                }`}
              >
                {pct24h >= 0 ? (
                  <TrendingUp className="size-3.5" />
                ) : (
                  <TrendingDown className="size-3.5" />
                )}
                {pct24h >= 0 ? "+" : ""}
                {pct24h.toFixed(2)}%
              </p>
            </div>
          </div>

          {isZeroFee ? (
            <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-[#3be1ba]/25 bg-[#3be1ba]/10 px-3 py-1 text-[11px] font-medium text-[#3be1ba]">
              <Sparkles className="size-3" />
              Zero extra fees on this market
            </div>
          ) : null}

          <IntentMiniChart market={props.market} dailyUp={pct24h >= 0} />

          {props.mode === "limit" ? (
            <p className="mt-3 text-center text-xs text-white/45">
              Limit @{" "}
              <span className="font-medium text-white/80">
                {formatUsd(limitPrice)}
              </span>
              {props.priceParam?.toLowerCase() === "mid" ? " (mid)" : null}
            </p>
          ) : null}

          <div className="mt-6 flex gap-2 rounded-xl bg-white/[0.04] p-1">
            <button
              type="button"
              onClick={() => setSide("buy")}
              className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${
                side === "buy"
                  ? "bg-[#3be1ba]/20 text-[#3be1ba] shadow-[0_0_24px_rgba(59,225,186,0.15)]"
                  : "text-white/45 hover:text-white/70"
              }`}
            >
              Long
            </button>
            <button
              type="button"
              onClick={() => setSide("sell")}
              className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${
                side === "sell"
                  ? "bg-[#ff6b8a]/20 text-[#ff6b8a] shadow-[0_0_24px_rgba(255,107,138,0.15)]"
                  : "text-white/45 hover:text-white/70"
              }`}
            >
              Short
            </button>
          </div>

          <div className="mt-4">
            <label
              htmlFor="intent-size"
              className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.12em] text-white/40"
            >
              Size (USD)
            </label>
            <Input
              id="intent-size"
              inputMode="decimal"
              value={sizeUsd}
              onChange={(e) => setSizeUsd(e.target.value)}
              className="h-12 border-white/10 bg-white/[0.04] text-lg font-medium tabular-nums text-white"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {SIZE_PRESETS_USD.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setSizeUsd(String(preset))}
                  className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/55 transition hover:border-white/25 hover:text-white"
                >
                  ${preset}
                </button>
              ))}
            </div>
            {coinSize > 0 && markPrice > 0 ? (
              <p className="mt-2 text-xs text-white/40">
                ≈ {formatCompactNumber(coinSize)} {symbol} ·{" "}
                {formatUsd(usdAmount)} notional
              </p>
            ) : null}
          </div>

          <Button
            className={`mt-6 h-14 w-full rounded-2xl text-base font-bold tracking-[-0.02em] ${
              side === "buy"
                ? "bg-[#3be1ba] text-[#060510] hover:bg-[#4aecc9]"
                : "bg-[#ff6b8a] text-white hover:bg-[#ff8099]"
            }`}
            disabled={submitting || !ready}
            onClick={() => void handleSubmit()}
          >
            {submitting ? (
              <Loader2 className="size-5 animate-spin" />
            ) : !walletAddress ? (
              "Connect wallet"
            ) : !tradeEnabled ? (
              "Enable trading"
            ) : (
              ctaLabel
            )}
          </Button>

          {!walletAddress && ready ? (
            <p className="mt-3 text-center text-xs text-white/35">
              One tap to connect · self-custody on Hyperliquid
            </p>
          ) : null}
        </div>
      </div>

      <Link
        href={`/trade/${marketToSlug(props.market)}`}
        className="relative z-10 mt-8 inline-flex items-center gap-1 text-sm text-white/40 transition hover:text-white/70"
      >
        <ArrowLeft className="size-3.5" />
        Open advanced chart & order book
      </Link>

      {walletAddress ? (
        <BuilderSetupModal
          open={builderModalOpen}
          walletAddress={walletAddress}
          market={props.market}
          requiredFeeUnits={BUILDER_FEE_UNITS}
          onCloseAction={() => setBuilderModalOpen(false)}
          onApprovedAction={() => {
            setBuilderModalOpen(false);
            setTradeEnabled(true);
          }}
        />
      ) : null}
    </main>
  );
}
