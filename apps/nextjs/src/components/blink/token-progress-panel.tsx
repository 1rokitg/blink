"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, CheckCircle2, Loader2 } from "lucide-react";

import type { BlinkTokenProgressSnapshot } from "~/lib/blink/clanker.server";

function formatEth(value: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: value >= 100 ? 0 : 2,
    maximumFractionDigits: value >= 100 ? 0 : 4,
  }).format(value);
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)}%`;
}

function formatUpdatedAt(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Just updated";

  return `Updated ${new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  }).format(date)}`;
}

export function TokenProgressPanel(props: {
  initialSnapshot: BlinkTokenProgressSnapshot;
}) {
  const progressQuery = useQuery({
    queryKey: ["blink-token-progress"],
    queryFn: async (): Promise<BlinkTokenProgressSnapshot> => {
      const response = await fetch("/api/token/progress", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to refresh token progress");
      }

      return (await response.json()) as BlinkTokenProgressSnapshot;
    },
    initialData: props.initialSnapshot,
    refetchInterval: 15_000,
    refetchOnWindowFocus: false,
  });

  const snapshot = progressQuery.data;

  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">
            Progress to 100 ETH
          </p>
          <p className="mt-2 text-4xl font-semibold tracking-[-0.05em] text-white">
            {formatEth(snapshot.rewardedEth)} ETH
          </p>
          <p className="mt-2 text-sm text-white/55">
            {formatPercent(snapshot.progressPct)} of the creator-fee goal
          </p>
        </div>
        <div
          className={
            snapshot.isLive
              ? "inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300"
              : "inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs text-amber-200"
          }
        >
          {progressQuery.isFetching ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <CheckCircle2 className="size-3" />
          )}
          {snapshot.isLive ? "Live" : "Delayed"}
        </div>
      </div>

      <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/8">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#38bdf8,#3b82f6)] transition-[width] duration-500"
          style={{ width: `${Math.max(snapshot.progressPct, 2)}%` }}
        />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-[#020817]/45 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/38">
            Lifetime rewarded
          </p>
          <p className="mt-2 text-lg font-semibold text-white">
            {formatEth(snapshot.rewardedEth)} ETH
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#020817]/45 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/38">
            Claimable now
          </p>
          <p className="mt-2 text-lg font-semibold text-white">
            {formatEth(snapshot.claimableEth)} ETH
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#020817]/45 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/38">
            Remaining
          </p>
          <p className="mt-2 text-lg font-semibold text-white">
            {formatEth(snapshot.remainingEth)} ETH
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-2 text-sm text-white/52">
        <p>{formatUpdatedAt(snapshot.lastUpdated)}</p>
        <p>
          {snapshot.isLive
            ? "Live WETH creator fees are read from Clanker's fee locker and mapped to Blink's 100 ETH budget goal."
            : "On-chain fee reads are temporarily unavailable. Progress will refresh automatically when Base RPC recovers."}
        </p>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <a
          href={snapshot.clankerUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/80 transition hover:bg-white/[0.08] hover:text-white"
        >
          View on Clanker
          <ArrowUpRight className="size-3.5" />
        </a>
        <a
          href={`https://basescan.org/address/${snapshot.feeLockerAddress}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/80 transition hover:bg-white/[0.08] hover:text-white"
        >
          Fee locker
          <ArrowUpRight className="size-3.5" />
        </a>
      </div>
    </div>
  );
}
