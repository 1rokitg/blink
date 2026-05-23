"use client";

import { useCallback, useEffect, useState } from "react";

import Link from "next/link";

import { useWallets } from "@privy-io/react-auth";
import { Loader2, RefreshCw } from "lucide-react";

import { Badge } from "@acme/ui/badge";

import { getAdminStats, type AdminStats } from "~/app/actions/get-admin-stats";

function readAdminAllowlist() {
  const source = process.env.NEXT_PUBLIC_ADMIN_WALLET_ALLOWLIST ?? "";
  return source
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
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

export function AdminDashboard() {
  const { wallets } = useWallets();
  const walletAddress = wallets[0]?.address?.toLowerCase() ?? "";
  const isAllowed = walletAddress
    ? readAdminAllowlist().includes(walletAddress)
    : false;

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAdminStats();
      setStats(data);
      setLastFetched(new Date());
    } catch (err) {
      console.error("[admin] Failed to load stats:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAllowed) {
      void fetchStats();
    }
  }, [fetchStats, isAllowed]);

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
            {walletAddress && (
              <p className="mt-3 font-mono text-sm text-foreground/45">
                Connected: {walletAddress}
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
              onClick={() => void fetchStats()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-[10px] border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-foreground/70 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
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

        {/* Stat cards */}
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
              label: "Last 7d",
              value: loading ? "—" : String(stats?.approvalsSince7d ?? 0),
              sub: "new approvals",
            },
            {
              label: "Routed volume",
              value: "—",
              sub: "HL query coming",
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
