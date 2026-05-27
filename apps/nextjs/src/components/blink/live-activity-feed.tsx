"use client";

import { useMemo, useState } from "react";

import { CheckCircle2, Radio, UserPlus, Zap } from "lucide-react";

type LiveActivityItem = {
  eventType: "signup" | "builder_approved" | "first_trade";
  createdAt: string;
  walletAddress: string;
  source: string;
  country: string | null;
  market: string | null;
  detail: string;
};

const FILTERS = [
  { id: "all", label: "All" },
  { id: "signup", label: "Signup" },
  { id: "builder_approved", label: "Approved" },
  { id: "first_trade", label: "Routed tx" },
] as const;

const EVENT_META = {
  signup: {
    label: "Signup",
    icon: UserPlus,
    className: "text-emerald-300",
    badgeClass: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
  },
  builder_approved: {
    label: "Approved",
    icon: CheckCircle2,
    className: "text-sky-300",
    badgeClass: "border-sky-400/25 bg-sky-400/10 text-sky-200",
  },
  first_trade: {
    label: "Routed tx",
    icon: Zap,
    className: "text-amber-300",
    badgeClass: "border-amber-400/25 bg-amber-400/10 text-amber-200",
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

export function LiveActivityFeed(props: {
  items: LiveActivityItem[];
  loading?: boolean;
}) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");

  const filteredItems = useMemo(() => {
    if (filter === "all") return props.items;
    return props.items.filter((item) => item.eventType === filter);
  }, [filter, props.items]);

  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-[#0b0d13]">
      <div className="border-b border-white/8 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Radio className="size-4 text-emerald-300" />
              <h2 className="text-base font-semibold text-white">
                Live activity
              </h2>
            </div>
            <p className="mt-1 max-w-2xl text-xs text-foreground/45">
              Newest first. Signups, builder approvals, and first routed trades.
              Discord alerts fire on each wallet&apos;s first event.
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

      {props.loading && props.items.length === 0 ? (
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
                className="flex items-start gap-3 px-5 py-3.5"
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
                  <p className="mt-1 text-xs text-foreground/48">
                    {item.detail}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-foreground/40">
                  {timeAgo(item.createdAt)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
