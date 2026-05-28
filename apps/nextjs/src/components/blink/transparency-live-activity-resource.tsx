"use client";

import { useEffect, useMemo, useState } from "react";

import { CheckCircle2, ChevronLeft, ChevronRight, UserPlus, Zap } from "lucide-react";

import { Badge } from "@acme/ui/badge";

type LiveEventType = "signup" | "builder_approved" | "trading_enabled" | "first_trade";

type LiveItem = {
  createdAt: string;
  country: string | null;
  detail: string;
  eventType: LiveEventType;
  market: string | null;
  source: string;
  walletAddress: string;
};

type LiveResponse = {
  byEventType: Record<LiveEventType, number>;
  eventType: LiveEventType | null;
  items: LiveItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

const FILTERS: Array<{ id: LiveEventType | "all"; label: string }> = [
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

export function TransparencyLiveActivityResource() {
  const [filter, setFilter] = useState<LiveEventType | "all">("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<LiveResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: "20",
        });
        if (filter !== "all") params.set("eventType", filter);
        const response = await fetch(
          `/api/transparency/live-activity?${params.toString()}`,
          {
            cache: "no-store",
          },
        );
        if (!response.ok) throw new Error("Failed to load");
        const json = (await response.json()) as LiveResponse;
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [filter, page]);

  const eventMix = useMemo(() => {
    if (!data) return [] as Array<{ eventType: LiveEventType; count: number; pct: number }>;
    const counts = data.byEventType;
    const total = Math.max(
      1,
      Object.values(counts).reduce((sum, value) => sum + value, 0),
    );
    return (Object.keys(EVENT_META) as LiveEventType[]).map((eventType) => ({
      count: counts[eventType] ?? 0,
      eventType,
      pct: ((counts[eventType] ?? 0) / total) * 100,
    }));
  }, [data]);

  return (
    <section
      id="live-activity"
      className="rounded-2xl border border-white/10 bg-[#0b0d13] p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">Live Activity</h2>
          <p className="mt-1 max-w-2xl text-xs text-foreground/45">
            Public stream of Blink growth milestones and routed execution onboarding events.
          </p>
        </div>
        <Badge className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-emerald-200">
          Resource 01
        </Badge>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-[#101523] p-3">
          <p className="mb-2 text-xs uppercase tracking-[0.12em] text-foreground/45">
            Event mix
          </p>
          <div className="space-y-2">
            {eventMix.map((row) => (
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
            Filter
          </p>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  setFilter(option.id);
                  setPage(1);
                }}
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

      <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
        {loading ? (
          <div className="px-5 py-10 text-center text-sm text-foreground/45">
            Loading live activity…
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-foreground/45">
            No activity available.
          </div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {data.items.map((item) => {
              const meta = EVENT_META[item.eventType];
              const Icon = meta.icon;
              return (
                <div
                  key={`${item.eventType}-${item.walletAddress}-${item.createdAt}`}
                  className="flex items-start gap-3 px-4 py-3"
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
                    </div>
                    <p className="mt-1 text-xs text-foreground/48">{item.detail}</p>
                  </div>
                  <span className="shrink-0 text-xs text-foreground/40">
                    {timeAgo(item.createdAt)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-foreground/45">
          Page {data?.page ?? page} of {data?.totalPages ?? 1} · {data?.total ?? 0} events
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

