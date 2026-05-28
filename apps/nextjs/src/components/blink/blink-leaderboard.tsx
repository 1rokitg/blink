"use client";

import { useMemo, useState } from "react";

import Link from "next/link";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  BadgeCheck,
  Crown,
  Loader2,
  Sparkles,
  Trophy,
} from "lucide-react";

import { Badge } from "@acme/ui/badge";

import type {
  LeaderboardEntry,
  LeaderboardPeriod,
  LeaderboardSnapshot,
} from "~/lib/blink/leaderboard.server";
import { formatUsd } from "~/lib/blink/markets";

const PERIODS: Array<{ id: LeaderboardPeriod; label: string }> = [
  { id: "24h", label: "24H" },
  { id: "7d", label: "7D" },
  { id: "30d", label: "30D" },
  { id: "all", label: "ALL" },
];

const PODIUM_HEIGHT = {
  1: "h-[168px]",
  2: "h-[132px]",
  3: "h-[112px]",
} as const;

const PODIUM_GLOW = {
  1: "from-[#ffd700]/30 via-[#ffd700]/10 to-transparent border-[#ffd700]/40",
  2: "from-[#d7d7d7]/22 via-[#d7d7d7]/8 to-transparent border-[#d7d7d7]/35",
  3: "from-[#cd7f32]/24 via-[#cd7f32]/8 to-transparent border-[#cd7f32]/35",
} as const;

function formatSignedUsd(value: number) {
  const prefix = value >= 0 ? "+" : "";
  return `${prefix}${formatUsd(Math.abs(value))}`;
}

function PeriodTabs(props: {
  period: LeaderboardPeriod;
  onChange: (period: LeaderboardPeriod) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-wrap gap-1 ${props.compact ? "" : "justify-center"}`}
    >
      {PERIODS.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => props.onChange(option.id)}
          className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] transition ${
            props.period === option.id
              ? "border-[#ffd70055] bg-[#ffd70018] text-[#ffe566]"
              : "border-white/10 bg-white/[0.03] text-foreground/50 hover:text-white/80"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function TraderAvatar(props: {
  entry: LeaderboardEntry;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass =
    props.size === "lg"
      ? "size-16"
      : props.size === "md"
        ? "size-12"
        : "size-8";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={props.entry.avatarUrl}
      alt={props.entry.displayName}
      width={64}
      height={64}
      className={`${sizeClass} shrink-0 rounded-full object-cover ring-2 ring-white/10`}
    />
  );
}

function LeaderboardRow(props: {
  entry: LeaderboardEntry;
  compact?: boolean;
}) {
  const medal =
    props.entry.rank === 1
      ? "🥇"
      : props.entry.rank === 2
        ? "🥈"
        : props.entry.rank === 3
          ? "🥉"
          : null;

  return (
    <Link
      href={props.entry.profileHref}
      className={`flex items-center gap-3 transition hover:bg-white/[0.04] ${
        props.compact ? "px-3 py-2.5" : "px-4 py-3"
      }`}
    >
      <div className="w-7 shrink-0 text-center text-sm text-foreground/45">
        {medal ?? props.entry.rank}
      </div>
      <TraderAvatar entry={props.entry} size={props.compact ? "sm" : "md"} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-semibold text-white">
            {props.entry.displayName}
          </p>
          {props.entry.isVerified ? (
            <BadgeCheck className="size-3.5 shrink-0 text-sky-300" />
          ) : null}
          {props.entry.isPro ? (
            <Badge className="rounded-full border border-[#8fbaff40] bg-[#3c76ff20] px-1.5 py-0 text-[9px] uppercase tracking-[0.12em] text-sky-200">
              Pro
            </Badge>
          ) : null}
        </div>
        <p className="truncate text-[11px] text-foreground/42">
          {props.entry.handle}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p
          className={`text-sm font-semibold tabular-nums ${
            props.entry.routedPnlUsd >= 0 ? "text-emerald-300" : "text-rose-300"
          }`}
        >
          {formatSignedUsd(props.entry.routedPnlUsd)}
        </p>
        {!props.compact ? (
          <p className="text-[10px] text-foreground/38">
            {formatUsd(props.entry.routedVolumeUsd)} vol
          </p>
        ) : null}
      </div>
    </Link>
  );
}

function Podium(props: { entries: LeaderboardEntry[] }) {
  const first = props.entries.find((entry) => entry.rank === 1);
  const second = props.entries.find((entry) => entry.rank === 2);
  const third = props.entries.find((entry) => entry.rank === 3);

  if (!first) return null;

  const slots = [
    { entry: second, rank: 2 as const, order: "order-1" },
    { entry: first, rank: 1 as const, order: "order-2" },
    { entry: third, rank: 3 as const, order: "order-3" },
  ];

  return (
    <div className="mx-auto grid max-w-4xl grid-cols-3 items-end gap-3 px-2 pt-4">
      {slots.map(({ entry, rank, order }) => {
        if (!entry) {
          return <div key={rank} className={order} />;
        }

        return (
          <Link
            key={entry.walletAddress}
            href={entry.profileHref}
            className={`group relative flex flex-col items-center ${order}`}
          >
            <div
              className={`mb-3 flex flex-col items-center rounded-[22px] border bg-gradient-to-b px-3 py-4 ${PODIUM_GLOW[rank]} ${PODIUM_HEIGHT[rank]} w-full justify-end`}
            >
              {rank === 1 ? (
                <Crown className="mb-2 size-5 text-[#ffd700]" />
              ) : null}
              <TraderAvatar entry={entry} size={rank === 1 ? "lg" : "md"} />
              <p className="mt-3 max-w-full truncate text-center text-sm font-semibold text-white">
                {entry.displayName}
              </p>
              <p className="max-w-full truncate text-[11px] text-foreground/45">
                {entry.handle}
              </p>
              <p
                className={`mt-2 text-base font-bold tabular-nums ${
                  entry.routedPnlUsd >= 0 ? "text-emerald-300" : "text-rose-300"
                }`}
              >
                {formatSignedUsd(entry.routedPnlUsd)}
              </p>
              <p className="mt-1 text-[10px] text-foreground/40">
                #{rank} · {entry.fillsCount} fills
              </p>
            </div>
            <span className="text-2xl">
              {rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉"}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function useLeaderboardQuery(period: LeaderboardPeriod, limit: number) {
  return useQuery({
    queryKey: ["blink-leaderboard", period, limit],
    queryFn: async () => {
      const response = await fetch(
        `/api/leaderboard?period=${period}&limit=${limit}`,
      );
      if (!response.ok) throw new Error("Failed to load leaderboard");
      return (await response.json()) as LeaderboardSnapshot;
    },
    staleTime: 120_000,
    refetchInterval: 300_000,
  });
}

export function BlinkLeaderboardPanel(props: { compact?: boolean }) {
  const [period, setPeriod] = useState<LeaderboardPeriod>("7d");
  const limit = props.compact ? 12 : 100;
  const query = useLeaderboardQuery(period, limit);

  const entries = query.data?.entries ?? [];
  const rest = useMemo(
    () => entries.filter((entry) => entry.rank > 3),
    [entries],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/[0.06] px-2.5 py-2">
        <PeriodTabs period={period} onChange={setPeriod} compact />
      </div>

      {query.isLoading ? (
        <div className="flex flex-1 items-center justify-center py-10">
          <Loader2 className="size-5 animate-spin text-foreground/40" />
        </div>
      ) : query.isError ? (
        <p className="px-3 py-8 text-center text-xs text-rose-300/80">
          Leaderboard unavailable. Try again shortly.
        </p>
      ) : entries.length === 0 ? (
        <p className="px-3 py-8 text-center text-xs text-foreground/45">
          No ranked traders yet for this window.
        </p>
      ) : (
        <div className="flex-1 divide-y divide-white/[0.05] overflow-y-auto">
          {entries.map((entry) => (
            <LeaderboardRow key={entry.walletAddress} entry={entry} compact />
          ))}
        </div>
      )}

      <p className="border-t border-white/[0.05] px-3 py-2 text-center text-[10px] leading-4 text-foreground/30">
        X verified · builder approved · Blink-routed fills
      </p>
    </div>
  );
}

export function BlinkLeaderboardPage() {
  const [period, setPeriod] = useState<LeaderboardPeriod>("7d");
  const query = useLeaderboardQuery(period, 100);
  const entries = query.data?.entries ?? [];
  const tableRows = entries.filter((entry) => entry.rank > 3);

  return (
    <main className="min-h-screen bg-[#060510] text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_at_top,#ffd70012,transparent_62%)]" />
      <div className="relative mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-12">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge className="rounded-full border border-[#ffd70035] bg-[#ffd70012] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-[#ffe566]">
              <Trophy className="mr-1.5 inline size-3.5" />
              Blink leaderboard
            </Badge>
            <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-white md:text-5xl">
              Where traders become legends
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-foreground/58">
              Top 100 performers on Blink — ranked by realized PnL on trades
              routed through our builder code. Verified on X, approved, and
              trading live.
            </p>
          </div>
          <Link
            href="/trade"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white/80 transition hover:bg-white/[0.08]"
          >
            Back to terminal
          </Link>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <PeriodTabs period={period} onChange={setPeriod} />
          {query.data?.updatedAt ? (
            <p className="text-xs text-foreground/40">
              Updated {new Date(query.data.updatedAt).toLocaleString()}
            </p>
          ) : null}
        </div>

        {query.isLoading ? (
          <div className="flex min-h-[320px] items-center justify-center">
            <Loader2 className="size-6 animate-spin text-foreground/40" />
          </div>
        ) : query.isError ? (
          <section className="mt-8 rounded-2xl border border-rose-400/20 bg-rose-400/8 p-8 text-center text-sm text-rose-200">
            Could not load leaderboard rankings.
          </section>
        ) : entries.length === 0 ? (
          <section className="mt-8 rounded-2xl border border-white/10 bg-[#0b0d13] p-10 text-center">
            <Sparkles className="mx-auto size-8 text-foreground/30" />
            <p className="mt-4 text-lg font-medium text-white">
              The board is warming up
            </p>
            <p className="mt-2 text-sm text-foreground/50">
              Be the first verified trader to route volume through Blink.
            </p>
          </section>
        ) : (
          <>
            <section className="mt-6 overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,#10131f,#080a12)] p-4 md:p-8">
              <Podium entries={entries} />
            </section>

            <section className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-[#0b0d13]">
              <div className="border-b border-white/8 px-5 py-4">
                <h2 className="text-lg font-semibold text-white">Top 100</h2>
                <p className="mt-1 text-xs text-foreground/45">
                  Realized PnL on Blink-routed fills · volume and fill count
                  shown for context
                </p>
              </div>
              <div className="divide-y divide-white/[0.05]">
                {tableRows.map((entry) => (
                  <LeaderboardRow key={entry.walletAddress} entry={entry} />
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
