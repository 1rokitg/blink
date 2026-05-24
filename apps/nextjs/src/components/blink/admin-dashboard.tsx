"use client";

import { useCallback, useEffect, useState } from "react";

import Link from "next/link";

import { useWallets } from "@privy-io/react-auth";
import { Loader2, RefreshCw } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

import { Badge } from "@acme/ui/badge";
import { Switch } from "@acme/ui/switch";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@acme/ui/chart";

import { getAdminStats, type AdminStats } from "~/app/actions/get-admin-stats";
import { setFeatureFlagAction } from "~/app/actions/set-feature-flag";
import { getWalletRole, isAdminWallet } from "~/lib/blink/admin-allowlist";

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

export function AdminDashboard() {
  const { wallets } = useWallets();
  const connectedWallets = wallets
    .map((wallet) => wallet.address?.toLowerCase())
    .filter((address): address is string => Boolean(address));
  const matchedAdminWallet =
    connectedWallets.find((address) => isAdminWallet(address)) ?? "";
  const walletAddress = matchedAdminWallet || connectedWallets[0] || "";
  const isAllowed = Boolean(matchedAdminWallet);
  const role = getWalletRole(matchedAdminWallet);

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [flagSaving, setFlagSaving] = useState<string | null>(null);

  const fetchStats = useCallback(async (options?: {
    syncHyperliquid?: boolean;
    includeAttribution?: boolean;
    isBackground?: boolean;
  }) => {
    if (!options?.isBackground) {
      setLoading(true);
    }
    try {
      const data = await getAdminStats({
        syncHyperliquid: options?.syncHyperliquid,
        includeAttribution: options?.includeAttribution,
        liveWindowMinutes: 30,
        liveLimit: 120,
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
  }, []);

  useEffect(() => {
    if (isAllowed) {
      void fetchStats({ syncHyperliquid: true, includeAttribution: true });
    }
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
    volume: {
      label: "Volume",
      color: "#2c6bff",
    },
  } satisfies ChartConfig;

  if (!isAllowed) {
    return (
      <main className="min-h-screen bg-background px-6 py-8 text-foreground">
        <div className="mx-auto max-w-3xl">
          <section className="glass-card p-8">
            <Badge className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-foreground/60">
              Admin
            </Badge>
            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white">
              Allowlisted wallet required.
            </h1>
            <p className="mt-3 text-base leading-7 text-foreground/58">
              Blink admin is gated behind a wallet allowlist. Add your wallet to{" "}
              <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-sm text-white/70">
                NEXT_PUBLIC_ADMIN_WALLET_ALLOWLIST
              </code>{" "}
              to unlock the metrics surface.
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

  return (
    <main className="min-h-screen bg-background px-6 py-8 text-foreground">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Badge className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-foreground/60">
              Internal dashboard
            </Badge>
            {role === "superuser" ? (
              <Badge className="ml-2 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-amber-300">
                Superuser
              </Badge>
            ) : null}
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">
              Blink metrics
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {lastFetched && (
              <span className="text-xs text-foreground/35">
                Updated {lastFetched.toLocaleTimeString()}
              </span>
            )}
            <button
              type="button"
              onClick={() =>
                void fetchStats({
                  syncHyperliquid: true,
                  includeAttribution: true,
                })
              }
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-[10px] border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-foreground/70 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              Refresh (full)
            </button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
          {[
            {
              label: "Total approvals",
              value: loading ? "—" : String(stats?.totalApprovals ?? 0),
              sub: "all time",
            },
            {
              label: "Last 24h",
              value: loading ? "—" : String(stats?.approvalsSince24h ?? 0),
              sub: "new approvals",
            },
            {
              label: "Builder revenue",
              value: loading
                ? "—"
                : formatMoney(stats?.builder.totalRevenueUsd ?? 0),
              sub: "last 90d (est.)",
            },
            {
              label: "Routed volume",
              value: loading
                ? "—"
                : formatCompact(stats?.builder.totalVolumeUsd ?? 0),
              sub: "last 90d",
            },
          ].map((card) => (
            <div key={card.label} className="glass-panel p-5">
              <p className="terminal-label">{card.label}</p>
              <p className="mt-3 text-4xl font-semibold text-white">
                {loading && card.value === "—" ? (
                  <Loader2 className="inline size-5 animate-spin text-foreground/40" />
                ) : (
                  card.value
                )}
              </p>
              <p className="mt-1 text-xs text-foreground/40">{card.sub}</p>
            </div>
          ))}
            </div>
            <div className="grid gap-4 md:grid-cols-4">
          {[
            {
              label: "Total users",
              value: loading ? "—" : String(stats?.builder.totalUsers ?? 0),
              sub: "approved wallets",
            },
            {
              label: "Avg revenue / user",
              value: loading
                ? "—"
                : formatMoney(stats?.builder.avgRevenuePerUser ?? 0),
              sub: "90d window",
            },
            {
              label: "Active Pro",
              value: loading ? "—" : String(stats?.activeProMembers ?? 0),
              sub: "subscriptions",
            },
            {
              label: "Total referrals",
              value: loading ? "—" : String(stats?.totalReferrals ?? 0),
              sub: "claimed",
            },
          ].map((card) => (
            <div key={card.label} className="glass-panel p-5">
              <p className="terminal-label">{card.label}</p>
              <p className="mt-3 text-3xl font-semibold text-white">{card.value}</p>
              <p className="mt-1 text-xs text-foreground/40">{card.sub}</p>
            </div>
          ))}
            </div>
          </div>

          <section className="glass-panel p-5">
            <p className="terminal-label">Builder overview</p>
            <p className="mt-3 font-mono text-sm text-white/80">
              {truncateAddress(stats?.builder.address ?? "")}
            </p>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between text-foreground/60">
                <span>Revenue (90d)</span>
                <span className="text-white">{formatMoney(stats?.builder.totalRevenueUsd ?? 0)}</span>
              </div>
              <div className="flex justify-between text-foreground/60">
                <span>Volume (90d)</span>
                <span className="text-white">{formatCompact(stats?.builder.totalVolumeUsd ?? 0)}</span>
              </div>
              <div className="flex justify-between text-foreground/60">
                <span>Fills</span>
                <span className="text-white">{stats?.builder.fillsCount ?? 0}</span>
              </div>
              <div className="flex justify-between text-foreground/60">
                <span>Avg rev / user</span>
                <span className="text-white">{formatMoney(stats?.builder.avgRevenuePerUser ?? 0)}</span>
              </div>
            </div>
          </section>
        </div>

        <section className="glass-card mt-6 p-5">
          <h2 className="text-base font-semibold text-white">Feature flags</h2>
          <p className="mt-1 text-xs text-foreground/45">
            Runtime controls for growth and monetization behavior.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {(stats?.featureFlags ?? []).map((flag) => (
              <div
                key={flag.key}
                className="rounded-[12px] border border-white/10 bg-white/[0.03] p-4"
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

        <section className="glass-card mt-6 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">
              Daily revenue + volume (Hyperliquid sync)
            </h2>
            <span className="text-xs text-foreground/40">90d</span>
          </div>
          <div className="h-[300px]">
            <ChartContainer config={chartConfig} className="h-full w-full">
              <AreaChart
                accessibilityLayer
                data={stats?.builder.series ?? []}
                margin={{ left: 4, right: 4, top: 6, bottom: 2 }}
              >
                <defs>
                  <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="fillVolume" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-volume)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="var(--color-volume)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#1a2437" strokeDasharray="2 8" />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
                <Area
                  dataKey="revenue"
                  type="monotone"
                  fill="url(#fillRevenue)"
                  stroke="var(--color-revenue)"
                  strokeWidth={2}
                />
                <Area
                  dataKey="volume"
                  type="monotone"
                  fill="url(#fillVolume)"
                  stroke="var(--color-volume)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </div>
        </section>

        <section className="glass-card mt-6 p-5">
          <h2 className="text-base font-semibold text-white">7d conversion funnel</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            {[
              { label: "Signups", value: stats?.funnel.signups ?? 0 },
              {
                label: "Builder approved",
                value: stats?.funnel.approvedBuilder ?? 0,
              },
              { label: "First trade", value: stats?.funnel.firstTrade ?? 0 },
              { label: "Pro started", value: stats?.funnel.proStarted ?? 0 },
            ].map((f) => (
              <div
                key={f.label}
                className="rounded-[12px] border border-white/10 bg-white/[0.03] p-4"
              >
                <p className="text-xs uppercase tracking-[0.12em] text-foreground/45">
                  {f.label}
                </p>
                <p className="mt-2 text-3xl font-semibold text-white">{f.value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="glass-card mt-6 p-5">
          <h2 className="text-base font-semibold text-white">Weekly cohorts (pipeline)</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="text-left text-xs uppercase tracking-[0.12em] text-foreground/45">
                <tr>
                  <th className="pb-2">Week</th>
                  <th className="pb-2">Signups</th>
                  <th className="pb-2">Approved</th>
                  <th className="pb-2">First trade</th>
                  <th className="pb-2">Pro started</th>
                  <th className="pb-2">Signup → Trade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {(stats?.weeklyCohorts ?? []).slice(-8).map((row) => {
                  const conversion =
                    row.signups > 0 ? (row.firstTrade / row.signups) * 100 : 0;
                  return (
                    <tr key={row.week}>
                      <td className="py-2 font-mono text-foreground/75">{row.week}</td>
                      <td className="py-2">{row.signups}</td>
                      <td className="py-2">{row.approvedBuilder}</td>
                      <td className="py-2">{row.firstTrade}</td>
                      <td className="py-2">{row.proStarted}</td>
                      <td className="py-2 text-emerald-300">{conversion.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="glass-card mt-6 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">
              Live builder fill revenue
            </h2>
            <span className="text-xs text-foreground/45">
              Polling every 8s · last {stats?.builder.live.windowMinutes ?? 30}m
            </span>
          </div>
          <div className="mb-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-[10px] border border-white/10 bg-white/[0.03] px-3 py-2">
              <p className="text-[11px] uppercase tracking-[0.12em] text-foreground/45">
                Revenue (window)
              </p>
              <p className="mt-1 text-xl font-semibold text-emerald-300">
                {formatMoney(stats?.builder.live.totals.revenueUsd ?? 0)}
              </p>
            </div>
            <div className="rounded-[10px] border border-white/10 bg-white/[0.03] px-3 py-2">
              <p className="text-[11px] uppercase tracking-[0.12em] text-foreground/45">
                Notional (window)
              </p>
              <p className="mt-1 text-xl font-semibold text-white">
                {formatCompact(stats?.builder.live.totals.notionalUsd ?? 0)}
              </p>
            </div>
            <div className="rounded-[10px] border border-white/10 bg-white/[0.03] px-3 py-2">
              <p className="text-[11px] uppercase tracking-[0.12em] text-foreground/45">
                Fills (window)
              </p>
              <p className="mt-1 text-xl font-semibold text-white">
                {stats?.builder.live.totals.fillsCount ?? 0}
              </p>
            </div>
          </div>
          <div className="max-h-[360px] overflow-auto rounded-[12px] border border-white/10">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="sticky top-0 bg-[#081126] text-left text-xs uppercase tracking-[0.12em] text-foreground/45">
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
                    <td className={`px-3 py-2 ${fill.side === "buy" ? "text-emerald-300" : "text-rose-300"}`}>
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

        <section className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="glass-card p-5">
            <h2 className="text-base font-semibold text-white">Revenue by source</h2>
            <div className="mt-4 space-y-2">
              {(stats?.builder.attribution.bySource ?? []).slice(0, 8).map((row) => (
                <div
                  key={row.source}
                  className="flex items-center justify-between rounded-[10px] border border-white/8 bg-white/[0.02] px-3 py-2"
                >
                  <div>
                    <p className="text-sm text-white/85">{formatLabel(row.source)}</p>
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

          <div className="glass-card p-5">
            <h2 className="text-base font-semibold text-white">Revenue by country</h2>
            <div className="mt-4 space-y-2">
              {(stats?.builder.attribution.byCountry ?? []).slice(0, 8).map((row) => (
                <div
                  key={row.country}
                  className="flex items-center justify-between rounded-[10px] border border-white/8 bg-white/[0.02] px-3 py-2"
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

          <div className="glass-card p-5">
            <h2 className="text-base font-semibold text-white">Top users</h2>
            <div className="mt-4 space-y-2">
              {(stats?.builder.attribution.byUser ?? []).slice(0, 8).map((row) => (
                <div
                  key={row.walletAddress}
                  className="flex items-center justify-between rounded-[10px] border border-white/8 bg-white/[0.02] px-3 py-2"
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

        {/* Recent approvals table */}
        <section className="glass-card mt-6 overflow-hidden p-0">
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
              {/* Header */}
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

        <div className="mt-6 flex items-center justify-between text-xs text-foreground/30">
          <span>
            Allowlisted as{" "}
            <span className="font-mono">{truncateAddress(walletAddress)}</span>
          </span>
          <Link href="/trade/BTC" className="transition hover:text-foreground/60">
            ← Back to terminal
          </Link>
        </div>
      </div>
    </main>
  );
}
