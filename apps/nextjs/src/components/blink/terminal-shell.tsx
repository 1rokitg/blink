"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useLogout, usePrivy, useWallets } from "@privy-io/react-auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowDownRight,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Banknote,
  Check,
  CircleDot,
  Compass,
  Disc,
  ExternalLink,
  EyeOff,
  Flame,
  Gift,
  LayoutDashboard,
  Loader2,
  LogOut,
  PlayCircle,
  Search,
  Settings2,
  Share,
  ShieldCheck,
  Sparkles,
  Star,
  TicketPercent,
  TrendingDown,
  TrendingUp,
  User,
  UserCog,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
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

import { createAgentExchangeClient } from "~/lib/blink/agent-wallet";
import {
  BUILDER_ADDRESS,
  BUILDER_FEE_UNITS,
  isBuilderApproved,
} from "~/lib/blink/builder";
import {
  GROWTH_ZERO_FEE_MARKETS,
  isGrowthModeEnabled,
} from "~/lib/blink/growth-mode";
import {
  maskNumberish,
  maskValue,
  useHideBalances,
} from "~/lib/blink/hide-balances";
import {
  getAssetIndex,
  getAssetIndexSync,
  infoClient,
  resolvePerpMarket,
} from "~/lib/blink/hyperliquid";
import {
  CURATED_HIP3_MARKETS,
  type MarketSummary,
  PRIORITY_HIP3_MARKETS,
  fetchTopMarketsByVolume,
  formatCompactNumber,
  formatUsd,
  marketToSlug,
} from "~/lib/blink/markets";

import { emitTradingEvent } from "~/lib/blink/island-bus";
import { AccountManagementModal } from "./account-management-modal";
import { AssetIcon } from "./asset-icon";
import { BlinkProUpsellCard } from "./blink-pro-upsell-card";
import { BuilderSetupModal } from "./builder-setup-modal";
import { MarketInfoBar } from "./market-info-bar";
import { type PnlPositionData, PnlShareModal } from "./pnl-share-modal";
import { ReferralWelcomeBanner } from "./referral-welcome-banner";
import { ReferralsModal } from "./referrals-modal";
import { TerminalOrderBook } from "./terminal-order-book";
import { TradingIsland } from "./trading-island";
import { TradingViewPanel } from "./trading-view-panel";

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getEventIdentityHeaders() {
  if (typeof window === "undefined") return {} as Record<string, string>;
  const visitorKey = "blink:visitor-id";
  const sessionKey = "blink:session-id";
  let visitorId = window.localStorage.getItem(visitorKey);
  let sessionId = window.sessionStorage.getItem(sessionKey);
  if (!visitorId) {
    visitorId = `v1_${crypto.randomUUID().replaceAll("-", "")}`;
    window.localStorage.setItem(visitorKey, visitorId);
  }
  if (!sessionId) {
    sessionId = `s1_${crypto.randomUUID().replaceAll("-", "")}`;
    window.sessionStorage.setItem(sessionKey, sessionId);
  }
  return {
    "x-blink-visitor-id": visitorId,
    "x-blink-session-id": sessionId,
  } as Record<string, string>;
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

function roundWithMode(
  value: number,
  decimals: number,
  mode: "up" | "down" | "nearest",
) {
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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6 py-10 text-foreground">
      {/* Ambient background glows — matches trading terminal */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_30%,rgba(44,107,255,0.22),transparent_48%),radial-gradient(circle_at_75%_20%,rgba(59,225,186,0.16),transparent_44%),radial-gradient(circle_at_50%_80%,rgba(35,73,168,0.14),transparent_50%)] blur-3xl" />
      </div>

      <div className="relative w-full max-w-[420px]">
        {/* Wordmark */}
        <Link href="/" className="mb-8 block">
          <span className="text-4xl font-bold tracking-[-0.04em] text-white">
            blink
          </span>
        </Link>

        {/* Card */}
        <div className="rounded-[24px] border border-white/[0.09] bg-[#080d1aee] p-8 shadow-[0_24px_64px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur-xl">
          {/* Subtle inner glow */}
          <div className="pointer-events-none absolute inset-0 rounded-[24px] bg-[radial-gradient(ellipse_at_top_left,rgba(44,107,255,0.08),transparent_55%)]" />

          <h1 className="text-[2rem] font-semibold leading-tight tracking-[-0.03em] text-white">
            Sign in to trade.
          </h1>
          <p className="mt-3 text-sm leading-6 text-foreground/50">
            Blink creates a non-custodial wallet automatically. Continue with
            Google, or connect an existing wallet.
          </p>

          {/* Divider */}
          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/[0.07]" />
            <span className="text-[11px] text-foreground/35">or</span>
            <div className="h-px flex-1 bg-white/[0.07]" />
          </div>

          {/* Wallet fallback */}
          <button
            type="button"
            onClick={() => login()}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-[14px] border border-white/[0.09] bg-white/[0.04] text-sm font-medium text-white/80 transition hover:border-white/[0.16] hover:bg-white/[0.07] active:scale-[0.98]"
          >
            <Wallet className="size-4 text-white/55" />
            Continue with Google or wallet
          </button>

          {/* Feature pills */}
          <div className="mt-6 grid grid-cols-3 gap-2">
            {[
              { icon: ShieldCheck, label: "Non-custodial" },
              { icon: Wallet, label: "Embedded wallet" },
              { icon: Sparkles, label: "Zero-fee markets" },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-1.5 rounded-[12px] border border-white/[0.06] bg-white/[0.025] px-2 py-3 text-center"
              >
                <Icon className="size-3.5 text-[#3be1ba]/80" />
                <p className="text-[10px] leading-4 text-foreground/45">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Back link */}
        <Link
          href="/"
          className="mt-5 block text-center text-xs text-foreground/35 transition hover:text-foreground/60"
        >
          ← Back to landing
        </Link>
      </div>
    </main>
  );
}

/** Coin logo via CoinCap's free icon CDN, with a colored-initial fallback. */
function CoinIcon({ coin, size = 24 }: { coin: string; size?: number }) {
  const [errored, setErrored] = useState(false);
  const src = `https://assets.coincap.io/assets/icons/${coin.toLowerCase()}@2x.png`;
  // Deterministic pastel hue for the fallback circle
  const hue = [...coin].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;

  if (errored) {
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white/90"
        style={{
          width: size,
          height: size,
          background: `hsl(${hue} 55% 35%)`,
        }}
      >
        {coin.slice(0, 2)}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={coin}
      width={size}
      height={size}
      className="shrink-0 rounded-full"
      onError={() => setErrored(true)}
    />
  );
}

// ── Leaderboard mock data ──────────────────────────────────────────────────
const LEADERBOARD_MOCK = [
  {
    rank: 1,
    name: "rokitg",
    handle: "rokitg.eth",
    pnl: 284_197.43,
    avatar: "https://avatar.vercel.sh/rokitg.eth.png?size=48",
    href: "/profile/rokitg",
  },
] as const;

const RANK_MEDAL: Record<number, { emoji: string; color: string }> = {
  1: { emoji: "🥇", color: "#FFD700" },
  2: { emoji: "🥈", color: "#C0C0C0" },
  3: { emoji: "🥉", color: "#CD7F32" },
};

function LeaderboardPanel() {
  const [period, setPeriod] = useState<"24H" | "7D" | "30D" | "ALL">("24H");
  const periods = ["24H", "7D", "30D", "ALL"] as const;
  return (
    <div className="flex flex-col">
      {/* period filter */}
      <div className="flex items-center gap-1 px-2.5 pb-2 pt-1">
        {periods.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
              period === p
                ? "bg-white/10 text-white"
                : "text-foreground/45 hover:text-white"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* rows */}
      <div className="divide-y divide-white/[0.05]">
        {LEADERBOARD_MOCK.map((trader) => {
          const medal = RANK_MEDAL[trader.rank];
          const isTop = trader.rank <= 3;
          return (
            <Link
              key={trader.rank}
              href={trader.href}
              className="flex items-center gap-3 px-3 py-2.5 transition hover:bg-white/[0.04]"
            >
              {/* rank */}
              <div className="w-6 shrink-0 text-center">
                {medal ? (
                  <span className="text-base leading-none">{medal.emoji}</span>
                ) : (
                  <span className="text-xs text-foreground/35">
                    {trader.rank}
                  </span>
                )}
              </div>

              {/* avatar */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={trader.avatar}
                alt={trader.name}
                width={32}
                height={32}
                className="size-8 shrink-0 rounded-full object-cover ring-1 ring-white/10"
              />

              {/* name + handle */}
              <div className="flex-1 min-w-0">
                <p
                  className={`truncate text-sm font-semibold leading-none ${isTop ? "text-white" : "text-white/85"}`}
                >
                  {trader.name}
                  {trader.rank === 1 && (
                    <span className="ml-1.5 inline-flex items-center rounded-full border border-[#ffd70040] bg-[#ffd70018] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#ffe566]">
                      #1
                    </span>
                  )}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-foreground/40">
                  {trader.handle}
                </p>
              </div>

              {/* pnl */}
              <span className="shrink-0 text-sm font-semibold tabular-nums text-emerald-300">
                +{formatUsd(trader.pnl)}
              </span>
            </Link>
          );
        })}
      </div>

      {/* footer note */}
      <p className="px-3 py-2.5 text-center text-[10px] text-foreground/25">
        Mock data
      </p>
    </div>
  );
}

// ─── Discover Panel ──────────────────────────────────────────────────────────

type MarketRow = MarketSummary;

const DISCOVER_TRADERS = [
  { handle: "rokitg.eth", pnl: 21_420, rank: 1 },
  { handle: "RUNE", pnl: 18_302, rank: 2 },
  { handle: "Marcell", pnl: 12_190, rank: 3 },
  { handle: "X Ventures", pnl: 9_870, rank: 4 },
  { handle: "allheart", pnl: 7_640, rank: 5 },
];

function SidePanelMarketRow(props: {
  item: MarketRow;
  selected?: boolean;
  compact?: boolean;
}) {
  const positive = props.item.changePct >= 0;
  const compact = props.compact ?? false;

  return (
    <Link
      href={`/trade/${marketToSlug(props.item.coin)}`}
      className={`flex items-center gap-2 border transition ${
        compact ? "rounded-[8px] px-2 py-1.5" : "rounded-[10px] px-2.5 py-2"
      } ${
        props.selected
          ? "border-[#3be1ba9e] bg-[#2dc9ff2b]"
          : props.item.isHip3
            ? "border-white/[0.06] bg-white/[0.02] hover:border-[#89c0ff57] hover:bg-[#89c0ff14]"
            : compact
              ? "border-white/0 hover:bg-white/[0.04]"
              : "border-white/0 bg-transparent hover:border-[#89c0ff57] hover:bg-[#89c0ff14]"
      }`}
    >
      <CoinIcon coin={props.item.coin} size={compact ? 22 : 28} />
      <div className="min-w-0 flex-1">
        <p
          className={`flex items-center gap-1.5 font-medium leading-none text-white ${compact ? "text-xs" : "text-sm"}`}
        >
          <span className="truncate">{props.item.coin}</span>
          {props.item.isHip3 ? (
            <span className="rounded-full border border-[#7ea9ff33] bg-[#7ea9ff1a] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#a8c3ff]">
              HIP-3
            </span>
          ) : null}
          {ZERO_FEE_MARKETS.has(props.item.coin) ? (
            <span
              className="size-1.5 shrink-0 rounded-full bg-[#39e5b6]"
              style={{ boxShadow: "0 0 5px 1px #39e5b688" }}
              title="Zero maker fee"
            />
          ) : null}
        </p>
        <p className="mt-0.5 text-xs text-foreground/45">
          {formatUsd(props.item.markPx)}
        </p>
      </div>
      <span
        className={`shrink-0 text-xs tabular-nums ${positive ? "text-emerald-300" : "text-rose-300"}`}
      >
        {positive ? "+" : ""}
        {props.item.changePct.toFixed(2)}%
      </span>
    </Link>
  );
}

function pickMarketsByCoin(
  markets: MarketRow[],
  coins: readonly string[],
): MarketRow[] {
  const marketsByCoin = new Map(markets.map((market) => [market.coin, market]));
  return coins.flatMap((coin) => {
    const market = marketsByCoin.get(coin);
    return market ? [market] : [];
  });
}

function DiscoverPanel({ markets }: { markets: MarketRow[] }) {
  const sorted = [...markets].sort((a, b) => b.changePct - a.changePct);
  const gainers = sorted.slice(0, 4);
  const losers = [...markets]
    .sort((a, b) => a.changePct - b.changePct)
    .slice(0, 4);
  const hip3Markets = [...markets]
    .filter((market) => market.isHip3)
    .sort((left, right) => right.dailyVolume - left.dailyVolume)
    .slice(0, 12);
  const curatedHip3Markets = pickMarketsByCoin(
    hip3Markets,
    CURATED_HIP3_MARKETS,
  );
  const spotlightHip3Markets = hip3Markets
    .filter((market) => !CURATED_HIP3_MARKETS.includes(market.coin))
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-4 p-3">
      {/* ── Trending gainers ───────────────────────────────── */}
      <div>
        <div className="mb-2 flex items-center gap-1.5">
          <TrendingUp className="size-3.5 text-emerald-400" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-400/80">
            Top Gainers
          </span>
        </div>
        <div className="space-y-0.5">
          {gainers.map((market) => (
            <SidePanelMarketRow key={market.coin} item={market} compact />
          ))}
        </div>
      </div>

      <div className="h-px bg-white/[0.06]" />

      {/* ── Top losers ─────────────────────────────────────── */}
      <div>
        <div className="mb-2 flex items-center gap-1.5">
          <TrendingDown className="size-3.5 text-rose-400" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-rose-400/80">
            Top Losers
          </span>
        </div>
        <div className="space-y-0.5">
          {losers.map((market) => (
            <SidePanelMarketRow key={market.coin} item={market} compact />
          ))}
        </div>
      </div>

      {curatedHip3Markets.length > 0 ? (
        <>
          <div className="h-px bg-white/[0.06]" />

          <div>
            <div className="mb-2 flex items-center gap-1.5">
              <Banknote className="size-3.5 text-[#8fbaff]" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8fbaff]/80">
                Semis + Big Tech
              </span>
            </div>
            <div className="space-y-0.5">
              {curatedHip3Markets.map((market) => (
                <SidePanelMarketRow key={market.coin} item={market} compact />
              ))}
            </div>
          </div>
        </>
      ) : null}

      {spotlightHip3Markets.length > 0 ? (
        <>
          <div className="h-px bg-white/[0.06]" />

          <div>
            <div className="mb-2 flex items-center gap-1.5">
              <Banknote className="size-3.5 text-[#8fbaff]" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8fbaff]/80">
                HIP-3 Spotlight
              </span>
            </div>
            <div className="space-y-0.5">
              {spotlightHip3Markets.map((market) => (
                <SidePanelMarketRow key={market.coin} item={market} compact />
              ))}
            </div>
          </div>
        </>
      ) : null}

      <div className="h-px bg-white/[0.06]" />

      {/* ── Zero-fee highlight ─────────────────────────────── */}
      <div>
        <div className="mb-2 flex items-center gap-1.5">
          <Sparkles className="size-3.5 text-teal-400" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-teal-400/80">
            Zero Platform Fee
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[...ZERO_FEE_MARKETS].map((coin) => (
            <Link
              key={coin}
              href={`/trade/${marketToSlug(coin)}`}
              className="inline-flex items-center gap-1 rounded-full border border-teal-400/20 bg-teal-400/[0.07] px-2.5 py-1 text-[11px] font-medium text-teal-300 transition hover:border-teal-400/40 hover:bg-teal-400/[0.12]"
            >
              <span
                className="size-1.5 rounded-full bg-teal-400"
                style={{ boxShadow: "0 0 4px 1px #2dd4bf88" }}
              />
              {coin}
            </Link>
          ))}
        </div>
      </div>

      <div className="h-px bg-white/[0.06]" />

      {/* ── Top traders ────────────────────────────────────── */}
      <div>
        <div className="mb-2 flex items-center gap-1.5">
          <Users className="size-3.5 text-[#7ea9ff]" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7ea9ff]/80">
            Top Traders
          </span>
        </div>
        <div className="space-y-0.5">
          {DISCOVER_TRADERS.map((t) => (
            <div
              key={t.handle}
              className="flex items-center gap-2 rounded-[8px] px-2 py-1.5"
            >
              <span className="w-5 text-center text-sm leading-none">
                {RANK_MEDAL[t.rank]?.emoji ?? `${t.rank}`}
              </span>
              <img
                src={`https://avatar.vercel.sh/${encodeURIComponent(t.handle)}.png?size=48`}
                alt={t.handle}
                className="size-6 rounded-full border border-white/15"
              />
              <Link
                href={`/profile/${encodeURIComponent(t.handle)}`}
                className="flex-1 truncate text-xs font-medium text-white/85 hover:text-white"
              >
                {t.handle}
              </Link>
              <span className="font-mono text-xs font-semibold text-emerald-300">
                +{formatUsd(t.pnl)}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-2 px-2 text-[10px] text-foreground/30">Mock data</p>
      </div>
    </div>
  );
}

function LeftRail(props: {
  market: string;
  tradeEnabled: boolean;
  onRequireBuilderSetup: () => void;
}) {
  // Use the shared ZERO_FEE_MARKETS constant defined at module level
  const [activeTab, setActiveTab] = useState<
    "watchlist" | "leaderboard" | "discover"
  >("watchlist");
  const [searchQuery, setSearchQuery] = useState("");

  const marketsQuery = useQuery({
    queryKey: ["blink", "watchlist"],
    queryFn: () =>
      fetchTopMarketsByVolume(25, {
        includeHip3Offers: true,
        priorityCoins: PRIORITY_HIP3_MARKETS,
      }),
    staleTime: 86_400_000,
    refetchInterval: 86_400_000,
  });

  const allRows = marketsQuery.data ?? [];
  const marketRows = searchQuery.trim()
    ? allRows.filter((m) =>
        m.coin.toLowerCase().includes(searchQuery.trim().toLowerCase()),
      )
    : allRows;
  const coreRows = marketRows.filter((market) => !market.isHip3);
  const hip3Rows = marketRows.filter((market) => market.isHip3);
  const curatedHip3Rows = pickMarketsByCoin(hip3Rows, CURATED_HIP3_MARKETS);
  const otherHip3Rows = hip3Rows.filter(
    (market) => !CURATED_HIP3_MARKETS.includes(market.coin),
  );

  return (
    <aside className="flex min-h-[calc(100vh-7rem)] w-[366px] flex-col gap-2.5">
      <div className="flex h-[68px] items-end gap-2.5 px-1 py-1">
        <motion.div
          aria-hidden="true"
          className="text-4xl md:text-5xl"
          initial={{ opacity: 1 }}
          animate={{
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
        <span className="mb-1 inline-flex items-center rounded-md border border-[#3be1ba30] bg-[#3be1ba0f] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-[#3be1ba80]">
          beta
        </span>
      </div>

      {/* Onboarding CTA for new users */}
      {!props.tradeEnabled && (
        <motion.button
          type="button"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={props.onRequireBuilderSetup}
          className="group relative overflow-hidden rounded-2xl border border-[#3be1ba30] bg-[#0e2a24] px-4 py-3 text-left transition hover:border-[#3be1ba60]"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,#3be1ba12,transparent_60%)]" />
          <div className="relative flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#1b3d32] text-lg">
              ⚡
            </div>
            <div>
              <p className="text-sm font-semibold text-white">
                One-Click Setup
              </p>
              <p className="text-xs text-foreground/50">
                Import your Hyperliquid account — live in seconds
              </p>
            </div>
            <ArrowRight className="ml-auto size-4 text-[#3be1ba] opacity-60 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
          </div>
        </motion.button>
      )}

      <section className="glass-panel flex min-h-[392px] flex-col overflow-hidden p-0">
        <div className="border-b border-white/10 px-2.5 pb-1.5 pt-1.5">
          <div className="mb-1.5 flex items-center gap-1 text-sm">
            <button
              type="button"
              onClick={() => setActiveTab("watchlist")}
              className={`rounded-md px-2 py-1 text-xs transition ${
                activeTab === "watchlist"
                  ? "border border-[#41ddb670] bg-[#41ddb626] text-white"
                  : "text-foreground/50 hover:text-white"
              }`}
            >
              Watchlist
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("leaderboard")}
              className={`rounded-md px-2 py-1 text-xs transition ${
                activeTab === "leaderboard"
                  ? "border border-[#ffd70050] bg-[#ffd70018] text-white"
                  : "text-foreground/50 hover:text-white"
              }`}
            >
              Leaderboard
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("discover")}
              className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition ${
                activeTab === "discover"
                  ? "border border-[#c084fc50] bg-[#c084fc18] text-white"
                  : "text-foreground/50 hover:text-white"
              }`}
            >
              <Compass className="size-3" />
              Discover
              <span className="rounded-full border border-[#c084fc50] bg-[#c084fc20] px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-[#d8b4fe]">
                new
              </span>
            </button>
          </div>

          {/* Search — only show on watchlist */}
          {activeTab === "watchlist" && (
            <label className="flex items-center gap-2 rounded-[9px] border border-[#8fc2ff3d] bg-[#111d3cad] px-2.5 py-1.5 focus-within:border-[#8fc2ff80] focus-within:bg-[#111d3cd0] transition-colors cursor-text">
              <Search className="size-3.5 shrink-0 text-foreground/45" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search perps"
                className="w-full bg-transparent text-xs text-white placeholder:text-foreground/40 outline-none"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="text-foreground/40 hover:text-foreground/70 transition-colors"
                >
                  <X className="size-3" />
                </button>
              ) : null}
            </label>
          )}
        </div>

        {activeTab === "discover" ? (
          <div className="flex-1 overflow-y-auto">
            <DiscoverPanel markets={allRows} />
          </div>
        ) : activeTab === "leaderboard" ? (
          <div className="flex-1 overflow-y-auto">
            <LeaderboardPanel />
          </div>
        ) : (
          <div className="flex-1 space-y-0.5 overflow-y-auto p-1.5">
            {marketRows.length === 0 ? (
              <p className="py-6 text-center text-xs text-foreground/40">
                No markets found
              </p>
            ) : (
              <>
                {coreRows.length > 0 ? (
                  <div className="space-y-0.5">
                    <div className="px-1.5 pb-1 pt-1">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground/30">
                        Core Perps
                      </p>
                    </div>
                    {coreRows.map((item) => (
                      <SidePanelMarketRow
                        key={item.coin}
                        item={item}
                        selected={item.coin === props.market}
                      />
                    ))}
                  </div>
                ) : null}
                {hip3Rows.length > 0 ? (
                  <div className="pt-2">
                    <div className="mb-1 h-px bg-white/[0.06]" />
                    {curatedHip3Rows.length > 0 ? (
                      <div className="space-y-0.5">
                        <div className="px-1.5 pb-1 pt-2">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8fbaff80]">
                            Semis + Big Tech
                          </p>
                        </div>
                        {curatedHip3Rows.map((item) => (
                          <SidePanelMarketRow
                            key={item.coin}
                            item={item}
                            selected={item.coin === props.market}
                          />
                        ))}
                      </div>
                    ) : null}
                    {otherHip3Rows.length > 0 ? (
                      <div className="space-y-0.5 pt-2">
                        <div className="px-1.5 pb-1 pt-2">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8fbaff80]">
                            More HIP-3
                          </p>
                        </div>
                        {otherHip3Rows.map((item) => (
                          <SidePanelMarketRow
                            key={item.coin}
                            item={item}
                            selected={item.coin === props.market}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}
          </div>
        )}
      </section>
    </aside>
  );
}

/**
 * HIP-3 native markets — zero maker fee on Hyperliquid.
 * Blink passes the benefit through: no builder fee on these assets.
 */
const ZERO_FEE_MARKETS = new Set(
  isGrowthModeEnabled() ? GROWTH_ZERO_FEE_MARKETS : [],
);

const LEVERAGE_PRESETS = [1, 2, 5, 10, 20] as const;

const LEVERAGE_RISK: Record<
  (typeof LEVERAGE_PRESETS)[number],
  { activeCls: string; disclaimer: string }
> = {
  1: {
    activeCls:
      "border-emerald-400/50 bg-emerald-400/10 text-emerald-300 shadow-[0_0_8px_rgba(52,211,153,0.15)]",
    disclaimer: "✓ Low leverage — safest for most traders.",
  },
  2: {
    activeCls:
      "border-emerald-400/50 bg-emerald-400/10 text-emerald-300 shadow-[0_0_8px_rgba(52,211,153,0.15)]",
    disclaimer: "✓ Low leverage — safest for most traders.",
  },
  5: {
    activeCls:
      "border-amber-400/50 bg-amber-400/10 text-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.15)]",
    disclaimer: "Moderate risk. Consider 2× or less.",
  },
  10: {
    activeCls:
      "border-orange-400/50 bg-orange-400/10 text-orange-300 shadow-[0_0_8px_rgba(251,146,60,0.15)]",
    disclaimer: "⚠ High leverage — liquidation risk is significant.",
  },
  20: {
    activeCls:
      "border-rose-400/50 bg-rose-400/10 text-rose-300 shadow-[0_0_8px_rgba(251,113,133,0.2)]",
    disclaimer: "⚠ Extreme leverage — one move can wipe your position.",
  },
};

/**
 * Optimistic order submit button.
 *
 * Direct click, no hold-to-place friction.
 * The parent submit flow can still render optimistic feedback for market orders.
 */
function OrderSubmitButton({
  onConfirm,
  disabled,
  side,
  market,
  submitting,
  orderResult,
}: {
  onConfirm: () => void;
  disabled?: boolean;
  side: "buy" | "sell";
  market: string;
  submitting: boolean;
  orderResult: "idle" | "success" | "error";
}) {
  const isBuy = side === "buy";

  const glowColor =
    orderResult === "error"
      ? "rgba(248,113,113,0.55)" // rose
      : isBuy
        ? "rgba(52,211,153,0.55)" // emerald
        : "rgba(251,113,133,0.55)"; // rose for sell success

  return (
    <div className="relative mt-4">
      <AnimatePresence>
        {orderResult !== "idle" ? (
          <motion.div
            key={orderResult}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{
              boxShadow: `0 0 0 3px ${glowColor}, 0 0 24px 6px ${glowColor}`,
            }}
          />
        ) : null}
      </AnimatePresence>

      <motion.button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled || submitting) return;
          onConfirm();
        }}
        className={`relative h-12 w-full select-none overflow-hidden rounded-full border text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
          isBuy
            ? "border-emerald-400/30 bg-emerald-400/[0.06] hover:bg-emerald-400/[0.1]"
            : "border-rose-400/30 bg-rose-400/[0.06] hover:bg-rose-400/[0.1]"
        }`}
        whileTap={{ scale: 0.976 }}
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
      >
        <span
          className="relative z-10 flex items-center justify-center font-semibold text-white"
          style={{ textShadow: "0 1px 6px rgba(0,0,0,0.5)" }}
        >
          {`${isBuy ? "Buy / Long" : "Sell / Short"} ${market}`}
        </span>
      </motion.button>
    </div>
  );
}

function OrderEntryPanel(props: {
  market: string;
  walletAddress: string;
  builderFeeUnits: number;
  tradeEnabled: boolean;
  hideBalances: boolean;
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
  const [orderResult, setOrderResult] = useState<"idle" | "success" | "error">(
    "idle",
  );
  const orderResultTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const pulseOrderResult = useCallback((nextResult: "success" | "error") => {
    if (orderResultTimeoutRef.current) {
      clearTimeout(orderResultTimeoutRef.current);
    }
    setOrderResult(nextResult);
    orderResultTimeoutRef.current = setTimeout(() => {
      setOrderResult("idle");
      orderResultTimeoutRef.current = null;
    }, 1600);
  }, []);

  useEffect(() => {
    return () => {
      if (orderResultTimeoutRef.current) {
        clearTimeout(orderResultTimeoutRef.current);
      }
    };
  }, []);

  const marketQuery = useQuery({
    queryKey: ["blink", "market", props.market],
    queryFn: () => resolvePerpMarket(props.market),
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

  const szDecimals = useMemo(() => {
    const asset = marketQuery.data?.meta.universe[marketQuery.data.localIndex];
    return (asset as { szDecimals?: number } | undefined)?.szDecimals ?? 4;
  }, [marketQuery.data]);

  const minSize = useMemo(() => 10 ** -szDecimals, [szDecimals]);

  const markPrice = marketQuery.data?.midPrice ?? 0;
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
    Number.parseInt(process.env.NEXT_PUBLIC_BUILDER_FEE_BPS ?? "100", 10) ||
      100,
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
        const [exchClient, market] = await Promise.all([
          Promise.resolve(
            createAgentExchangeClient(props.walletAddress as `0x${string}`),
          ),
          resolvePerpMarket(props.market),
        ]);
        await exchClient.updateLeverage({
          asset: market.assetId,
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

    const sz = Number.parseFloat(size);
    const px = orderType === "limit" ? Number.parseFloat(price) : 0;

    if (!sz || sz <= 0) {
      toast.error("Enter a valid size");
      return;
    }
    if (sz < minSize) {
      toast.error(`Min order size is ${minSize} ${props.market}`);
      return;
    }
    if (orderType === "limit" && (!px || px <= 0)) {
      toast.error("Enter a valid limit price");
      return;
    }

    setSubmitting(true);
    if (orderType === "limit") {
      emitTradingEvent({
        type: "loading",
        message: `Limit ${side === "buy" ? "long" : "short"} ${props.market} ${sz}`,
        id: "order",
      });
    }
    try {
      const [exchClient, market] = await Promise.all([
        Promise.resolve(
          createAgentExchangeClient(props.walletAddress as `0x${string}`),
        ),
        resolvePerpMarket(props.market),
      ]);
      const assetIdx = market.assetId;
      const universeEntry = market.meta.universe[market.localIndex];
      const sizeDecimals = Math.max(0, universeEntry?.szDecimals ?? 6);
      const priceDecimals = getHyperliquidPerpPriceDecimals(
        market.midPrice,
        sizeDecimals,
      );
      const sizeStr = roundWithMode(sz, sizeDecimals, "down");
      const limitPxStr = roundWithMode(px, priceDecimals, "nearest");
      const optimisticMarketPrice = markPrice || market.midPrice;

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

        const mid = optimisticMarketPrice;
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
        emitTradingEvent({
          type: "order_placed",
          coin: props.market,
          side: side === "buy" ? "Buy" : "Sell",
          price: px.toString(),
          size: sizeStr,
          orderType: "limit",
        });
      } else {
        pulseOrderResult("success");
        emitTradingEvent({
          type: "order_placed",
          coin: props.market,
          side: side === "buy" ? "Buy" : "Sell",
          price: optimisticMarketPrice
            ? optimisticMarketPrice.toString()
            : "market",
          size: sizeStr,
          orderType: "market",
        });
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
      }

      if (orderType === "limit") {
        pulseOrderResult("success");
      }

      // First successful trade marker for funnel analytics
      if (typeof window !== "undefined") {
        const firstTradeKey = `blink:first-trade:${props.walletAddress.toLowerCase()}`;
        if (!window.localStorage.getItem(firstTradeKey)) {
          window.localStorage.setItem(firstTradeKey, "1");
          void fetch("/api/metrics/event", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...getEventIdentityHeaders(),
            },
            body: JSON.stringify({
              eventType: "first_trade",
              walletAddress: props.walletAddress,
              source: "terminal",
              metadata: {
                market: props.market,
                side,
                orderType,
                size: sizeStr,
              },
            }),
          });
        }
      }

      setSize("");
      setPrice("");
      void queryClient.invalidateQueries({
        queryKey: ["blink", "account", props.walletAddress],
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const msgLower = msg.toLowerCase();
      pulseOrderResult("error");
      if (
        msgLower.includes("does not exist") ||
        msgLower.includes("builder fee has not been approved")
      ) {
        props.onRequireBuilderSetup();
        emitTradingEvent({
          type: "error",
          message: msgLower.includes("builder fee")
            ? "Builder fee not approved"
            : "Agent session expired",
          detail: "Complete setup to resume trading",
          id: "order",
        });
      } else {
        emitTradingEvent({
          type: "error",
          message: msg || "Order failed",
          id: "order",
        });
      }
    } finally {
      setSubmitting(false);
    }
  }, [
    side,
    orderType,
    price,
    size,
    minSize,
    markPrice,
    props.market,
    props.tradeEnabled,
    props.builderFeeUnits,
    props.onRequireBuilderSetup,
    props.walletAddress,
    pulseOrderResult,
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
          {ZERO_FEE_MARKETS.has(props.market) ? (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-teal-400/30 bg-gradient-to-r from-teal-400/10 to-emerald-400/8 px-2.5 py-1 text-[10px] font-medium text-teal-300">
              <Sparkles className="size-3" />
              Zero builder fees on {props.market}
            </div>
          ) : isProRouting ? (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-gradient-to-r from-amber-300/15 to-yellow-300/10 px-2.5 py-1 text-[10px] font-medium text-amber-200">
              <TicketPercent className="size-3" />
              BLINK PRO: Lower builder fee, faster fills.
            </div>
          ) : null}
        </div>
        <Badge className="rounded-full border border-white/10 bg-white/8 px-2.5 py-1 text-[10px] font-medium text-foreground/60">
          Live routing
        </Badge>
      </div>

      {/* Available margin */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-[16px]  bg-white/[0.03] px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.14em] text-foreground/35">
            Available
          </p>
          <p className="mt-0.5 font-mono text-sm font-medium text-white">
            {accountValue > 0
              ? maskNumberish(availableMargin, formatUsd, props.hideBalances)
              : "—"}
          </p>
        </div>
        <div className="rounded-[16px] bg-white/[0.03] px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.14em] text-foreground/35">
            Mark price
          </p>
          <p className="mt-0.5 font-mono text-sm font-medium text-white">
            {markPrice > 0
              ? maskNumberish(markPrice, formatUsd, props.hideBalances)
              : "—"}
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
            {/* Coin ↔ USD conversion hint + min size warning */}
            {size && entryPrice > 0 && (
              <p className="px-1 text-[11px] text-foreground/38">
                {sizeMode === "usd"
                  ? `≈ ${coinSize.toFixed(6)} ${props.market}`
                  : `≈ ${maskNumberish(notional, formatUsd, props.hideBalances)} notional`}
              </p>
            )}
            {coinSize > 0 && coinSize < minSize && (
              <p className="px-1 text-[11px] font-medium text-amber-300/80">
                ⚠ Min order: {minSize} {props.market}
              </p>
            )}
          </div>

          {/* % of balance quick-fill */}
          {availableMargin > 0 && (
            <div className="space-y-1.5">
              <p className="terminal-label">Size from balance</p>
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
                  : `≈ ${maskNumberish(notional, formatUsd, props.hideBalances)} notional`}
              </p>
            )}
            {coinSize > 0 && coinSize < minSize && (
              <p className="px-1 text-[11px] font-medium text-amber-300/80">
                ⚠ Min order: {minSize} {props.market}
              </p>
            )}
          </div>

          {/* % of balance quick-fill */}
          {availableMargin > 0 && (
            <div className="space-y-1.5">
              <p className="terminal-label">Size from balance</p>
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
          <div className="flex items-center gap-2">
            {updatingLeverage && (
              <Loader2 className="size-3 animate-spin text-foreground/40" />
            )}
            <span className="font-mono text-xs font-medium text-white">
              {leverage}×
            </span>
          </div>
        </div>

        {/* Risk-coloured presets */}
        <div className="flex gap-1.5">
          {LEVERAGE_PRESETS.map((lv) => {
            const risk = LEVERAGE_RISK[lv];
            const isActive = leverage === lv;
            return (
              <button
                type="button"
                key={lv}
                onClick={() => void handleLeverageChange(lv)}
                className={`flex-1 rounded-full border py-1.5 text-[11px] font-medium transition-all ${
                  isActive
                    ? risk.activeCls
                    : "border-white/6 bg-transparent text-foreground/40 hover:border-white/14 hover:text-foreground/70"
                }`}
              >
                {lv}×
              </button>
            );
          })}
        </div>

        {/* Risk indicator bar */}
        <div className="flex gap-0.5 overflow-hidden rounded-full">
          {LEVERAGE_PRESETS.map((lv) => (
            <div
              key={lv}
              className={`h-[3px] flex-1 rounded-full transition-all ${
                lv <= leverage
                  ? lv <= 2
                    ? "bg-emerald-400/70"
                    : lv === 5
                      ? "bg-amber-400/70"
                      : lv === 10
                        ? "bg-orange-400/70"
                        : "bg-rose-400/80"
                  : "bg-white/8"
              }`}
            />
          ))}
        </div>

        {/* Disclaimer */}
        <p
          className={`text-[10px] transition-colors ${
            leverage <= 2
              ? "text-emerald-400/60"
              : leverage <= 5
                ? "text-amber-400/60"
                : leverage <= 10
                  ? "text-orange-400/70"
                  : "text-rose-400/75"
          }`}
        >
          {LEVERAGE_RISK[leverage as keyof typeof LEVERAGE_RISK]?.disclaimer ??
            "Use leverage carefully."}
        </p>
      </div>

      {/* Order summary — notional / margin required / liq price */}
      {coinSize > 0 && (
        <div className="mt-2 divide-y divide-white/[0.05] overflow-hidden rounded-[14px] border border-white/6 bg-white/[0.02]">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-xs text-foreground/40">Notional</span>
            <span className="font-mono text-xs text-foreground/72">
              {maskNumberish(notional, formatUsd, props.hideBalances)}
            </span>
          </div>
          {marginRequired !== null && (
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-xs text-foreground/40">Margin req.</span>
              <span className="font-mono text-xs text-foreground/72">
                {maskNumberish(marginRequired, formatUsd, props.hideBalances)}
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
                {maskNumberish(liqPrice, formatUsd, props.hideBalances)}
              </span>
            </div>
          )}
          {isProRouting && savingsUsd > 0 && (
            <div className="flex items-center justify-between bg-amber-300/8 px-3 py-2">
              <span className="text-xs text-amber-100/90">You are saving</span>
              <span className="font-mono text-xs font-semibold text-amber-200">
                {maskNumberish(savingsUsd, formatUsd, props.hideBalances)}
              </span>
            </div>
          )}
        </div>
      )}

      <OrderSubmitButton
        onConfirm={() => void handleSubmit()}
        side={side}
        market={props.market}
        submitting={submitting}
        orderResult={orderResult}
      />

      {/* Inline order status feedback
      <AnimatePresence>
        {submitting && (
          <motion.p
            key="order-status"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.18 }}
            className="mt-2 flex items-center justify-center gap-1.5 text-center text-[11px] text-foreground/50"
          >
            <Loader2 className="size-3 animate-spin" />
            Sending {side === "buy" ? "long" : "short"} order…
          </motion.p>
        )}
      </AnimatePresence> */}

      <button
        type="button"
        onClick={props.onRequireBuilderSetup}
        className="mt-2 block w-full text-center text-xs text-foreground/35 transition hover:text-foreground/60"
      >
        <ShieldCheck className="mr-1 inline size-3" />
        Manage Approvals
      </button>
    </section>
  );
}

function AccountPanel(props: {
  walletAddress: string;
  builderFeeUnits: number;
  hideBalances: boolean;
}) {
  const queryClient = useQueryClient();
  const [cancellingOid, setCancellingOid] = useState<number | null>(null);
  const [positionActionKey, setPositionActionKey] = useState<string | null>(
    null,
  );
  const [editingCoin, setEditingCoin] = useState<string | null>(null);
  const [editExitPrice, setEditExitPrice] = useState("");
  const [editExitSize, setEditExitSize] = useState("");
  const [sharePosition, setSharePosition] = useState<PnlPositionData | null>(
    null,
  );

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
      emitTradingEvent({
        type: "loading",
        message: "Cancelling order…",
        id: "cancel",
      });
      try {
        const [exchClient, assetIdx] = await Promise.all([
          Promise.resolve(
            createAgentExchangeClient(props.walletAddress as `0x${string}`),
          ),
          getAssetIndex(coin),
        ]);
        await exchClient.cancel({ cancels: [{ a: assetIdx, o: oid }] });
        emitTradingEvent({ type: "order_cancelled", coin });
        void queryClient.invalidateQueries({
          queryKey: ["blink", "account", props.walletAddress],
        });
      } catch (err) {
        emitTradingEvent({
          type: "error",
          message: err instanceof Error ? err.message : "Cancel failed",
          id: "cancel",
        });
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

  // ── Fill detection — emit island event for each new fill ──────────────────
  const seenFillsRef = useRef<Set<number>>(new Set());
  const isFirstLoadRef = useRef(true);
  useEffect(() => {
    if (!recentFills.length) return;
    // On first load, seed the seen set without emitting
    if (isFirstLoadRef.current) {
      // biome-ignore lint/complexity/noForEach: <explanation>
      recentFills.forEach((f) => seenFillsRef.current.add(f.tid as number));
      isFirstLoadRef.current = false;
      return;
    }
    // biome-ignore lint/complexity/noForEach: <explanation>
    recentFills.forEach((fill) => {
      const tid = fill.tid as number;
      if (seenFillsRef.current.has(tid)) return;
      seenFillsRef.current.add(tid);
      const isBuy = fill.side === "B";
      const fillData = fill as { hash?: string; crossed?: boolean };
      emitTradingEvent({
        type: "fill",
        coin: fill.coin,
        side: isBuy ? "Long" : "Short",
        size: fill.sz,
        price: `$${Number(fill.px).toLocaleString()}`,
        closedPnl: Number(fill.closedPnl ?? 0) || undefined,
        txHash: fillData.hash ?? undefined,
        orderType: fillData.crossed ? "market" : "limit",
      });
    });
  }, [recentFills]);

  const runPositionOrder = useCallback(
    async (params: {
      coin: string;
      isBuy: boolean;
      size: number;
      reduceOnly: boolean;
      tif: "Gtc" | "Ioc";
      limitPrice?: number;
    }) => {
      emitTradingEvent({
        type: "loading",
        message: "Submitting position action…",
        id: "pos-action",
      });
      setPositionActionKey(
        `${params.coin}-${params.isBuy ? "buy" : "sell"}-${params.tif}`,
      );
      try {
        const [exchClient, market] = await Promise.all([
          Promise.resolve(
            createAgentExchangeClient(props.walletAddress as `0x${string}`),
          ),
          resolvePerpMarket(params.coin),
        ]);
        const assetIdx = market.assetId;
        const szDecimals = Math.max(
          0,
          market.meta.universe[market.localIndex]?.szDecimals ?? 6,
        );
        const mid = market.midPrice;
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

        emitTradingEvent({
          type: "success",
          message: "Position action submitted",
          id: "pos-action",
        });
        await queryClient.invalidateQueries({
          queryKey: ["blink", "account", props.walletAddress],
        });
      } catch (err) {
        emitTradingEvent({
          type: "error",
          message:
            err instanceof Error ? err.message : "Position action failed",
          id: "pos-action",
        });
      } finally {
        setPositionActionKey(null);
      }
    },
    [props.builderFeeUnits, props.walletAddress, queryClient],
  );

  const cancelCoinOrders = useCallback(
    async (coin: string) => {
      const coinOrders = openOrders.filter((order) => order.coin === coin);
      if (coinOrders.length === 0) return;
      emitTradingEvent({
        type: "loading",
        message: `Cancelling ${coinOrders.length} ${coin} order${coinOrders.length > 1 ? "s" : ""}…`,
        id: "cancel-all",
      });
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
        emitTradingEvent({
          type: "order_cancelled",
          coin,
          count: coinOrders.length,
        });
        await queryClient.invalidateQueries({
          queryKey: ["blink", "account", props.walletAddress],
        });
      } catch (err) {
        emitTradingEvent({
          type: "error",
          message: err instanceof Error ? err.message : "Cancel failed",
          id: "cancel-all",
        });
      } finally {
        setPositionActionKey(null);
      }
    },
    [openOrders, props.walletAddress, queryClient],
  );

  return (
    <section className="glass-panel mt-4 overflow-hidden p-0">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground/40">
            Summary
          </p>
          {accountValue > 0 && (
            <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 font-mono text-[11px] text-white/70">
              {maskNumberish(accountValue, formatUsd, props.hideBalances)}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => void accountQuery.refetch()}
          disabled={accountQuery.isFetching}
          className="flex size-7 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-foreground/40 transition hover:border-white/20 hover:text-white disabled:opacity-40"
          title="Refresh"
        >
          {accountQuery.isFetching ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <ArrowDown className="size-3 rotate-45" />
          )}
        </button>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────── */}
      <Tabs defaultValue="positions" className="flex flex-col">
        <div className="border-b border-white/[0.06] px-4 pt-2">
          <TabsList className="h-auto gap-0 rounded-none border-none bg-transparent p-0">
            {(
              [
                {
                  value: "positions",
                  label: "Positions",
                  count: positions.filter((p) => Number(p.position.szi) !== 0)
                    .length,
                },
                {
                  value: "orders",
                  label: "Open Orders",
                  count: openOrders.length,
                },
                {
                  value: "history",
                  label: "Recent Fills",
                  count: recentFills.length,
                },
              ] as const
            ).map(({ value, label, count }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="relative rounded-none border-b-2 border-transparent bg-transparent px-4 pb-2 pt-1 text-xs font-medium text-foreground/45 transition hover:text-white data-[state=active]:border-[#3be1ba] data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:shadow-none"
              >
                {label}
                {count > 0 && (
                  <span className="ml-1.5 rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold leading-none text-foreground/55">
                    {count}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* ── Positions ─────────────────────────────────────────────────── */}
        <TabsContent value="positions" className="mt-0 p-3">
          {positions.length > 0 ? (
            <>
              {/* column headers */}
              <div className="mb-1.5 grid grid-cols-[1fr_56px_88px_80px_100px_116px_auto] items-center gap-2 px-3 py-1 text-[10px] uppercase tracking-[0.13em] text-foreground/32">
                <span>Market</span>
                <span className="text-center">Side</span>
                <span className="text-right">Entry</span>
                <span className="text-right">Liq.</span>
                <span className="text-right">Value</span>
                <span className="text-right">Unrealized PnL</span>
                <span />
              </div>
              <div className="space-y-1.5">
                {positions.map(({ position }) => {
                  const sz = Number(position.szi);
                  if (sz === 0) return null;
                  const isLong = sz > 0;
                  const absSz = Math.abs(sz);
                  const entry = Number(position.entryPx);
                  const posValue = Number(position.positionValue);
                  const leverage = Number(position.leverage?.value ?? 1);
                  const posLiq =
                    entry > 0
                      ? isLong
                        ? entry * (1 - 1 / leverage + 0.005)
                        : entry * (1 + 1 / leverage - 0.005)
                      : null;
                  const pnl = Number(position.unrealizedPnl);
                  const pnlPct =
                    posValue > 0 ? (pnl / (posValue / leverage)) * 100 : 0;
                  const accentColor = isLong ? "#3be1ba" : "#f87171";
                  const isActing =
                    positionActionKey ===
                    `${position.coin}-${isLong ? "sell" : "buy"}-Ioc`;

                  return (
                    <div
                      key={`${position.coin}-${position.entryPx}`}
                      className="group overflow-hidden rounded-[14px] border border-white/[0.07] bg-white/[0.025] transition hover:border-white/[0.12] hover:bg-white/[0.04]"
                      style={{ borderLeft: `2px solid ${accentColor}55` }}
                    >
                      <div className="grid grid-cols-[1fr_56px_88px_80px_100px_116px_auto] items-center gap-2 px-3 py-3">
                        {/* market */}
                        <div className="flex items-center gap-2.5">
                          <CoinIcon coin={position.coin} size={24} />
                          <div>
                            <p className="text-sm font-semibold leading-none text-white">
                              {position.coin}
                            </p>
                            <p className="mt-0.5 text-[10px] text-foreground/38">
                              {leverage.toFixed(0)}×
                            </p>
                          </div>
                        </div>
                        {/* side */}
                        <div className="flex justify-center">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                              isLong
                                ? "bg-emerald-400/15 text-emerald-300"
                                : "bg-rose-400/15 text-rose-300"
                            }`}
                          >
                            {isLong ? "Long" : "Short"}
                          </span>
                        </div>
                        {/* entry */}
                        <span className="text-right font-mono text-xs text-foreground/65">
                          {maskNumberish(entry, formatUsd, props.hideBalances)}
                        </span>
                        {/* liq */}
                        <span className="text-right font-mono text-xs text-rose-300/60">
                          {posLiq
                            ? maskNumberish(
                                posLiq,
                                formatUsd,
                                props.hideBalances,
                              )
                            : "—"}
                        </span>
                        {/* value */}
                        <span className="text-right font-mono text-xs text-foreground/75">
                          {maskNumberish(
                            posValue,
                            formatUsd,
                            props.hideBalances,
                          )}
                        </span>
                        {/* pnl */}
                        <div className="flex flex-col items-end">
                          <span
                            className={`font-mono text-sm font-semibold leading-none ${pnl >= 0 ? "text-emerald-300" : "text-rose-300"}`}
                          >
                            {pnl >= 0 ? "+" : ""}
                            {maskNumberish(pnl, formatUsd, props.hideBalances)}
                          </span>
                          <span
                            className={`mt-0.5 text-[10px] ${pnl >= 0 ? "text-emerald-400/60" : "text-rose-400/60"}`}
                          >
                            {pnlPct >= 0 ? "+" : ""}
                            {maskValue(
                              `${pnlPct.toFixed(2)}%`,
                              props.hideBalances,
                            )}
                          </span>
                        </div>
                        {/* actions */}
                        <div className="flex items-center justify-end gap-1">
                          {/* Share PnL */}
                          <button
                            type="button"
                            title="Share PnL"
                            className="flex size-7 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-foreground/40 transition hover:border-white/20 hover:text-white"
                            onClick={() =>
                              setSharePosition({
                                coin: position.coin,
                                side: isLong ? "Long" : "Short",
                                entryPx: entry,
                                markPx: entry + pnl / absSz,
                                pnl,
                                pnlPct,
                                size: absSz,
                                leverage,
                              })
                            }
                          >
                            <Share className="size-3" />
                          </button>
                          {/* Edit exit */}
                          <button
                            type="button"
                            className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] text-foreground/55 transition hover:border-white/20 hover:text-white"
                            onClick={() => {
                              setEditingCoin(
                                editingCoin === position.coin
                                  ? null
                                  : position.coin,
                              );
                              setEditExitPrice(position.entryPx);
                              setEditExitSize(absSz.toString());
                            }}
                          >
                            Edit exit
                          </button>
                          {/* Close */}
                          <button
                            type="button"
                            disabled={isActing}
                            className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] text-foreground/55 transition hover:border-white/20 hover:text-white disabled:opacity-40"
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
                            {isActing ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              "Close"
                            )}
                          </button>
                          {/* Reverse */}
                          <button
                            type="button"
                            disabled={isActing}
                            className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-black transition active:scale-95 disabled:opacity-40"
                            style={{
                              background: isLong ? "#f87171" : "#34d399",
                            }}
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
                          </button>
                        </div>
                      </div>

                      {/* Edit exit inline panel */}
                      <AnimatePresence>
                        {editingCoin === position.coin && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{
                              duration: 0.18,
                              ease: [0.4, 0, 0.2, 1],
                            }}
                            className="overflow-hidden"
                          >
                            <div className="grid grid-cols-[1fr_1fr_auto_auto] items-center gap-2 border-t border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                              <Input
                                value={editExitPrice}
                                onChange={(e) =>
                                  setEditExitPrice(e.target.value)
                                }
                                placeholder="Exit price"
                                className="h-8 rounded-lg border-white/10 bg-white/[0.04] text-xs"
                              />
                              <Input
                                value={editExitSize}
                                onChange={(e) =>
                                  setEditExitSize(e.target.value)
                                }
                                placeholder="Size"
                                className="h-8 rounded-lg border-white/10 bg-white/[0.04] text-xs"
                              />
                              <button
                                type="button"
                                className="h-8 rounded-lg bg-[#2c6bff] px-3 text-[11px] font-medium text-white transition hover:bg-[#1f5df2]"
                                onClick={() =>
                                  void runPositionOrder({
                                    coin: position.coin,
                                    isBuy: !isLong,
                                    size: Number.parseFloat(editExitSize) || 0,
                                    limitPrice:
                                      Number.parseFloat(editExitPrice) || 0,
                                    reduceOnly: true,
                                    tif: "Gtc",
                                  })
                                }
                              >
                                Place exit
                              </button>
                              <button
                                type="button"
                                className="h-8 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-[11px] text-foreground/55 transition hover:text-white"
                                onClick={() => setEditingCoin(null)}
                              >
                                Dismiss
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-[14px] border border-dashed border-white/[0.08] py-12 text-center">
              <p className="text-sm text-foreground/35">No active positions</p>
              <p className="mt-1 text-xs text-foreground/22">
                Open a trade from the order panel
              </p>
            </div>
          )}
        </TabsContent>

        {/* ── Open Orders ──────────────────────────────────────────────── */}
        <TabsContent value="orders" className="mt-0 p-3">
          {openOrders.length > 0 ? (
            <div className="overflow-hidden rounded-[14px] border border-white/[0.07]">
              <div className="grid grid-cols-[1fr_56px_96px_80px_80px_36px] gap-2 border-b border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[10px] uppercase tracking-[0.13em] text-foreground/32">
                <span>Coin</span>
                <span className="text-center">Side</span>
                <span className="text-right">Price</span>
                <span className="text-right">Size</span>
                <span className="text-right">Orig</span>
                <span />
              </div>
              <div className="divide-y divide-white/[0.04]">
                {openOrders.map((order) => {
                  const isCancelling = cancellingOid === order.oid;
                  const isBuy = order.side === "B";
                  return (
                    <div
                      key={order.oid}
                      className="grid grid-cols-[1fr_56px_96px_80px_80px_36px] items-center gap-2 px-3 py-2.5 text-xs transition hover:bg-white/[0.03]"
                      style={{
                        borderLeft: `2px solid ${isBuy ? "#3be1ba44" : "#f8717144"}`,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <CoinIcon coin={order.coin} size={18} />
                        <span className="font-medium text-white">
                          {order.coin}
                        </span>
                      </div>
                      <div className="flex justify-center">
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                            isBuy
                              ? "bg-emerald-400/15 text-emerald-300"
                              : "bg-rose-400/15 text-rose-300"
                          }`}
                        >
                          {isBuy ? "Buy" : "Sell"}
                        </span>
                      </div>
                      <span className="text-right font-mono text-foreground/70">
                        {maskNumberish(
                          Number(order.limitPx),
                          formatUsd,
                          props.hideBalances,
                        )}
                      </span>
                      <span className="text-right font-mono text-foreground/60">
                        {order.sz}
                      </span>
                      <span className="text-right font-mono text-foreground/38">
                        {order.origSz}
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleCancel(order.coin, order.oid)}
                        disabled={isCancelling}
                        className="flex size-6 items-center justify-center rounded-full border border-white/[0.07] bg-white/[0.03] text-foreground/38 transition hover:border-rose-400/30 hover:bg-rose-400/10 hover:text-rose-300 disabled:opacity-40"
                        title="Cancel"
                      >
                        {isCancelling ? (
                          <Loader2 className="size-2.5 animate-spin" />
                        ) : (
                          <X className="size-2.5" />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-[14px] border border-dashed border-white/[0.08] py-12 text-center">
              <p className="text-sm text-foreground/35">No open orders</p>
            </div>
          )}
        </TabsContent>

        {/* ── Recent Fills ─────────────────────────────────────────────── */}
        <TabsContent value="history" className="mt-0 p-3">
          {recentFills.length > 0 ? (
            <div className="overflow-hidden rounded-[14px] border border-white/[0.07]">
              <div className="grid grid-cols-[1fr_52px_96px_80px_72px_60px] gap-2 border-b border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[10px] uppercase tracking-[0.13em] text-foreground/32">
                <span>Market</span>
                <span className="text-center">Side</span>
                <span className="text-right">Price</span>
                <span className="text-right">Size</span>
                <span className="text-right">Fee</span>
                <span className="text-right">Time</span>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {recentFills.map((fill) => {
                  const isBuy = fill.side === "B";
                  const fillTime = new Date(fill.time);
                  const diffMin = Math.floor(
                    (Date.now() - fillTime.getTime()) / 60_000,
                  );
                  const timeLabel =
                    diffMin < 1
                      ? "just now"
                      : diffMin < 60
                        ? `${diffMin}m ago`
                        : fillTime.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          });
                  return (
                    <div
                      key={fill.tid}
                      className="grid grid-cols-[1fr_52px_96px_80px_72px_60px] items-center gap-2 px-3 py-2.5 text-xs transition hover:bg-white/[0.03]"
                    >
                      <div className="flex items-center gap-2">
                        <CoinIcon coin={fill.coin} size={18} />
                        <span className="font-medium text-white">
                          {fill.coin}
                        </span>
                      </div>
                      <div className="flex justify-center">
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                            isBuy
                              ? "bg-emerald-400/15 text-emerald-300"
                              : "bg-rose-400/15 text-rose-300"
                          }`}
                        >
                          {isBuy ? "Buy" : "Sell"}
                        </span>
                      </div>
                      <span className="text-right font-mono text-foreground/70">
                        {maskNumberish(
                          Number(fill.px),
                          formatUsd,
                          props.hideBalances,
                        )}
                      </span>
                      <span className="text-right font-mono text-foreground/58">
                        {fill.sz}
                      </span>
                      <span
                        className={`text-right font-mono ${
                          Number(fill.fee) === 0
                            ? "text-emerald-400/60"
                            : "text-foreground/38"
                        }`}
                      >
                        {Number(fill.fee) !== 0
                          ? `$${Math.abs(Number(fill.fee)).toFixed(4)}`
                          : "free"}
                      </span>
                      <span className="text-right text-foreground/32">
                        {timeLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-[14px] border border-dashed border-white/[0.08] py-12 text-center">
              <p className="text-sm text-foreground/35">No recent fills</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── PnL Share Modal ───────────────────────────────────────────── */}
      {sharePosition && (
        <PnlShareModal
          type="position"
          open={!!sharePosition}
          onClose={() => setSharePosition(null)}
          hideBalances={props.hideBalances}
          data={sharePosition}
        />
      )}
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
  const profileSlug = effectiveWalletAddress || "me";
  const effectiveReady = e2eConfig.enabled ? true : ready;
  const effectiveAuthenticated = e2eConfig.enabled ? true : authenticated;
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

  // ── Auto-claim referral on wallet connect ──────────────────────────────────
  // When a user lands via /r/[code], a `blink_ref` cookie is set.
  // As soon as their wallet address resolves, we silently claim the referral.
  const referralClaimedRef = useRef(false);
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
        // Clear the cookie so we don't retry
        document.cookie = "blink_ref=; Max-Age=0; path=/";
      })
      .catch(() => {
        // Non-critical — silently ignore
        referralClaimedRef.current = false;
      });
  }, [walletAddress]);

  // ── Signup marker (first wallet connect in this browser profile) ──────────
  useEffect(() => {
    if (!walletAddress || typeof window === "undefined") return;
    const key = `blink:signup:${walletAddress.toLowerCase()}`;
    if (window.localStorage.getItem(key)) return;
    window.localStorage.setItem(key, "1");

    // ── Collect rich client-side context ──────────────────────────────────
    // Referral code from cookie set by /r/[code] middleware
    const refCode =
      document.cookie
        .split(";")
        .map((c) => c.trim())
        .find((c) => c.startsWith("blink_ref="))
        ?.split("=")[1] ?? null;

    // UTM params from landing URL (stored in sessionStorage on first load)
    let utmSource: string | null = null;
    let utmMedium: string | null = null;
    let utmCampaign: string | null = null;
    try {
      const storedUtm = sessionStorage.getItem("blink:utm");
      if (storedUtm) {
        const utm = JSON.parse(storedUtm) as Record<string, string>;
        utmSource = utm.source ?? null;
        utmMedium = utm.medium ?? null;
        utmCampaign = utm.campaign ?? null;
      }
    } catch {
      /* ignore */
    }

    // Session duration — time since first page load
    const sessionStart = Number(
      sessionStorage.getItem("blink:session_start") ?? Date.now(),
    );
    const sessionDurationSec = Math.round((Date.now() - sessionStart) / 1000);

    // Wallet connector type (MetaMask, Coinbase, embedded, etc.)
    const connectorType =
      wallets[0]?.walletClientType ?? wallets[0]?.connectorType ?? "unknown";

    // Device + screen
    const screenW = window.screen.width;
    const screenH = window.screen.height;
    const pixelRatio = window.devicePixelRatio ?? 1;
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);

    void fetch("/api/metrics/event", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getEventIdentityHeaders(),
      },
      body: JSON.stringify({
        eventType: "signup",
        walletAddress,
        source: utmSource ?? "terminal",
        metadata: {
          // Acquisition
          ...(refCode ? { referralCode: refCode } : {}),
          ...(utmSource ? { utmSource } : {}),
          ...(utmMedium ? { utmMedium } : {}),
          ...(utmCampaign ? { utmCampaign } : {}),
          landingPath: window.location.pathname,
          // Trading context
          firstMarket: props.market,
          // Auth
          connectorType,
          // Session
          sessionDurationSec,
          // Device
          screen: `${screenW}x${screenH}`,
          pixelRatio,
          isMobile,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          language: navigator.language,
        },
      }),
    });
  }, [walletAddress, wallets, props.market]);

  const builderFeeQuery = useQuery({
    queryKey: ["blink", "builder-fee", effectiveWalletAddress, props.market],
    queryFn: async () => {
      const response = await fetch(
        `/api/builder/fee?wallet=${encodeURIComponent(effectiveWalletAddress)}&market=${encodeURIComponent(props.market)}`,
      );
      if (!response.ok) throw new Error("Failed to resolve builder fee");
      return (await response.json()) as { feeUnits: number; isPro: boolean };
    },
    enabled: Boolean(effectiveWalletAddress),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const resolvedBuilderFeeUnits =
    builderFeeQuery.data?.feeUnits ?? BUILDER_FEE_UNITS;
  const approvalQuery = useQuery({
    queryKey: [
      "blink",
      "builder-approval",
      effectiveWalletAddress,
      resolvedBuilderFeeUnits,
    ],
    queryFn: () =>
      isBuilderApproved(
        asHexAddress(effectiveWalletAddress),
        resolvedBuilderFeeUnits,
      ),
    enabled: Boolean(effectiveWalletAddress) && !e2eConfig.enabled,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
  const tradeEnabled = e2eConfig.enabled
    ? e2eConfig.approved
    : approvalQuery.data === true;
  const [builderModalOpen, setBuilderModalOpen] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accountModalTab, setAccountModalTab] = useState<
    "Account" | "Connections"
  >("Account");
  const [referralsModalOpen, setReferralsModalOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const topMarketsQuery = useQuery({
    queryKey: ["blink", "top-markets-search"],
    queryFn: () =>
      fetchTopMarketsByVolume(50, {
        includeHip3Offers: true,
        priorityCoins: PRIORITY_HIP3_MARKETS,
      }),
    staleTime: 60_000,
  });
  const { hideBalances: blurBalances, setHideBalances: setBlurBalances } =
    useHideBalances();
  const [autoPromptDismissed, setAutoPromptDismissed] = useState(false);
  const [showProPromo, setShowProPromo] = useState(false);
  const accountAvatar = `https://avatar.vercel.sh/${effectiveWalletAddress || "blink-user"}.png?size=56`;
  const isProMember = builderFeeQuery.data?.isPro === true;

  useEffect(() => {
    if (accountModalOpen || referralsModalOpen || builderModalOpen) {
      setProfileMenuOpen(false);
    }
  }, [accountModalOpen, referralsModalOpen, builderModalOpen]);

  // ── Deploy-refresh polling ──────────────────────────────────────────────────
  // Poll /api/version every 90s. When the SHA changes from the one we booted
  // with, show a "New version available" toast with a reload button.
  useEffect(() => {
    const bootSha = process.env.NEXT_PUBLIC_COMMIT_SHA ?? "dev";
    if (bootSha === "dev") return; // skip in local dev

    const check = async () => {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const { sha } = (await res.json()) as { sha: string };
        if (sha !== bootSha) {
          toast("New version available", {
            description: `Deploy ${sha} is live. Reload to update.`,
            duration: Number.POSITIVE_INFINITY,
            action: {
              label: "Reload",
              onClick: () => window.location.reload(),
            },
          });
          clearInterval(timer);
        }
      } catch {
        // swallow — network hiccup
      }
    };

    const timer = setInterval(() => void check(), 90_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // "/" — open (only when no input/textarea is focused)
      if (
        event.key === "/" &&
        !globalSearchOpen &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        event.preventDefault();
        setGlobalSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [globalSearchOpen]);

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

  useEffect(() => {
    if (!effectiveWalletAddress) return;
    if (!tradeEnabled) return;
    if (isProMember) {
      setShowProPromo(false);
      return;
    }
    if (typeof window === "undefined") return;
    const key = `blink:pro-promo-dismissed:${effectiveWalletAddress.toLowerCase()}`;
    const dismissedUntilRaw = window.localStorage.getItem(key);
    const dismissedUntil = dismissedUntilRaw ? Number(dismissedUntilRaw) : 0;
    setShowProPromo(!dismissedUntil || Date.now() > dismissedUntil);
  }, [effectiveWalletAddress, tradeEnabled, isProMember]);

  const dismissProPromo = useCallback(() => {
    setShowProPromo(false);
    if (typeof window === "undefined" || !effectiveWalletAddress) return;
    const key = `blink:pro-promo-dismissed:${effectiveWalletAddress.toLowerCase()}`;
    const cooldownMs = 6 * 60 * 60 * 1000; // 6h
    window.localStorage.setItem(key, String(Date.now() + cooldownMs));
  }, [effectiveWalletAddress]);

  if (!effectiveReady) {
    return <TerminalLoader />;
  }

  if (!effectiveAuthenticated || (!e2eConfig.enabled && wallets.length === 0)) {
    return <ConnectGate />;
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-background px-3 pb-14 pt-3 text-foreground">
      {/* ── Dynamic Island — primary feedback loop ───────────────────────── */}
      <TradingIsland />

      {/* ── Referral welcome banner — shown once to users from /r/[code] ── */}
      <div className="relative z-50 mx-3 mt-2">
        <ReferralWelcomeBanner />
      </div>

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(58,102,255,0.24),transparent_44%),radial-gradient(circle_at_78%_14%,rgba(39,198,181,0.2),transparent_42%),radial-gradient(circle_at_50%_78%,rgba(35,73,168,0.16),transparent_48%)] blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,8,24,0.18)_0%,rgba(2,8,24,0.4)_100%)]" />
      </div>
      <div className="relative z-10 mx-auto flex w-full max-w-[1900px] gap-3">
        <LeftRail
          market={props.market}
          tradeEnabled={tradeEnabled}
          onRequireBuilderSetup={() => setBuilderModalOpen(true)}
        />

        <div className="min-w-0 flex-1">
          {/* ── Top header row — centered search with iOS glow ── */}
          <div className="mb-3 flex h-[68px] items-center justify-center">
            <div className="relative w-full max-w-md">
              {/* Ambient glow layer */}
              <div className="pointer-events-none absolute -inset-[3px] rounded-[18px] bg-[radial-gradient(ellipse_at_center,rgba(99,153,255,0.18)_0%,transparent_70%)] blur-[6px]" />
              {/* Pulsing outer ring */}
              <div className="pointer-events-none absolute -inset-px rounded-[16px] border border-[#5b8fff22] shadow-[0_0_18px_2px_rgba(91,143,255,0.10)]" />
              <button
                type="button"
                onClick={() => setGlobalSearchOpen(true)}
                className="relative flex h-11 w-full items-center justify-between gap-3 rounded-[14px] border border-[#4a7fff30] bg-[#0d1527cc] px-4 text-sm text-foreground/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm transition-all hover:border-[#4a7fff55] hover:bg-[#0d1527ee] hover:text-foreground/70 hover:shadow-[0_0_24px_4px_rgba(91,143,255,0.12)]"
              >
                <span className="inline-flex items-center gap-2.5">
                  <Search className="size-3.5 shrink-0 text-[#5b8fff60]" />
                  <span className="text-[13px]">
                    Search markets or paste a wallet…
                  </span>
                </span>
                <kbd className="rounded-md border border-white/[0.07] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-foreground/25">
                  /
                </kbd>
              </button>
            </div>
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
                            href={`/profile/${encodeURIComponent(profileSlug)}`}
                          >
                            <User className="size-4" />
                            Your profile
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="rounded-[10px] px-3 py-2 text-sm text-white focus:bg-white/[0.08] focus:text-white"
                          onClick={() => {
                            setProfileMenuOpen(false);
                            setAccountModalTab("Account");
                            setAccountModalOpen(true);
                          }}
                        >
                          <UserCog className="size-4" />
                          Manage account
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="rounded-[10px] px-3 py-2 text-sm text-white focus:bg-white/[0.08] focus:text-white"
                          onClick={() => {
                            setProfileMenuOpen(false);
                            setAccountModalTab("Connections");
                            setAccountModalOpen(true);
                          }}
                        >
                          <Wallet className="size-4" />
                          Import HL account
                        </DropdownMenuItem>
                        {!isProMember ? (
                          <DropdownMenuItem
                            asChild
                            className="rounded-[10px] px-3 py-2 text-sm text-[#9bddff] focus:bg-white/[0.08] focus:text-white"
                          >
                            <Link
                              href="/pro"
                              onClick={() => setProfileMenuOpen(false)}
                            >
                              <Sparkles className="size-4" />
                              Upgrade to Pro
                            </Link>
                          </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuItem
                          className="rounded-[10px] px-3 py-2 text-sm text-white focus:bg-white/[0.08] focus:text-white"
                          onClick={() => setBlurBalances(!blurBalances)}
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
                          asChild
                          className="rounded-[10px] px-3 py-2 text-sm text-white focus:bg-white/[0.08] focus:text-white"
                        >
                          <Link
                            href="/rewards"
                            onClick={() => setProfileMenuOpen(false)}
                          >
                            <Gift className="size-4" />
                            Rewards
                          </Link>
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
          {tradeEnabled && showProPromo ? (
            <div className="relative mt-3">
              <BlinkProUpsellCard
                ctaHref="/pro"
                ctaLabel="See Blink Pro"
                description="Free trading stays open, but Pro is where the sharper desk layer starts: lower builder fees, faster routing priority, and better account surfaces."
                eyebrow="Upgrade surface"
                perks={[
                  "Lower builder fees on eligible routed volume",
                  "Priority routing and cleaner desk-level account surfaces",
                  "Power-user upgrades for multi-wallet workflows and rewards visibility",
                ]}
                title="Push your edge with Blink Pro."
              />
              <button
                type="button"
                onClick={dismissProPromo}
                className="absolute right-3 top-3 rounded-md border border-white/15 bg-white/[0.04] p-1 text-foreground/60 transition hover:text-white"
                aria-label="Dismiss Pro banner"
              >
                <X className="size-3.5" />
              </button>
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
              hideBalances={blurBalances}
              onRequireBuilderSetup={() => setBuilderModalOpen(true)}
            />
          </div>

          {e2eConfig.enabled ? null : (
            <AccountPanel
              walletAddress={effectiveWalletAddress}
              builderFeeUnits={resolvedBuilderFeeUnits}
              hideBalances={blurBalances}
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
              {/* commit SHA */}
              {process.env.NEXT_PUBLIC_COMMIT_SHA &&
                process.env.NEXT_PUBLIC_COMMIT_SHA !== "dev" && (
                  <span
                    className="font-mono text-[10px] text-foreground/30 select-all"
                    title="Build commit"
                  >
                    {process.env.NEXT_PUBLIC_COMMIT_SHA}
                  </span>
                )}
              {/* HL network status indicator */}
              <a
                href="https://hyperliquid.statuspage.io/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 transition hover:text-foreground/65"
                title="Hyperliquid network status"
              >
                <span
                  className="size-1.5 rounded-full bg-emerald-400"
                  style={{ boxShadow: "0 0 5px 2px #34d39966" }}
                />
                <span>Network</span>
              </a>
            </div>
          </footer>
        </div>

        <nav className="glass-panel hidden w-[82px] flex-col items-center gap-2 p-2 xl:flex">
          {[
            { icon: Star, label: "Rewards", href: "/rewards" },
            { icon: Settings2, label: "Setup", href: "/profile" },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="flex w-full cursor-pointer flex-col items-center rounded-[14px] border border-white/[0.08] bg-white/[0.04] px-2 py-3 text-center"
            >
              <item.icon className="size-4 text-white" />
              <span className="mt-2 text-[11px] text-foreground/48">
                {item.label}
              </span>
            </Link>
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
            <a
              href="https://docs.blink.lat"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-foreground/72 transition hover:text-white"
            >
              <LayoutDashboard className="size-3.5 text-[#8fb9ff]" />
              Docs
              <ArrowUpRight className="size-3" />
            </a>
            <Link
              href="https://hyperliquid.statuspage.io/"
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
              href="https://whop.com/the-circle-vip"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-[#8fbaff80] bg-[linear-gradient(180deg,#3c76ff,#2457db)] px-3 py-1 text-[11px] font-semibold text-white shadow-[0_10px_30px_rgba(37,90,224,0.35)] transition hover:brightness-110"
            >
              Community
              <ArrowUpRight className="size-3" />
            </a>
            <Link href="/privacy" className="transition hover:text-white">
              Privacy
            </Link>
            <Link href="/tos" className="transition hover:text-white">
              Terms
            </Link>
            <a
              href="https://discord.gg/Myu962DMMA"
              target="_blank"
              rel="noreferrer"
              className="transition hover:text-white"
            >
              Discord
            </a>
            <a
              href="https://t.me/rokitgg"
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
        requiredFeeUnits={resolvedBuilderFeeUnits}
        onCloseAction={() => {
          setBuilderModalOpen(false);
          setAutoPromptDismissed(true);
        }}
        onApprovedAction={() => {
          setAutoPromptDismissed(false);
          void approvalQuery.refetch();
        }}
      />
      <AccountManagementModal
        open={accountModalOpen}
        walletAddress={effectiveWalletAddress}
        initialTab={accountModalTab}
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
      <CommandDialog
        open={globalSearchOpen}
        onOpenChange={(open) => {
          setGlobalSearchOpen(open);
          if (!open) setGlobalSearchQuery("");
        }}
      >
        <CommandInput
          placeholder="Search perps or paste a wallet address..."
          value={globalSearchQuery}
          onValueChange={setGlobalSearchQuery}
        />
        <CommandList>
          <CommandEmpty>
            <span className="text-foreground/40">No markets found</span>
          </CommandEmpty>

          {/* Wallet / profile detection */}
          {/^0x[0-9a-fA-F]{10,}/.test(globalSearchQuery.trim()) && (
            <CommandGroup heading="Wallet">
              <CommandItem
                onSelect={() => {
                  setGlobalSearchOpen(false);
                  router.push(`/profile/${globalSearchQuery.trim()}`);
                }}
                className="flex items-center gap-3 px-3 py-2.5"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#1a2340] text-xs text-foreground/50">
                  <User className="size-3.5" />
                </div>
                <div className="flex flex-col">
                  <span className="font-mono text-sm text-white">
                    {globalSearchQuery.trim().slice(0, 8)}…
                    {globalSearchQuery.trim().slice(-6)}
                  </span>
                  <span className="text-xs text-foreground/40">
                    View profile
                  </span>
                </div>
                <ArrowRight className="ml-auto size-3.5 text-foreground/30" />
              </CommandItem>
            </CommandGroup>
          )}

          {/* Markets */}
          <CommandGroup heading="Perpetuals">
            {(topMarketsQuery.data ?? [])
              .filter(
                (m) =>
                  !globalSearchQuery.trim() ||
                  m.coin
                    .toLowerCase()
                    .includes(globalSearchQuery.trim().toLowerCase()),
              )
              .slice(0, 12)
              .map((m) => {
                const pos = m.changePct >= 0;
                return (
                  <CommandItem
                    key={m.coin}
                    value={m.coin}
                    onSelect={() => {
                      setGlobalSearchOpen(false);
                      router.push(`/trade/${marketToSlug(m.coin)}`);
                    }}
                    className="flex items-center gap-3 px-3 py-2.5"
                  >
                    {/* Coin circle */}
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#1a2340] text-[11px] font-bold text-foreground/70">
                      {m.coin.slice(0, 2)}
                    </div>
                    {/* Name */}
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-white">
                        {m.coin}
                      </span>
                      <span className="text-xs text-foreground/40">
                        {m.isHip3 ? "HIP-3 perpetual" : "Perpetual"}
                      </span>
                    </div>
                    {/* Price + change */}
                    <div className="ml-auto flex items-center gap-3 text-right">
                      <span className="text-sm tabular-nums text-foreground/70">
                        {m.markPx < 0.01
                          ? `$${m.markPx.toFixed(5)}`
                          : m.markPx < 1
                            ? `$${m.markPx.toFixed(4)}`
                            : `$${m.markPx.toLocaleString("en-US", { maximumFractionDigits: 2 })}`}
                      </span>
                      <span
                        className={`w-[58px] rounded-md px-1.5 py-0.5 text-center text-[11px] font-semibold tabular-nums ${
                          pos
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-rose-500/10 text-rose-400"
                        }`}
                      >
                        {pos ? "+" : ""}
                        {m.changePct.toFixed(2)}%
                      </span>
                    </div>
                  </CommandItem>
                );
              })}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </main>
  );
}
