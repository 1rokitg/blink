"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import Link from "next/link";

import {
  ArrowUpRight,
  Download,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  Search,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@acme/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@acme/ui/dropdown-menu";

import { getInternalMemberships } from "~/app/actions/get-internal-memberships";
import type {
  InternalMembershipRevenueForecast,
  InternalMembershipRow,
  MembershipLifecycle,
  StripeBillingSnapshot,
  StripeMembershipSyncSummary,
} from "~/lib/blink/internal-memberships.types";
import { getInternalUserPath } from "~/lib/blink/wallet-address";
import {
  InternalSection,
  InternalStatCard,
  internalLabelClass,
  internalPanelClass,
  internalPanelInsetClass,
} from "./internal-dashboard-primitives";
import { InternalMembershipsForecast } from "./internal-memberships-forecast";

type StatusFilter = "all" | "active" | "trial" | "ended" | "gift" | "paid";
type TierFilter = "all" | "basic" | "preferred" | "premium";

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value < 100 ? 2 : 0,
  }).format(value);
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function lifecycleBadgeClass(lifecycle: MembershipLifecycle) {
  switch (lifecycle) {
    case "active":
      return "border-emerald-400/35 bg-emerald-400/10 text-emerald-300";
    case "trial":
      return "border-sky-400/35 bg-sky-400/10 text-sky-200";
    case "expires_soon":
      return "border-amber-400/35 bg-amber-400/10 text-amber-200";
    case "gift":
    case "lifetime":
      return "border-violet-400/35 bg-violet-400/10 text-violet-200";
    case "ended":
      return "border-rose-400/30 bg-rose-400/10 text-rose-300";
    default:
      return "border-white/15 bg-white/5 text-white/55";
  }
}

function paymentLabel(method: string, isTrial: boolean) {
  if (isTrial) return "Trial";
  if (method === "gift") return "Gift";
  if (method === "crypto") return "Crypto";
  if (method === "card") return "Card";
  return method;
}

function matchesStatusFilter(
  row: InternalMembershipRow,
  filter: StatusFilter,
) {
  if (filter === "all") return true;
  if (filter === "active") return row.isActive;
  if (filter === "trial") return row.isTrial;
  if (filter === "ended") return !row.isActive;
  if (filter === "gift") return row.paymentMethod === "gift";
  if (filter === "paid") {
    return row.paymentMethod !== "gift" && row.isActive && !row.isTrial;
  }
  return true;
}

function exportMembershipsCsv(rows: InternalMembershipRow[]) {
  const header = [
    "wallet",
    "display_name",
    "twitter",
    "profile_slug",
    "product",
    "status",
    "payment_method",
    "total_spend_usd",
    "created_at",
    "period_end",
    "stripe_customer_id",
    "stripe_subscription_id",
  ];

  const lines = rows.map((row) =>
    [
      row.walletAddress,
      row.displayName ?? "",
      row.twitterUsername ?? "",
      row.profileSlug ?? "",
      row.productLabel,
      row.statusLabel,
      row.paymentMethod,
      row.totalSpendUsd.toFixed(2),
      row.createdAt,
      row.currentPeriodEnd ?? "",
      row.stripeCustomerId ?? "",
      row.stripeSubscriptionId ?? "",
    ]
      .map((value) => `"${String(value).replaceAll('"', '""')}"`)
      .join(","),
  );

  const blob = new Blob([[header.join(","), ...lines].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `blink-memberships-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function InternalMembershipsPanel(props: {
  actingWalletAddress: string;
  canManage: boolean;
}) {
  const [rows, setRows] = useState<InternalMembershipRow[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    active: 0,
    paying: 0,
    trials: 0,
    gifted: 0,
    mrrUsd: 0,
  });
  const [forecast, setForecast] =
    useState<InternalMembershipRevenueForecast | null>(null);
  const [stripe, setStripe] = useState<StripeBillingSnapshot | null>(null);
  const [stripeSync, setStripeSync] =
    useState<StripeMembershipSyncSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await getInternalMemberships({
        actingWalletAddress: props.actingWalletAddress,
      });
      setRows(payload.rows);
      setSummary(payload.summary);
      setForecast(payload.forecast);
      setStripe(payload.stripe);
      setStripeSync(payload.stripeSync);
      setSyncedAt(payload.syncedAt);
    } catch (error) {
      console.error("[memberships] load failed", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to load memberships.",
      );
    } finally {
      setLoading(false);
    }
  }, [props.actingWalletAddress]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (!matchesStatusFilter(row, statusFilter)) return false;
      if (tierFilter !== "all" && row.tier.toLowerCase() !== tierFilter) {
        return false;
      }
      if (!query) return true;

      return (
        row.walletAddress.includes(query) ||
        row.displayName?.toLowerCase().includes(query) ||
        row.profileSlug?.toLowerCase().includes(query) ||
        row.twitterUsername?.toLowerCase().includes(query) ||
        row.productLabel.toLowerCase().includes(query) ||
        row.stripeCustomerId?.toLowerCase().includes(query) ||
        row.stripeSubscriptionId?.toLowerCase().includes(query)
      );
    });
  }, [rows, search, statusFilter, tierFilter]);

  const filterChips: Array<{ id: StatusFilter; label: string }> = [
    { id: "all", label: "All" },
    { id: "active", label: "Active" },
    { id: "trial", label: "Trials" },
    { id: "paid", label: "Paying" },
    { id: "gift", label: "Gifted" },
    { id: "ended", label: "Ended" },
  ];

  return (
    <div className="space-y-5">
      <section className={`${internalPanelClass} p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              Memberships
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/50">
              Blink Pro entitlements synced from Stripe into Neon on each refresh
              (plus superuser gifts). MRR, ARR, and revenue metrics are sourced
              live from Stripe subscriptions and charges.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => exportMembershipsCsv(filteredRows)}
              disabled={filteredRows.length === 0}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-white/75 transition hover:bg-white/[0.06] disabled:opacity-40"
            >
              <Download className="size-3.5" />
              Export
            </button>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#3b6ff5] px-3 text-sm font-medium text-white transition hover:bg-[#4a7aff] disabled:opacity-60"
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
        {syncedAt ? (
          <p className="mt-3 text-xs text-white/35">
            Stripe synced {timeAgo(syncedAt)}
            {stripeSync
              ? ` · ${stripeSync.upserted} membership rows updated (${stripeSync.scanned} subs scanned)`
              : null}
            {props.canManage ? " · superuser can gift from user console" : null}
          </p>
        ) : null}
      </section>

      {stripe ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <InternalStatCard
            label="Stripe MRR"
            value={formatMoney(stripe.mrrUsd)}
            hint={`${stripe.activeSubscriptions} active subs`}
            tone="positive"
          />
          <InternalStatCard
            label="Stripe ARR"
            value={formatMoney(stripe.arrUsd)}
            hint="Live subscription run-rate"
          />
          <InternalStatCard
            label="Revenue (30d)"
            value={formatMoney(stripe.revenue30dUsd)}
            hint={`${formatMoney(stripe.revenueLifetimeUsd)} lifetime`}
          />
          <InternalStatCard
            label="Stripe customers"
            value={stripe.totalCustomers}
            hint={`${stripe.trialingSubscriptions} trialing · ${stripe.pastDueSubscriptions} past due`}
          />
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <InternalStatCard label="Total" value={summary.total} />
        <InternalStatCard
          label="Active"
          value={summary.active}
          tone="positive"
        />
        <InternalStatCard label="Trials" value={summary.trials} />
        <InternalStatCard label="Paying" value={summary.paying} />
        <InternalStatCard label="Gifted" value={summary.gifted} />
        <InternalStatCard
          label={stripe ? "Neon MRR (gift-adjusted)" : "Est. MRR"}
          value={formatMoney(summary.mrrUsd)}
          hint={
            stripe
              ? "Headline uses Stripe MRR above"
              : "Paying only (excludes trials)"
          }
        />
      </div>

      {stripe && stripe.recentTransactions.length > 0 ? (
        <InternalSection
          title="Recent Stripe charges"
          description="Latest successful charges from Stripe (live)."
        >
          <div className={`overflow-x-auto ${internalPanelInsetClass}`}>
            <table className="min-w-[640px] w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-xs text-white/40">
                  <th className="px-4 py-3 font-medium">When</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                </tr>
              </thead>
              <tbody>
                {stripe.recentTransactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className="border-b border-white/[0.04] text-white/75"
                  >
                    <td className="px-4 py-3 text-white/55">
                      {timeAgo(tx.createdAt)}
                    </td>
                    <td className="px-4 py-3 font-medium text-white">
                      {formatMoney(tx.amountUsd)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-white/45">
                      {tx.customerId
                        ? `${tx.customerId.slice(0, 10)}…`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-white/55">
                      {tx.description ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </InternalSection>
      ) : null}

      {forecast || loading ? (
        <InternalMembershipsForecast
          forecast={
            forecast ?? {
              currentMrrUsd: summary.mrrUsd,
              arrUsd: summary.mrrUsd * 12,
              trialPipelineMrrUsd: 0,
              trialsEndingWithin7d: 0,
              pipelineEndingWithin7dMrrUsd: 0,
              mrrByTier: [],
              scenarios: [],
              assumptions: [],
            }
          }
          loading={loading && !forecast}
        />
      ) : null}

      <InternalSection
        title="All memberships"
        description="Whop-style ledger of Blink Pro wallets. Email is not stored in Neon — use X handle or profile slug when available."
        action={
          <div className="relative min-w-[220px] flex-1 md:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/30" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search wallet, @x, slug…"
              className="h-9 w-full rounded-xl border border-white/10 bg-white/[0.03] pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-white/20"
            />
          </div>
        }
      >
        <div className="mb-4 flex flex-wrap gap-2">
          {filterChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setStatusFilter(chip.id)}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                statusFilter === chip.id
                  ? "border-white/25 bg-white/10 text-white"
                  : "border-white/10 bg-white/[0.02] text-white/50 hover:text-white/80"
              }`}
            >
              {chip.label}
            </button>
          ))}
          <span className="mx-1 hidden h-6 w-px self-center bg-white/10 sm:inline" />
          {(["all", "basic", "preferred", "premium"] as const).map((tier) => (
            <button
              key={tier}
              type="button"
              onClick={() => setTierFilter(tier)}
              className={`rounded-full border px-3 py-1 text-xs capitalize transition ${
                tierFilter === tier
                  ? "border-sky-400/35 bg-sky-400/10 text-sky-200"
                  : "border-white/10 bg-white/[0.02] text-white/50 hover:text-white/80"
              }`}
            >
              {tier === "all" ? "All tiers" : tier}
            </button>
          ))}
        </div>

        <div className={`overflow-x-auto ${internalPanelInsetClass}`}>
          <table className="min-w-[960px] w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-xs text-white/40">
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Identity</th>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Total spend</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Ended</th>
                <th className="px-4 py-3 font-medium">Payment</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-10 text-center text-white/45"
                  >
                    <Loader2 className="mx-auto mb-2 size-5 animate-spin" />
                    Loading memberships…
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-10 text-center text-white/45"
                  >
                    No memberships match these filters.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const userLabel =
                    row.profileSlug ??
                    row.twitterUsername ??
                    row.displayName ??
                    truncateAddress(row.walletAddress);
                  const userPath = getInternalUserPath(
                    row.profileSlug ?? row.walletAddress,
                  );

                  return (
                    <tr
                      key={row.walletAddress}
                      className="border-b border-white/[0.04] transition hover:bg-white/[0.02]"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/8 text-xs font-semibold text-white/70">
                            {(row.twitterUsername ??
                              row.displayName ??
                              row.walletAddress)[0]?.toUpperCase() ?? "?"}
                          </div>
                          <div className="min-w-0">
                            <Link
                              href={userPath}
                              className="font-medium text-white hover:text-sky-300"
                            >
                              {userLabel}
                            </Link>
                            <p className="font-mono text-xs text-white/35">
                              {truncateAddress(row.walletAddress)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-white/55">
                        {row.twitterUsername ? (
                          <span>@{row.twitterUsername}</span>
                        ) : row.displayName ? (
                          <span>{row.displayName}</span>
                        ) : (
                          <span className="text-white/30">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-white/80">
                        {row.productLabel}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${lifecycleBadgeClass(row.lifecycle)}`}
                        >
                          {row.statusLabel}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-white/80">
                        {row.paymentMethod === "gift" || row.isTrial
                          ? "—"
                          : formatMoney(row.totalSpendUsd)}
                      </td>
                      <td className="px-4 py-3 text-white/55">
                        <span title={formatTimestamp(row.createdAt)}>
                          {timeAgo(row.createdAt)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white/55">
                        {row.canceledAt ? (
                          <span title={formatTimestamp(row.canceledAt)}>
                            {timeAgo(row.canceledAt)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={internalLabelClass}>
                          {paymentLabel(row.paymentMethod, row.isTrial)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="inline-flex size-8 items-center justify-center rounded-lg text-white/45 transition hover:bg-white/[0.06] hover:text-white"
                              aria-label="Membership actions"
                            >
                              <MoreHorizontal className="size-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="border-white/10 bg-[#17181f] text-white"
                          >
                            <DropdownMenuItem asChild>
                              <Link
                                href={userPath}
                                className="flex items-center gap-2"
                              >
                                Open user console
                                <ArrowUpRight className="size-3.5" />
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link
                                href={`/profile/${row.profileSlug ?? row.walletAddress}`}
                                target="_blank"
                                className="flex items-center gap-2"
                              >
                                Public profile
                                <ArrowUpRight className="size-3.5" />
                              </Link>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs text-white/35">
          Showing {filteredRows.length} of {rows.length} memberships
        </p>
      </InternalSection>
    </div>
  );
}
