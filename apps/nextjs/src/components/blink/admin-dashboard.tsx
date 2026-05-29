"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { usePrivy, useWallets } from "@privy-io/react-auth";
import {
  AlertTriangle,
  ArrowUpRight,
  Loader2,
  Radio,
  RefreshCw,
  Search,
  Wrench,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
} from "recharts";
import { toast } from "sonner";

import { Badge } from "@acme/ui/badge";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@acme/ui/chart";
import { Switch } from "@acme/ui/switch";

import {
  type AdminAccessResult,
  getAdminAccess,
} from "~/app/actions/get-admin-access";
import { type AdminStats, getAdminStats } from "~/app/actions/get-admin-stats";
import { setFeatureFlagAction } from "~/app/actions/set-feature-flag";
import { DEFAULT_ADMIN_OVERVIEW_RANGE } from "~/lib/blink/admin-dashboard-defaults";
import { BUILDER_ADDRESS } from "~/lib/blink/builder";
import { getInternalUserPath } from "~/lib/blink/wallet-address";
import type { AdminMetricsWindow, AdminRange } from "./admin-dashboard-types";
import { InternalAccessCheckpoint } from "./internal-access-checkpoint";
import { InternalAttributionPanel } from "./internal-attribution-panel";
import {
  ChartSkeleton,
  DashboardOverviewSkeleton,
  InternalDashboardShell,
  type InternalNavItem,
  InternalSection,
  InternalStatCard,
  StatGridSkeleton,
  TableRowsSkeleton,
  internalLabelClass,
  internalPanelClass,
  internalPanelInsetClass,
} from "./internal-dashboard-primitives";
import { InternalLiveActivityFeed } from "./internal-live-activity-feed";
import { InternalMembershipsPanel } from "./internal-memberships-panel";
import { SuperuserPanel } from "./superuser-panel";

const TODAY_KPI_LABELS = new Set([
  "Builder revenue",
  "Routed volume",
  "Fills",
  "Active traders",
]);

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

function countryWithFlag(value: string | null | undefined) {
  if (!value) return "—";
  const code = value.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return value;
  const flag = String.fromCodePoint(
    ...code.split("").map((char) => 127397 + char.charCodeAt(0)),
  );
  return `${flag} ${code}`;
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

function issueTypeBadge(type: "issue_auto" | "issue_feedback") {
  if (type === "issue_feedback") {
    return (
      <Badge className="rounded-full border border-amber-400/35 bg-amber-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-amber-300">
        User report
      </Badge>
    );
  }

  return (
    <Badge className="rounded-full border border-rose-400/30 bg-rose-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-rose-300">
      Auto log
    </Badge>
  );
}

type NavItem = {
  label: string;
  href: string;
  soon?: boolean;
  icon?: typeof Wrench;
};
const ADMIN_RANGE_OPTIONS: Array<{
  value: AdminRange;
  label: string;
  windowDays: AdminMetricsWindow;
  liveMinutes: number;
}> = [
  { value: "5m", label: "5m", windowDays: 1, liveMinutes: 5 },
  { value: "15m", label: "15m", windowDays: 1, liveMinutes: 15 },
  { value: "1h", label: "1h", windowDays: 1, liveMinutes: 60 },
  { value: "1d", label: "Today", windowDays: 1, liveMinutes: 60 },
  { value: "7d", label: "7d", windowDays: 7, liveMinutes: 180 },
  { value: "30d", label: "30d", windowDays: 30, liveMinutes: 360 },
  { value: "90d", label: "90d", windowDays: 90, liveMinutes: 720 },
  { value: "lifetime", label: "Lifetime", windowDays: "lifetime", liveMinutes: 720 },
];

const INTERNAL_NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/internal" },
  { label: "Status", href: "/status" },
  { label: "Feed", href: "/internal/feed", icon: Radio },
  { label: "Tools", href: "/internal/tools", icon: Wrench },
  { label: "Affiliates", href: "/internal/affiliates" },
  { label: "Users", href: "/internal/users" },
  { label: "Payments", href: "#", soon: true },
  { label: "Memberships", href: "/internal/memberships" },
  { label: "Referrals", href: "#", soon: true },
  { label: "Settings", href: "#", soon: true },
];

function getRangeConfig(range: AdminRange) {
  const found = ADMIN_RANGE_OPTIONS.find((option) => option.value === range);
  if (found) return found;
  return ADMIN_RANGE_OPTIONS[0] as (typeof ADMIN_RANGE_OPTIONS)[number];
}

export function AdminDashboard(props?: {
  section?: "overview" | "users" | "feed" | "memberships";
  initialUserAddress?: string;
  /** SSR overview payload from InternalDashboardOverviewPage. */
  initialOverviewStats?: AdminStats;
}) {
  const pathname = usePathname();
  const { user } = usePrivy();
  const { wallets } = useWallets();
  const connectedWallets = useMemo(
    () =>
      wallets
        .map((wallet) => wallet.address?.toLowerCase())
        .filter((address): address is string => Boolean(address)),
    [wallets],
  );
  const identityEmails = useMemo(
    () =>
      [user?.email?.address, user?.google?.email].filter(
        (email): email is string => Boolean(email),
      ),
    [user],
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
        const access = await getAdminAccess(connectedWallets, identityEmails);
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
  }, [connectedWallets, identityEmails]);

  const walletAddress = adminAccess.walletAddress || connectedWallets[0] || "";
  const isAllowed = adminAccess.allowed;
  const role = adminAccess.role;

  const [stats, setStats] = useState<AdminStats | null>(
    props?.initialOverviewStats ?? null,
  );
  const [loading, setLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState<Date | null>(() =>
    props?.initialOverviewStats?.syncedAt
      ? new Date(props.initialOverviewStats.syncedAt)
      : null,
  );
  const [flagSaving, setFlagSaving] = useState<string | null>(null);
  const [selectedRange, setSelectedRange] = useState<AdminRange>(
    DEFAULT_ADMIN_OVERVIEW_RANGE,
  );
  const skipInitialOverviewFetchRef = useRef(
    Boolean(props?.initialOverviewStats),
  );
  const currentSection = props?.section ?? "overview";
  const flowscanUrl = useMemo(
    () =>
      `https://www.flowscan.xyz/builders/${encodeURIComponent(BUILDER_ADDRESS)}?range=7d`,
    [],
  );
  const navItems = useMemo(
    () =>
      INTERNAL_NAV_ITEMS.map((item) => ({
        ...item,
        active:
          item.href === "/internal"
            ? currentSection === "overview"
            : item.href === "/internal/users"
              ? currentSection === "users" &&
                pathname.startsWith("/internal/users")
              : item.href === "/internal/feed"
                ? currentSection === "feed" ||
                  pathname.startsWith("/internal/feed")
                : item.href === "/internal/memberships"
                  ? currentSection === "memberships" ||
                    pathname.startsWith("/internal/memberships")
                  : item.href !== "#" && pathname === item.href,
      })),
    [currentSection, pathname],
  );

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
          includeAttribution: options?.includeAttribution ?? true,
          liveWindowMinutes: rangeConfig.liveMinutes,
          liveLimit: 120,
          windowDays: rangeConfig.windowDays,
        });
        setStats((prev) => {
          if (options?.includeAttribution === false && prev?.builder.attribution) {
            return {
              ...data,
              builder: {
                ...data.builder,
                attribution: prev.builder.attribution,
              },
            };
          }
          return data;
        });
        setLastFetched(new Date());
      } catch (err) {
        console.error("[admin] Failed to load stats:", err);
        toast.error(
          err instanceof Error
            ? err.message
            : "Failed to refresh dashboard stats.",
        );
      } finally {
        if (!options?.isBackground) {
          setLoading(false);
        }
      }
    },
    [selectedRange],
  );

  useEffect(() => {
    if (!isAllowed || currentSection !== "overview") return;
    if (skipInitialOverviewFetchRef.current) {
      skipInitialOverviewFetchRef.current = false;
      return;
    }
    void fetchStats({ syncHyperliquid: true, includeAttribution: true });
  }, [currentSection, fetchStats, isAllowed]);

  useEffect(() => {
    if (!isAllowed || currentSection !== "overview") return;
    const id = setInterval(() => {
      void fetchStats({
        includeAttribution: false,
        isBackground: true,
      });
    }, 8_000);
    return () => clearInterval(id);
  }, [currentSection, fetchStats, isAllowed]);

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

  const growthChartConfig = {
    dau: { label: "DAU (routed)", color: "#67e8f9" },
    signups: { label: "Signups", color: "#a78bfa" },
    firstTrade: { label: "First trade", color: "#fbbf24" },
    builderApproved: { label: "Builder fee", color: "#60a5fa" },
    tradingEnabled: { label: "Trading enabled", color: "#9ec0ff" },
  } satisfies ChartConfig;

  const statsCards = useMemo(() => {
    if (!stats) return [];
    const all = [
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
        label: "Builder fee",
        value: String(stats.funnel.approvedBuilder),
        source: stats.kpiSource.builderApprovals,
      },
      {
        label: "Trading enabled",
        value: String(stats.funnel.tradingEnabled),
        source: stats.kpiSource.tradingEnabled,
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
    return all.filter((card) => !TODAY_KPI_LABELS.has(card.label));
  }, [stats]);

  const initialLoading = !stats && loading && !props?.initialOverviewStats;
  const isRefreshing = Boolean(stats && loading);

  const showAccessCheckpoint = checkingAccess && !props?.initialOverviewStats;

  if (showAccessCheckpoint) {
    return <InternalAccessCheckpoint label="Internal Security" />;
  }

  const shellNavItems: InternalNavItem[] = navItems;

  if (!checkingAccess && !isAllowed) {
    return (
      <main className="min-h-screen bg-[#09090b] px-6 py-8 text-foreground">
        <div className="mx-auto max-w-3xl">
          <section className={`${internalPanelClass} p-8`}>
            <Badge className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[11px] font-medium text-white/55">
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

  if (currentSection === "users") {
    return (
      <InternalDashboardShell
        navItems={shellNavItems}
        header={
          <>
            <div className="flex items-center gap-2">
              <Badge className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs font-medium text-white/55">
                Users
              </Badge>
              {role === "superuser" ? (
                <Badge className="rounded-full border border-amber-400/35 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-200">
                  Superuser
                </Badge>
              ) : null}
            </div>
            <a
              href={flowscanUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#3b6ff5] px-3 text-sm font-medium text-white transition hover:bg-[#4a7aff]"
            >
              Flowscan
              <ArrowUpRight className="size-3.5" />
            </a>
          </>
        }
      >
        <section className={`${internalPanelClass} p-5`}>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            User control center
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/50">
            Search wallets or referral codes, then inspect builder approvals,
            sessions, social identity, and superuser controls.
          </p>
        </section>

        <div className="mt-5">
          {role === "superuser" && walletAddress ? (
            <SuperuserPanel
              actingWalletAddress={walletAddress}
              initialWalletAddress={props?.initialUserAddress}
            />
          ) : (
            <section className={`${internalPanelClass} p-5`}>
              <p className="text-sm leading-6 text-white/50">
                Superuser access is required for fingerprint data and override
                controls.
              </p>
            </section>
          )}
        </div>
      </InternalDashboardShell>
    );
  }

  if (currentSection === "memberships") {
    return (
      <InternalDashboardShell
        navItems={shellNavItems}
        header={
          <>
            <div className="flex items-center gap-2">
              <Badge className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs font-medium text-white/55">
                Memberships
              </Badge>
              {role === "superuser" ? (
                <Badge className="rounded-full border border-amber-400/35 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-200">
                  Superuser
                </Badge>
              ) : null}
            </div>
            <p className="text-xs text-white/45">
              {truncateAddress(walletAddress)}
            </p>
          </>
        }
      >
        <InternalMembershipsPanel
          actingWalletAddress={walletAddress}
          canManage={role === "superuser"}
        />
      </InternalDashboardShell>
    );
  }

  if (currentSection === "feed") {
    return (
      <InternalDashboardShell
        navItems={shellNavItems}
        header={
          <>
            <div className="flex items-center gap-2">
              <Badge className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs font-medium text-white/55">
                Live feed
              </Badge>
              {role === "superuser" ? (
                <Badge className="rounded-full border border-amber-400/35 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-200">
                  Superuser
                </Badge>
              ) : null}
            </div>
            <p className="text-xs text-white/45">
              {truncateAddress(walletAddress)}
            </p>
          </>
        }
      >
        <InternalLiveActivityFeed
          actingWalletAddress={walletAddress}
          canGift={role === "superuser"}
        />
      </InternalDashboardShell>
    );
  }

  return (
    <InternalDashboardShell
      navItems={shellNavItems}
      header={
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs font-medium text-white/55">
              Dashboard
            </Badge>
            {role === "superuser" ? (
              <Badge className="rounded-full border border-amber-400/35 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-200">
                Superuser
              </Badge>
            ) : null}
          </div>

          <div className="relative hidden min-w-[200px] flex-1 md:block md:max-w-[360px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/30" />
            <input
              placeholder="Search users, wallets…"
              className="h-9 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/30"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={flowscanUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#3b6ff5] px-3 text-sm font-medium text-white transition hover:bg-[#4a7aff]"
            >
              Flowscan
              <ArrowUpRight className="size-3.5" />
            </a>
            <select
              value={selectedRange}
              onChange={(event) =>
                setSelectedRange(event.target.value as AdminRange)
              }
              className="h-9 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-white outline-none"
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
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-white/70 transition hover:bg-white/[0.07] hover:text-white disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              Refresh
            </button>
          </div>
        </>
      }
    >
      {initialLoading ? (
        <DashboardOverviewSkeleton />
      ) : (
        <div
          className={`space-y-0 transition-opacity ${isRefreshing ? "opacity-60" : ""}`}
        >
          <section className={`${internalPanelClass} p-5`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                Today
              </h1>
              <p className={`${internalLabelClass} text-white/38`}>
                HL sync {stats?.hyperliquidSync.freshness ?? "unknown"} ·{" "}
                {stats ? timeAgo(stats.hyperliquidSync.lastSyncedAt) : "—"}
              </p>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <InternalStatCard
                label="Builder revenue"
                value={stats ? formatMoney(stats.today.revenueUsd) : "—"}
                hint={
                  stats
                    ? `Yesterday ${formatMoney(stats.today.yesterdayRevenueUsd)}`
                    : undefined
                }
              />
              <InternalStatCard
                label="Routed volume"
                value={stats ? formatCompact(stats.today.volumeUsd) : "—"}
                hint={
                  stats
                    ? `Yesterday ${formatCompact(stats.today.yesterdayVolumeUsd)}`
                    : undefined
                }
              />
              <InternalStatCard
                label="Active routed users"
                value={stats?.today.activeUsers ?? 0}
                hint="Today"
              />
              <InternalStatCard
                label="Fills (live window)"
                value={stats?.today.fillsCount ?? 0}
                hint={`${stats?.builder.live.windowMinutes ?? 30}m window`}
              />
            </div>
          </section>

          <section className={`mt-5 ${internalPanelClass} p-5`}>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-white">
                  Growth & subscriptions
                </h2>
                <p className={`mt-1 max-w-2xl ${internalLabelClass}`}>
                  MRR from paying Pro (excludes gifts). DAU = unique routed
                  traders per day.
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3 lg:grid-cols-6">
              <div className="rounded-xl border border-white/10 bg-[#121726] p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-foreground/45">
                  MRR
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {stats ? formatMoney(stats.growth.subscription.mrrUsd) : "—"}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#121726] p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-foreground/45">
                  ARR
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {stats ? formatMoney(stats.growth.subscription.arrUsd) : "—"}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#121726] p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-foreground/45">
                  DRR
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {stats ? formatMoney(stats.growth.subscription.drrUsd) : "—"}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#121726] p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-foreground/45">
                  Churn (30d)
                </p>
                <p className="mt-2 text-2xl font-semibold text-amber-300">
                  {stats
                    ? `${stats.growth.subscription.churnRate30d.toFixed(1)}%`
                    : "—"}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#121726] p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-foreground/45">
                  Paying Pro
                </p>
                <p className="mt-2 text-2xl font-semibold text-emerald-300">
                  {stats?.growth.subscription.payingPro ?? 0}
                </p>
                <p className="mt-1 text-[11px] text-foreground/40">
                  {stats?.growth.subscription.giftedPro ?? 0} gifted
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#121726] p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-foreground/45">
                  New Pro (30d)
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {stats?.growth.subscription.newPro30d ?? 0}
                </p>
                <p className="mt-1 text-[11px] text-foreground/40">
                  {stats?.growth.subscription.churnedPro30d ?? 0} churned
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-[#101523] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">
                    Daily active routed traders
                  </h3>
                  <span className="text-xs text-foreground/45">DAU</span>
                </div>
                <div className="h-[220px]">
                  <ChartContainer
                    config={growthChartConfig}
                    className="h-full w-full"
                  >
                    <AreaChart
                      data={stats?.growth.dailySeries ?? []}
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
                        tickFormatter={(value: string) => value.slice(5)}
                      />
                      <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent indicator="line" />}
                      />
                      <Area
                        type="monotone"
                        dataKey="dau"
                        stroke="var(--color-dau)"
                        fill="var(--color-dau)"
                        fillOpacity={0.18}
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ChartContainer>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-[#101523] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">
                    Signups & activation
                  </h3>
                  <span className="text-xs text-foreground/45">daily</span>
                </div>
                <div className="h-[220px]">
                  <ChartContainer
                    config={growthChartConfig}
                    className="h-full w-full"
                  >
                    <BarChart
                      data={stats?.growth.dailySeries ?? []}
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
                        tickFormatter={(value: string) => value.slice(5)}
                      />
                      <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent indicator="line" />}
                      />
                      <Bar
                        dataKey="signups"
                        fill="var(--color-signups)"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="builderApproved"
                        fill="var(--color-builderApproved)"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="tradingEnabled"
                        fill="var(--color-tradingEnabled)"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="firstTrade"
                        fill="var(--color-firstTrade)"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ChartContainer>
                </div>
              </div>
            </div>
          </section>

          <section className={`mt-5 ${internalPanelClass} p-5`}>
            <h2 className="text-lg font-semibold tracking-tight text-white">
              Funnel & window metrics
            </h2>
            <p className={`mt-1 ${internalLabelClass}`}>
              Window totals for {selectedRange} — today&apos;s headline KPIs are
              above.
            </p>
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
                          {countryWithFlag(row.country)}
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
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-white">
                  Issues inbox
                </h2>
                <p className="mt-1 text-xs text-foreground/45">
                  Automatic wallet / X verification failures plus manual user
                  feedback flowing into the internal event stream.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/18 bg-amber-400/8 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-amber-200">
                <AlertTriangle className="size-3.5" />
                Support signals
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-[#121726] p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-foreground/45">
                  Issue events 24h
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {stats?.issues.total24h ?? 0}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#121726] p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-foreground/45">
                  Auto captured 24h
                </p>
                <p className="mt-2 text-2xl font-semibold text-rose-300">
                  {stats?.issues.auto24h ?? 0}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#121726] p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-foreground/45">
                  User reports 24h
                </p>
                <p className="mt-2 text-2xl font-semibold text-amber-300">
                  {stats?.issues.feedback24h ?? 0}
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {(stats?.issues.recent ?? []).length > 0 ? (
                (stats?.issues.recent ?? []).map((issue) => (
                  <div
                    key={`${issue.createdAt}-${issue.requestId ?? issue.summary}`}
                    className="rounded-xl border border-white/10 bg-[#101523] p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {issueTypeBadge(issue.eventType)}
                          <Badge className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-white/60">
                            {formatLabel(issue.category)}
                          </Badge>
                          <span className="text-xs text-foreground/42">
                            {formatLabel(issue.source)}
                          </span>
                        </div>
                        <p className="mt-3 text-sm font-semibold text-white">
                          {issue.summary}
                        </p>
                        {issue.description ? (
                          <p className="mt-2 text-sm leading-6 text-foreground/62">
                            {issue.description}
                          </p>
                        ) : null}
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-foreground/45">
                          {issue.code ? (
                            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                              Code {issue.code}
                            </span>
                          ) : null}
                          {issue.walletAddress ? (
                            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono">
                              {truncateAddress(issue.walletAddress)}
                            </span>
                          ) : null}
                          {issue.path ? (
                            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                              {issue.path}
                            </span>
                          ) : null}
                          {issue.country ? (
                            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                              {countryWithFlag(issue.country)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="text-right text-xs text-foreground/40">
                        <div>{timeAgo(issue.createdAt)}</div>
                        {issue.requestId ? (
                          <div className="mt-1 font-mono text-[10px] text-foreground/30">
                            {issue.requestId}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-white/10 bg-[#101523] px-4 py-5 text-sm text-foreground/48">
                  No issue reports have been captured yet.
                </div>
              )}
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

          <InternalAttributionPanel
            attribution={stats?.builder.attribution}
            isLoading={initialLoading}
            windowLabel={
              selectedRange === "lifetime" ? "lifetime" : selectedRange
            }
          />

          <InternalSection
            title="Live builder fills"
            description={`Refreshes every 8s · ${stats?.builder.live.windowMinutes ?? 30}m window`}
          >
            {isRefreshing ? (
              <StatGridSkeleton count={3} columns="md:grid-cols-3" />
            ) : (
              <div className="grid gap-3 md:grid-cols-3">
                <InternalStatCard
                  label="Revenue (window)"
                  value={formatMoney(
                    stats?.builder.live.totals.revenueUsd ?? 0,
                  )}
                  tone="positive"
                />
                <InternalStatCard
                  label="Notional (window)"
                  value={formatCompact(
                    stats?.builder.live.totals.notionalUsd ?? 0,
                  )}
                />
                <InternalStatCard
                  label="Fills (window)"
                  value={stats?.builder.live.totals.fillsCount ?? 0}
                />
              </div>
            )}
            <div
              className={`mt-4 max-h-[300px] overflow-auto ${internalPanelInsetClass}`}
            >
              {isRefreshing ? (
                <TableRowsSkeleton rows={4} />
              ) : (
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="sticky top-0 bg-[#16171c] text-left text-xs font-medium text-white/40">
                    <tr>
                      <th className="px-3 py-2.5 font-medium">Time</th>
                      <th className="px-3 py-2.5 font-medium">Wallet</th>
                      <th className="px-3 py-2.5 font-medium">Market</th>
                      <th className="px-3 py-2.5 font-medium">Side</th>
                      <th className="px-3 py-2.5 text-right font-medium">
                        Rev
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {(stats?.builder.live.fills ?? []).map((fill) => (
                      <tr key={fill.tid}>
                        <td className="px-3 py-2.5 text-white/55">
                          {new Date(fill.time).toLocaleTimeString()}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs text-white/70">
                          {truncateAddress(fill.walletAddress)}
                        </td>
                        <td className="px-3 py-2.5 text-white">{fill.coin}</td>
                        <td
                          className={`px-3 py-2.5 capitalize ${fill.side === "buy" ? "text-emerald-400" : "text-rose-400"}`}
                        >
                          {fill.side}
                        </td>
                        <td className="px-3 py-2.5 text-right font-medium text-emerald-400">
                          {formatMoney(fill.builderFeeUsd)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </InternalSection>

          <InternalSection
            title="Recent builder approvals"
            description="Latest unique wallets — one row per wallet."
            action={
              <Link
                href="/internal/feed"
                className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white/75 transition hover:bg-white/[0.06]"
              >
                Live feed →
              </Link>
            }
          >
            {isRefreshing ? (
              <TableRowsSkeleton rows={5} />
            ) : stats?.recentApprovals.length === 0 ? (
              <p
                className={`${internalPanelInsetClass} px-4 py-8 text-center text-sm text-white/40`}
              >
                No approvals recorded yet.
              </p>
            ) : (
              <div className={`${internalPanelInsetClass} overflow-hidden`}>
                <div className="grid grid-cols-[1fr_88px_88px] gap-3 border-b border-white/[0.05] px-4 py-2.5 text-xs font-medium text-white/40">
                  <span>Wallet</span>
                  <span className="text-right">Max fee</span>
                  <span className="text-right">When</span>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {(stats?.recentApprovals ?? []).map((approval) => (
                    <div
                      key={approval.walletAddress}
                      className="grid grid-cols-[1fr_88px_88px] gap-3 px-4 py-3 text-sm"
                    >
                      <Link
                        href={getInternalUserPath(approval.walletAddress)}
                        className="font-mono text-[#6fa8ff] hover:underline"
                      >
                        {truncateAddress(approval.walletAddress)}
                      </Link>
                      <span className="text-right text-white/55">
                        {approval.maxFeeRate}
                      </span>
                      <span className="text-right text-white/40">
                        {timeAgo(approval.approvedAt)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </InternalSection>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-white/35">
        <span>
          {truncateAddress(walletAddress)} · {role}
        </span>
        {lastFetched ? (
          <span>Updated {lastFetched.toLocaleTimeString()}</span>
        ) : null}
        <Link href="/trade/BTC" className="transition hover:text-white/60">
          ← Terminal
        </Link>
      </div>
    </InternalDashboardShell>
  );
}
