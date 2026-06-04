"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import Link from "next/link";

import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Gift,
  Loader2,
  Radio,
  UserPlus,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@acme/ui/badge";

import {
  type LiveActivityFeedPage,
  getLiveActivityFeed,
} from "~/app/actions/get-live-activity-feed";
import { giftBlinkMembershipAction } from "~/app/actions/manage-superuser-wallet";

type LiveFilter = "all" | "signup" | "builder_approved" | "trading_enabled" | "first_trade";

const FILTERS: Array<{ id: LiveFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "signup", label: "Signup" },
  { id: "builder_approved", label: "Builder fee" },
  { id: "trading_enabled", label: "Trading enabled" },
  { id: "first_trade", label: "First trade" },
];

const EVENT_META = {
  signup: {
    badgeClass: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
    className: "text-emerald-300",
    icon: UserPlus,
    label: "Signup",
  },
  builder_approved: {
    badgeClass: "border-sky-400/25 bg-sky-400/10 text-sky-200",
    className: "text-sky-300",
    icon: CheckCircle2,
    label: "Builder fee",
  },
  trading_enabled: {
    badgeClass: "border-blue-400/25 bg-blue-400/10 text-blue-200",
    className: "text-blue-300",
    icon: Zap,
    label: "Trading enabled",
  },
  first_trade: {
    badgeClass: "border-amber-400/25 bg-amber-400/10 text-amber-200",
    className: "text-amber-300",
    icon: Zap,
    label: "First trade",
  },
} as const;

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function formatLabel(input: string) {
  if (!input) return "Unknown";
  return input
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function timeAgo(value: string) {
  const deltaMs = Date.now() - new Date(value).getTime();
  const seconds = Math.max(1, Math.floor(deltaMs / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function InternalLiveActivityFeed(props: {
  actingWalletAddress: string;
  emailAddresses?: string[];
  canGift: boolean;
}) {
  const [filter, setFilter] = useState<LiveFilter>("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<LiveActivityFeedPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [giftingWallet, setGiftingWallet] = useState<string | null>(null);

  const fetchPage = useCallback(async () => {
    setLoading(true);
    try {
      const next = await getLiveActivityFeed({
        actingWalletAddress: props.actingWalletAddress,
        emailAddresses: props.emailAddresses,
        page,
        pageSize: 25,
      });
      setData(next);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load live activity.",
      );
    } finally {
      setLoading(false);
    }
  }, [page, props.actingWalletAddress, props.emailAddresses]);

  useEffect(() => {
    void fetchPage();
  }, [fetchPage]);

  const filteredItems = useMemo(() => {
    if (!data) return [];
    if (filter === "all") return data.items;
    return data.items.filter((item) => item.eventType === filter);
  }, [data, filter]);

  const summaryRows = useMemo(() => {
    if (!data) return [];
    const counts = data.summary.byEventType;
    const total = Math.max(
      1,
      Object.values(counts).reduce((sum, value) => sum + value, 0),
    );
    return (Object.keys(EVENT_META) as Array<keyof typeof EVENT_META>).map(
      (eventType) => ({
        count: counts[eventType] ?? 0,
        eventType,
        pct: ((counts[eventType] ?? 0) / total) * 100,
      }),
    );
  }, [data]);

  async function giftBasic(walletAddress: string) {
    setGiftingWallet(walletAddress);
    try {
      const result = await giftBlinkMembershipAction({
        actingWalletAddress: props.actingWalletAddress,
        durationDays: 30,
        targetWalletAddress: walletAddress,
        tier: "basic",
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Gifted 1 month basic to ${truncateAddress(walletAddress)}.`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to gift membership.",
      );
    } finally {
      setGiftingWallet(null);
    }
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-[#0b0d13]">
      <div className="border-b border-white/8 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Radio className="size-4 text-emerald-300" />
              <h2 className="text-lg font-semibold text-white">Live activity feed</h2>
            </div>
            <p className="mt-1 max-w-2xl text-xs text-foreground/45">
              Dedicated stream with pagination, event mix, and one-click internal actions.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setFilter(option.id)}
                className={`rounded-full border px-3 py-1 text-[11px] font-medium transition ${
                  filter === option.id
                    ? "border-white/20 bg-white/10 text-white"
                    : "border-white/10 bg-white/[0.03] text-foreground/55 hover:text-white/80"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-3 border-b border-white/8 p-4 md:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-[#101523] p-3">
          <p className="mb-2 text-xs uppercase tracking-[0.12em] text-foreground/45">
            Event mix
          </p>
          <div className="space-y-2">
            {summaryRows.map((row) => (
              <div key={row.eventType}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className={EVENT_META[row.eventType].className}>
                    {EVENT_META[row.eventType].label}
                  </span>
                  <span className="text-foreground/65">{row.count}</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/8">
                  <div
                    className={`h-full rounded-full ${EVENT_META[row.eventType].className.replace("text-", "bg-")}`}
                    style={{ width: `${Math.max(2, row.pct)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#101523] p-3">
          <p className="mb-2 text-xs uppercase tracking-[0.12em] text-foreground/45">
            Top sources
          </p>
          <div className="space-y-2">
            {(data?.summary.bySource ?? []).slice(0, 6).map((row) => (
              <div key={row.source} className="flex items-center justify-between text-sm">
                <span className="text-foreground/72">{formatLabel(row.source)}</span>
                <span className="text-white/85">{row.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {loading && !data ? (
        <div className="px-5 py-12 text-center text-sm text-foreground/40">
          Loading activity…
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="px-5 py-12 text-center text-sm text-foreground/40">
          No activity in this filter yet.
        </div>
      ) : (
        <div className="divide-y divide-white/[0.06]">
          {filteredItems.map((item) => {
            const meta = EVENT_META[item.eventType];
            const Icon = meta.icon;
            return (
              <div
                key={`${item.eventType}-${item.walletAddress}-${item.createdAt}`}
                className="flex flex-wrap items-start gap-3 px-5 py-3.5"
              >
                <div
                  className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border ${meta.badgeClass}`}
                >
                  <Icon className={`size-4 ${meta.className}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-sm font-semibold ${meta.className}`}>
                      {meta.label}
                    </span>
                    <span className="font-mono text-sm text-white/80">
                      {truncateAddress(item.walletAddress)}
                    </span>
                    {item.country ? (
                      <Badge className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0 text-[10px] text-white/60">
                        {item.country}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-foreground/48">{item.detail}</p>
                </div>
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <span className="shrink-0 text-xs text-foreground/40">
                    {timeAgo(item.createdAt)}
                  </span>
                  <Link
                    href={`/internal/users/${item.walletAddress}`}
                    className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-xs text-white/75 transition hover:bg-white/[0.08]"
                  >
                    Inspect
                  </Link>
                  {props.canGift ? (
                    <button
                      type="button"
                      onClick={() => void giftBasic(item.walletAddress)}
                      disabled={giftingWallet === item.walletAddress}
                      className="inline-flex items-center gap-1 rounded-md border border-emerald-300/20 bg-emerald-400/10 px-2 py-1 text-xs text-emerald-200 transition hover:bg-emerald-400/20 disabled:opacity-55"
                    >
                      {giftingWallet === item.walletAddress ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Gift className="size-3" />
                      )}
                      Gift 1m basic
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-white/8 px-5 py-3">
        <p className="text-xs text-foreground/45">
          Page {data?.page ?? page} of {data?.totalPages ?? 1} · {data?.summary.total ?? 0} events
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            disabled={page <= 1 || loading}
            className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs text-foreground/70 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-45"
          >
            <ChevronLeft className="size-3" />
            Prev
          </button>
          <button
            type="button"
            onClick={() =>
              setPage((value) =>
                Math.min(data?.totalPages ?? value, value + 1),
              )
            }
            disabled={loading || page >= (data?.totalPages ?? 1)}
            className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs text-foreground/70 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-45"
          >
            Next
            <ChevronRight className="size-3" />
          </button>
        </div>
      </div>
    </section>
  );
}

