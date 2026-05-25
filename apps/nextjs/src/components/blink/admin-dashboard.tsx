"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import Link from "next/link";

import { useWallets } from "@privy-io/react-auth";
import { Loader2, RefreshCw, Search } from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis } from "recharts";

import { Badge } from "@acme/ui/badge";
import { Switch } from "@acme/ui/switch";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@acme/ui/chart";

import { getAdminStats, type AdminStats } from "~/app/actions/get-admin-stats";
import {
  getAdminAccess,
  type AdminAccessResult,
} from "~/app/actions/get-admin-access";
import { setFeatureFlagAction } from "~/app/actions/set-feature-flag";

function truncateAddress(address: string) {
  if (!address) return "—";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: amount < 100 ? 2 : 0,
  }).format(amount);
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatLabel(input: string) {
  if (!input) return "Unknown";
  return input
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function sourceBadge(source: "hyperliquid" | "offchain") {
  if (source === "hyperliquid") {
    return (
      <Badge className="rounded-full border border-emerald-400/35 bg-emerald-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-emerald-300">
        Hyperliquid L1
      </Badge>
    );
  }
  return (
    <Badge className="rounded-full border border-sky-400/35 bg-sky-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-sky-300">
      Off-Chain
    </Badge>
  );
}

type NavItem = { label: string; active: boolean; href: string; soon?: boolean };
type AdminRange = "5m" | "15m" | "1h" | "1d" | "7d" | "30d" | "90d";

const ADMIN_RANGE_OPTIONS: Array<{
  value: AdminRange;
  label: string;
  windowDays: 1 | 7 | 30 | 90;
  liveMinutes: number;
}> = [
  { value: "5m", label: "5m", windowDays: 1, liveMinutes: 5 },
  { value: "15m", label: "15m", windowDays: 1, liveMinutes: 15 },
  { value: "1h", label: "1h", windowDays: 1, liveMinutes: 60 },
  { value: "1d", label: "Today", windowDays: 1, liveMinutes: 60 },
  { value: "7d", label: "7d", windowDays: 7, liveMinutes: 180 },
  { value: "30d", label: "30d", windowDays: 30, liveMinutes: 360 },
  { value: "90d", label: "90d", windowDays: 90, liveMinutes: 720 },
];

const INTERNAL_NAV_ITEMS: NavItem[] = [
  { label: "Home", active: true, href: "/internal" },
  { label: "Affiliates", active: false, href: "/internal/affiliates" },
  { label: "Users", active: false, href: "#", soon: true },
  { label: "Payments", active: false, href: "#", soon: true },
  { label: "Memberships", active: false, href: "#", soon: true },
  { label: "Referrals", active: false, href: "#", soon: true },
  { label: "Settings", active: false, href: "#", soon: true },
];

function getRangeConfig(range: AdminRange) {
  const found = ADMIN_RANGE_OPTIONS.find((option) => option.value === range);
  if (found) return found;
  return ADMIN_RANGE_OPTIONS[0] as (typeof ADMIN_RANGE_OPTIONS)[number];
}

export function AdminDashboard() {
  const { wallets } = useWallets();
  const connectedWallets = useMemo(
    () =>
      wallets
        .map((wallet) => wallet.address?.toLowerCase())
        .filter((address): address is string => Boolean(address)),
    [wallets],
  );
  const [adminAccess, setAdminAccess] = useState<AdminAccessResult>({
    allowed: false,
    role: "viewer",
    walletAddress: "",
  });
  const [checkingAccess, setCheckingAccess] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function resolveAccess() {
      setCheckingAccess(true);
      try {
        const access = await getAdminAccess(connectedWallets);
        if (!cancelled) setAdminAccess(access);
      } catch (err) {
        console.error("[admin] Failed to resolve admin access:", err);
        if (!cancelled) {
          setAdminAccess({
            allowed: false,
            role: "viewer",
            walletAddress: connectedWallets[0] ?? "",
          });
        }
      } finally {
        if (!cancelled) setCheckingAccess(false);
      }
    }

    void resolveAccess();

    return () => {
      cancelled = true;
    };
  }, [connectedWallets]);

  const walletAddress = adminAccess.walletAddress || connectedWallets[0] || "";
  const isAllowed = adminAccess.allowed;
  const role = adminAccess.role;

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [flagSaving, setFlagSaving] = useState<string | null>(null);
  const [selectedRange, setSelectedRange] = useState<AdminRange>("1d");

  const fetchStats = useCallback(
    async (options?: {
      syncHyperliquid?: boolean;
      includeAttribution?: boolean;
      isBackground?: boolean;
    }) => {
      if (!options?.isBackground) {
        setLoading(true);
      }
      try {
        const rangeConfig = getRangeConfig(selectedRange);
        const data = await getAdminStats({
          syncHyperliquid: options?.syncHyperliquid,
          includeAttribution: options?.includeAttribution,
          liveWindowMinutes: rangeConfig.liveMinutes,
          liveLimit: 120,
          windowDays: rangeConfig.windowDays,
        });
        setStats(data);
        setLastFetched(new Date());
      } catch (err) {
        console.error("[admin] Failed to load stats:", err);
      } finally {
        if (!options?.isBackground) {
          setLoading(false);
        }
      }
    },
    [selectedRange],
  );

  useEffect(() => {
    if (!isAllowed) return;
    void fetchStats({ syncHyperliquid: true, includeAttribution: true });
  }, [fetchStats, isAllowed]);

  useEffect(() => {
    if (!isAllowed) return;
    const id = setInterval(() => {
      void fetchStats({
        includeAttribution: false,
        isBackground: true,
      });
    }, 8_000);
    return () => clearInterval(id);
  }, [fetchStats, isAllowed]);

  const chartConfig = {
    revenue: {
      label: "Revenue",
      color: "#41d38f",
    },
    fills: {
      label: "Fills",
      color: "#7fa8ff",
    },
    users: {
      label: "Active users",
      color: "#67e8f9",
    },
  } satisfies ChartConfig;

  const statsCards = useMemo(() => {
    if (!stats) return [];
    return [
      {
        label: "Builder revenue",
        value: formatMoney(stats.finance.hyperliquid.totalRevenueUsd),
        source: stats.kpiSource.builderRevenue,
      },
      {
        label: "Routed volume",
        value: formatCompact(stats.finance.hyperliquid.totalVolumeUsd),
        source: stats.kpiSource.routedVolume,
      },
      {
        label: "Fills",
        value: String(stats.finance.hyperliquid.fillsCount),
        source: stats.kpiSource.fills,
      },
      {
        label: "Active traders",
        value: String(stats.finance.hyperliquid.totalUsers),
        source: stats.kpiSource.activeUsers,
      },
      {
        label: "Avg rev / user",
        value: formatMoney(stats.finance.hyperliquid.avgRevenuePerUser),
        source: stats.kpiSource.avgRevenuePerUser,
      },
      {
        label: "Signups",
        value: String(stats.funnel.signups),
        source: stats.kpiSource.signups,
      },
      {
        label: "Builder approved",
        value: String(stats.funnel.approvedBuilder),
        source: stats.kpiSource.builderApprovals,
      },
      {
        label: "First trade",
        value: String(stats.funnel.firstTrade),
        source: stats.kpiSource.firstTrade,
      },
      {
        label: "Pro started",
        value: String(stats.funnel.proStarted),
        source: stats.kpiSource.proStarted,
      },
    ] as const;
  }, [stats]);

  if (checkingAccess) {
    return (
      <main className="min-h-screen bg-[#06070b] px-6 py-8 text-foreground">
        <div className="mx-auto max-w-3xl">
          <section className="rounded-2xl border border-white/10 bg-[#0f121a] p-8">
            <Badge className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-foreground/60">
              Admin
            </Badge>
            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white">
              Verifying access…
            </h1>
            <div className="mt-4 inline-flex items-center gap-2 text-sm text-foreground/60">
              <Loader2 className="size-4 animate-spin" />
              Checking Neon RBAC roles for connected wallet(s).
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (!isAllowed) {
    return (
      <main className="min-h-screen bg-[#06070b] px-6 py-8 text-foreground">
        <div className="mx-auto max-w-3xl">
          <section className="rounded-2xl border border-white/10 bg-[#0f121a] p-8">
            <Badge className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-foreground/60">
              Admin
            </Badge>
            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white">
              Admin role required.
            </h1>
            <p className="mt-3 text-base leading-7 text-foreground/58">
              Blink internal tools now use Neon-backed RBAC. Ask a superuser to
              grant your connected wallet an admin or superuser role.
            </p>
            {connectedWallets.length > 0 && (
              <p className="mt-3 font-mono text-sm text-foreground/45">
                Connected: {connectedWallets[0]}
                {connectedWallets.length > 1
                  ? ` (+${connectedWallets.length - 1} linked)`
                  : ""}
              </p>
            )}
            <Link
              href="/trade/BTC"
              className="mt-6 inline-flex text-sm text-foreground/60 transition hover:text-foreground/82"
            >
              ← Return to terminal
            </Link>
          </section>
        </div>
      </main>
    );
  }

  const rec = stats?.finance.reconciliation;
  const recTone =
    rec?.status === "critical"
      ? "text-rose-300 border-rose-400/30 bg-rose-400/10"
      : rec?.status === "warning"
        ? "text-amber-300 border-amber-400/30 bg-amber-400/10"
        : "text-emerald-300 border-emerald-400/30 bg-emerald-400/10";

  return (
    <main className="min-h-screen bg-[#06070b] px-4 py-5 text-foreground md:px-6">
      <div className="mx-auto flex max-w-[1500px] gap-4">
        <aside className="hidden w-[248px] shrink-0 rounded-2xl border border-white/10 bg-[#0b0d13] p-3 lg:block">
          <p className="px-2 py-1 text-xs uppercase tracking-[0.18em] text-foreground/45">
            Internal
          </p>
          <div className="mt-2 space-y-1">
            {INTERNAL_NAV_ITEMS.map(({ label, active, href, soon }) => (
              <Link
                key={label}
                href={href}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                  active
                    ? "bg-white/12 text-white"
                    : "text-foreground/60 hover:bg-white/[0.06] hover:text-white/85"
                }`}
              >
                {label}
                {!active && soon ? (
                  <span className="text-[10px] uppercase tracking-[0.14em] text-foreground/35">
                    Soon
                  </span>
                ) : null}
              </Link>
            ))}
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#0b0d13] px-4 py-3">
            <div className="flex items-center gap-2">
              <Badge className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-foreground/60">
                Internal dashboard
              </Badge>
              {role === "superuser" ? (
                <Badge className="rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-amber-300">
                  Superuser
                </Badge>
              ) : null}
            </div>

            <div className="relative min-w-[240px] flex-1 md:max-w-[420px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/35" />
              <input
                placeholder="Search users, wallets, sources..."
                className="h-10 w-full rounded-xl border border-white/10 bg-[#111624] pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/35"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedRange}
                onChange={(event) =>
                  setSelectedRange(event.target.value as AdminRange)
                }
                className="h-10 rounded-xl border border-white/10 bg-[#111624] px-3 text-sm text-white outline-none"
              >
                {ADMIN_RANGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() =>
                  void fetchStats({
                    syncHyperliquid: true,
                    includeAttribution: true,
                  })
                }
                disabled={loading}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-[#141925] px-3 text-sm text-foreground/70 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="size-3.5" />
                )}
                Refresh
              </button>
            </div>
          </div>

          <section className="rounded-2xl border border-white/10 bg-[#0b0d13] p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h1 className="text-[40px] font-semibold tracking-[-0.03em] text-white">
                Today
              </h1>
              <p className="text-xs text-foreground/40">
                Hyperliquid sync:{" "}
                {stats?.hyperliquidSync.freshness ?? "unknown"} ·{" "}
                {stats ? timeAgo(stats.hyperliquidSync.lastSyncedAt) : "—"}
              </p>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-xl border border-white/10 bg-[#121726] p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-foreground/45">
                  Builder revenue
                </p>
                <p className="mt-2 text-3xl font-semibold text-white">
                  {stats ? formatMoney(stats.today.revenueUsd) : "—"}
                </p>
                <p className="mt-1 text-xs text-foreground/45">
                  Yesterday{" "}
                  {stats ? formatMoney(stats.today.yesterdayRevenueUsd) : "—"}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#121726] p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-foreground/45">
                  Routed volume
                </p>
                <p className="mt-2 text-3xl font-semibold text-white">
                  {stats ? formatCompact(stats.today.volumeUsd) : "—"}
                </p>
                <p className="mt-1 text-xs text-foreground/45">
                  Yesterday{" "}
                  {stats ? formatCompact(stats.today.yesterdayVolumeUsd) : "—"}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#121726] p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-foreground/45">
                  Active routed users
                </p>
                <p className="mt-2 text-3xl font-semibold text-white">
                  {stats?.today.activeUsers ?? 0}
                </p>
                <p className="mt-1 text-xs text-foreground/45">today window</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#121726] p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-foreground/45">
                  Fills (live)
                </p>
                <p className="mt-2 text-3xl font-semibold text-white">
                  {stats?.today.fillsCount ?? 0}
                </p>
                <p className="mt-1 text-xs text-foreground/45">
                  {stats?.builder.live.windowMinutes ?? 30}m
                </p>
              </div>
            </div>
          </section>

          <section className="mt-4 rounded-2xl border border-white/10 bg-[#0b0d13] p-5">
            <h2 className="text-2xl font-semibold text-white">Stats</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {statsCards.map((card) => (
                <div
                  key={card.label}
                  className="rounded-xl border border-white/10 bg-[#121726] p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs uppercase tracking-[0.12em] text-foreground/45">
                      {card.label}
                    </p>
                    {sourceBadge(
                      card.source === "hyperliquid"
                        ? "hyperliquid"
                        : "offchain",
                    )}
                  </div>
                  <p className="mt-2 text-3xl font-semibold text-white">
                    {card.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-white/10 bg-[#101523] p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">
                  Daily revenue + users
                </h3>
                <span className="text-xs text-foreground/45">
                  window {selectedRange}
                </span>
              </div>
              <div className="h-[220px]">
                <ChartContainer config={chartConfig} className="h-full w-full">
                  <LineChart
                    data={stats?.builder.series ?? []}
                    margin={{ left: 2, right: 2 }}
                  >
                    <CartesianGrid
                      vertical={false}
                      stroke="#1a2437"
                      strokeDasharray="2 8"
                    />
                    <XAxis
                      dataKey="day"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                    />
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent indicator="line" />}
                    />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="var(--color-revenue)"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="users"
                      stroke="var(--color-users)"
                      strokeWidth={1.8}
                      dot={false}
                    />
                  </LineChart>
                </ChartContainer>
              </div>
            </div>
          </section>

          <section className="mt-4 rounded-2xl border border-white/10 bg-[#0b0d13] p-5">
            <h2 className="text-base font-semibold text-white">
              Internal analytics (Vercel + Blink)
            </h2>
            <p className="mt-1 text-xs text-foreground/45">
              Unique visitor IDs use Vercel request signals + first-party
              visitor/session IDs.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-xl border border-white/10 bg-[#121726] p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-foreground/45">
                  Unique visitors 24h
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {stats?.internalAnalytics.uniqueVisitors24h ?? 0}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#121726] p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-foreground/45">
                  Unique visitors 7d
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {stats?.internalAnalytics.uniqueVisitors7d ?? 0}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#121726] p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-foreground/45">
                  Human events 24h
                </p>
                <p className="mt-2 text-2xl font-semibold text-emerald-300">
                  {stats?.internalAnalytics.humanEvents24h ?? 0}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#121726] p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-foreground/45">
                  Bot events 24h
                </p>
                <p className="mt-2 text-2xl font-semibold text-amber-300">
                  {stats?.internalAnalytics.botEvents24h ?? 0}
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-[#101523] p-3">
                <p className="mb-2 text-sm font-medium text-white">
                  Top sources (7d)
                </p>
                <div className="space-y-2">
                  {(stats?.internalAnalytics.topSources7d ?? []).map((row) => (
                    <div
                      key={row.source}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-foreground/75">
                        {formatLabel(row.source)}
                      </span>
                      <span className="text-white/85">
                        {row.events} ev · {row.uniqueVisitors} uv
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#101523] p-3">
                <p className="mb-2 text-sm font-medium text-white">
                  Top countries (7d)
                </p>
                <div className="space-y-2">
                  {(stats?.internalAnalytics.topCountries7d ?? []).map(
                    (row) => (
                      <div
                        key={row.country}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-foreground/75">
                          {row.country}
                        </span>
                        <span className="text-white/85">
                          {row.events} ev · {row.uniqueVisitors} uv
                        </span>
                      </div>
                    ),
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="mt-4 rounded-2xl border border-white/10 bg-[#0b0d13] p-5">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">
                Reconciliation
              </h2>
              <Badge
                className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] ${recTone}`}
              >
                {rec?.status ?? "unknown"}
              </Badge>
            </div>
            <p className="mb-4 text-xs text-foreground/45">
              Canonical L1 totals vs off-chain estimates for the selected
              window.
            </p>
            <div className="grid gap-3 md:grid-cols-4">
              {[
                [
                  "Revenue",
                  rec?.revenue.hyperliquid ?? 0,
                  rec?.revenue.offchain ?? 0,
                  rec?.revenue.delta ?? 0,
                  true,
                ],
                [
                  "Volume",
                  rec?.volume.hyperliquid ?? 0,
                  rec?.volume.offchain ?? 0,
                  rec?.volume.delta ?? 0,
                  true,
                ],
                [
                  "Fills",
                  rec?.fills.hyperliquid ?? 0,
                  rec?.fills.offchain ?? 0,
                  rec?.fills.delta ?? 0,
                  false,
                ],
                [
                  "Users",
                  rec?.users.hyperliquid ?? 0,
                  rec?.users.offchain ?? 0,
                  rec?.users.delta ?? 0,
                  false,
                ],
              ].map(([label, canonical, offchain, delta, money]) => (
                <div
                  key={String(label)}
                  className="rounded-xl border border-white/10 bg-[#121726] p-3"
                >
                  <p className="text-xs uppercase tracking-[0.12em] text-foreground/45">
                    {label}
                  </p>
                  <p className="mt-2 text-sm text-foreground/75">
                    C:{" "}
                    {money ? formatMoney(Number(canonical)) : Number(canonical)}
                  </p>
                  <p className="text-sm text-foreground/55">
                    O:{" "}
                    {money ? formatMoney(Number(offchain)) : Number(offchain)}
                  </p>
                  <p
                    className={`mt-2 text-sm font-medium ${Number(delta) === 0 ? "text-foreground/60" : Number(delta) > 0 ? "text-emerald-300" : "text-rose-300"}`}
                  >
                    Δ {money ? formatMoney(Number(delta)) : Number(delta)}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-4 rounded-2xl border border-white/10 bg-[#0b0d13] p-5">
            <h2 className="text-base font-semibold text-white">
              Feature flags
            </h2>
            <p className="mt-1 text-xs text-foreground/45">
              Runtime controls for growth and monetization behavior.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {(stats?.featureFlags ?? []).map((flag) => (
                <div
                  key={flag.key}
                  className="rounded-xl border border-white/10 bg-[#121726] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-white">
                        {formatLabel(flag.key)}
                      </p>
                      <p className="mt-1 text-xs text-foreground/45">
                        {flag.description}
                      </p>
                      <p className="mt-2 text-[11px] text-foreground/35">
                        {flag.updatedBy
                          ? `Updated by ${truncateAddress(flag.updatedBy)}`
                          : "Never updated"}
                      </p>
                    </div>
                    <Switch
                      checked={flag.enabled}
                      disabled={flagSaving === flag.key || !walletAddress}
                      onCheckedChange={async (nextValue) => {
                        try {
                          setFlagSaving(flag.key);
                          await setFeatureFlagAction({
                            key: flag.key,
                            enabled: nextValue,
                            walletAddress,
                          });
                          setStats((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  featureFlags: prev.featureFlags.map((f) =>
                                    f.key === flag.key
                                      ? {
                                          ...f,
                                          enabled: nextValue,
                                          updatedBy: walletAddress,
                                          updatedAt: new Date(),
                                        }
                                      : f,
                                  ),
                                }
                              : prev,
                          );
                        } catch (error) {
                          console.error("[admin] failed to toggle flag", error);
                        } finally {
                          setFlagSaving(null);
                        }
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-4 grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-[#0b0d13] p-5">
              <h2 className="text-base font-semibold text-white">
                Revenue by source
              </h2>
              <div className="mt-4 space-y-2">
                {(stats?.builder.attribution.bySource ?? [])
                  .slice(0, 8)
                  .map((row) => (
                    <div
                      key={row.source}
                      className="flex items-center justify-between rounded-xl border border-white/8 bg-[#121726] px-3 py-2"
                    >
                      <div>
                        <p className="text-sm text-white/85">
                          {formatLabel(row.source)}
                        </p>
                        <p className="text-xs text-foreground/45">
                          {row.users} users · {row.fillsCount} fills
                        </p>
                      </div>
                      <p className="text-sm font-medium text-emerald-300">
                        {formatMoney(row.revenueUsd)}
                      </p>
                    </div>
                  ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0b0d13] p-5">
              <h2 className="text-base font-semibold text-white">
                Revenue by country
              </h2>
              <div className="mt-4 space-y-2">
                {(stats?.builder.attribution.byCountry ?? [])
                  .slice(0, 8)
                  .map((row) => (
                    <div
                      key={row.country}
                      className="flex items-center justify-between rounded-xl border border-white/8 bg-[#121726] px-3 py-2"
                    >
                      <div>
                        <p className="text-sm text-white/85">{row.country}</p>
                        <p className="text-xs text-foreground/45">
                          {row.users} users · {row.fillsCount} fills
                        </p>
                      </div>
                      <p className="text-sm font-medium text-emerald-300">
                        {formatMoney(row.revenueUsd)}
                      </p>
                    </div>
                  ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0b0d13] p-5">
              <h2 className="text-base font-semibold text-white">Top users</h2>
              <div className="mt-4 space-y-2">
                {(stats?.builder.attribution.byUser ?? [])
                  .slice(0, 8)
                  .map((row) => (
                    <div
                      key={row.walletAddress}
                      className="flex items-center justify-between rounded-xl border border-white/8 bg-[#121726] px-3 py-2"
                    >
                      <div>
                        <p className="font-mono text-xs text-white/85">
                          {truncateAddress(row.walletAddress)}
                        </p>
                        <p className="text-xs text-foreground/45">
                          {formatLabel(row.source)} · {row.country}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-emerald-300">
                          {formatMoney(row.revenueUsd)}
                        </p>
                        <p className="text-xs text-foreground/45">
                          {formatCompact(row.volumeUsd)} vol
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </section>

          <section className="mt-4 rounded-2xl border border-white/10 bg-[#0b0d13] p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">
                Live builder fill revenue
              </h2>
              <span className="text-xs text-foreground/45">
                Polling every 8s · last{" "}
                {stats?.builder.live.windowMinutes ?? 30}m
              </span>
            </div>
            <div className="mb-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-[#121726] px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.12em] text-foreground/45">
                  Revenue (window)
                </p>
                <p className="mt-1 text-xl font-semibold text-emerald-300">
                  {formatMoney(stats?.builder.live.totals.revenueUsd ?? 0)}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#121726] px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.12em] text-foreground/45">
                  Notional (window)
                </p>
                <p className="mt-1 text-xl font-semibold text-white">
                  {formatCompact(stats?.builder.live.totals.notionalUsd ?? 0)}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#121726] px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.12em] text-foreground/45">
                  Fills (window)
                </p>
                <p className="mt-1 text-xl font-semibold text-white">
                  {stats?.builder.live.totals.fillsCount ?? 0}
                </p>
              </div>
            </div>
            <div className="max-h-[320px] overflow-auto rounded-xl border border-white/10">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="sticky top-0 bg-[#0c111b] text-left text-xs uppercase tracking-[0.12em] text-foreground/45">
                  <tr>
                    <th className="px-3 py-2">Time</th>
                    <th className="px-3 py-2">Wallet</th>
                    <th className="px-3 py-2">Market</th>
                    <th className="px-3 py-2">Side</th>
                    <th className="px-3 py-2 text-right">Price</th>
                    <th className="px-3 py-2 text-right">Size</th>
                    <th className="px-3 py-2 text-right">Notional</th>
                    <th className="px-3 py-2 text-right">Fee units</th>
                    <th className="px-3 py-2 text-right">Builder rev</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {(stats?.builder.live.fills ?? []).map((fill) => (
                    <tr key={`${fill.tid}-${fill.walletAddress}`}>
                      <td className="px-3 py-2 text-foreground/65">
                        {new Date(fill.time).toLocaleTimeString()}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-foreground/78">
                        {truncateAddress(fill.walletAddress)}
                      </td>
                      <td className="px-3 py-2 text-white">{fill.coin}</td>
                      <td
                        className={`px-3 py-2 ${fill.side === "buy" ? "text-emerald-300" : "text-rose-300"}`}
                      >
                        {fill.side.toUpperCase()}
                      </td>
                      <td className="px-3 py-2 text-right text-white/85">
                        {fill.px.toFixed(4)}
                      </td>
                      <td className="px-3 py-2 text-right text-white/85">
                        {fill.sz.toFixed(6)}
                      </td>
                      <td className="px-3 py-2 text-right text-white/85">
                        {formatMoney(fill.notionalUsd)}
                      </td>
                      <td className="px-3 py-2 text-right text-white/70">
                        {fill.feeUnits}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-emerald-300">
                        {formatMoney(fill.builderFeeUsd)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-[#0b0d13] p-0">
            <div className="border-b border-white/8 px-5 py-4">
              <h2 className="text-base font-semibold text-white">
                Recent builder approvals
              </h2>
            </div>

            {loading && !stats ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="size-6 animate-spin text-foreground/35" />
              </div>
            ) : stats?.recentApprovals.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-foreground/40">
                No approvals recorded yet.
              </div>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                <div className="grid grid-cols-[1fr_100px_100px] gap-4 px-5 py-2 text-[11px] uppercase tracking-[0.14em] text-foreground/35">
                  <span>Wallet</span>
                  <span className="text-right">Max fee</span>
                  <span className="text-right">When</span>
                </div>
                {(stats?.recentApprovals ?? []).map((approval) => (
                  <div
                    key={`${approval.walletAddress}-${approval.approvedAt}`}
                    className="grid grid-cols-[1fr_100px_100px] gap-4 px-5 py-3 text-sm"
                  >
                    <span className="font-mono text-foreground/72">
                      {truncateAddress(approval.walletAddress)}
                    </span>
                    <span className="text-right font-mono text-foreground/55">
                      {approval.maxFeeRate}
                    </span>
                    <span className="text-right text-foreground/40">
                      {timeAgo(approval.approvedAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="mt-4 flex items-center justify-between text-xs text-foreground/35">
            <span>
              Signed in as{" "}
              <span className="font-mono">
                {truncateAddress(walletAddress)}
              </span>{" "}
              · role <span className="uppercase">{role}</span>
            </span>
            {lastFetched ? (
              <span>Updated {lastFetched.toLocaleTimeString()}</span>
            ) : null}
            <Link
              href="/trade/BTC"
              className="transition hover:text-foreground/70"
            >
              ← Back to terminal
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
