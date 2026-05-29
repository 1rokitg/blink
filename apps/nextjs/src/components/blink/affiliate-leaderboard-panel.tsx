"use client";

import Link from "next/link";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Crown,
  ExternalLink,
  Flame,
  Medal,
  Trophy,
  Users,
} from "lucide-react";

import { Badge } from "@acme/ui/badge";

import { AFFILIATE_SEEDS } from "~/lib/blink/affiliate-seeds";

type LeaderboardEntry = {
  rank: number;
  code: string;
  name: string;
  xHandle: string;
  xUrl: string;
  avatarUrl: string;
  rewardBoostLabel: string;
  payoutSplitLabel?: string;
  active: boolean;
  referralLink: string;
  metrics: {
    referrals: number;
    builderApproved: number;
    firstTrade: number;
    proStarted: number;
    referrals7d: number;
  };
  conversion: {
    signupToApprovalPct: number;
    signupToTradePct: number;
    approvalToTradePct: number;
    tradeToProPct: number;
  };
  score: number;
  lastReferralAt: string | null;
};

type LeaderboardResponse = {
  updatedAt: string;
  totals: {
    affiliates: number;
    referrals: number;
    builderApproved: number;
    firstTrade: number;
    proStarted: number;
    referrals7d: number;
  };
  entries: LeaderboardEntry[];
};

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatRelativeTime(value: string | null) {
  if (!value) return "—";
  const ms = Date.now() - new Date(value).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function rankBadge(rank: number) {
  if (rank === 1) {
    return (
      <span className="inline-flex size-8 items-center justify-center rounded-full bg-amber-400/15 text-amber-300">
        <Crown className="size-4" />
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="inline-flex size-8 items-center justify-center rounded-full bg-slate-300/10 text-slate-200">
        <Medal className="size-4" />
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="inline-flex size-8 items-center justify-center rounded-full bg-orange-400/10 text-orange-300">
        <Medal className="size-4" />
      </span>
    );
  }
  return (
    <span className="inline-flex size-8 items-center justify-center rounded-full bg-white/[0.05] text-sm font-semibold text-white/45">
      {rank}
    </span>
  );
}

function StatPill(props: { label: string; value: string | number; tone?: "hot" }) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 ${
        props.tone === "hot"
          ? "border-orange-400/25 bg-orange-400/10"
          : "border-white/10 bg-[#0f1422]"
      }`}
    >
      <p className="text-[10px] uppercase tracking-[0.12em] text-foreground/45">
        {props.label}
      </p>
      <p
        className={`mt-1 text-lg font-semibold ${
          props.tone === "hot" ? "text-orange-300" : "text-white"
        }`}
      >
        {props.value}
      </p>
    </div>
  );
}

function PodiumCard(props: { entry: LeaderboardEntry; place: 1 | 2 | 3 }) {
  const heights = { 1: "min-h-[220px]", 2: "min-h-[190px]", 3: "min-h-[180px]" };
  const accents = {
    1: "border-amber-400/35 bg-[linear-gradient(180deg,rgba(251,191,36,0.12),rgba(15,20,34,0.95))]",
    2: "border-slate-300/20 bg-[linear-gradient(180deg,rgba(203,213,225,0.08),rgba(15,20,34,0.95))]",
    3: "border-orange-400/20 bg-[linear-gradient(180deg,rgba(251,146,60,0.08),rgba(15,20,34,0.95))]",
  };

  return (
    <article
      className={`flex flex-col rounded-2xl border p-4 ${heights[props.place]} ${accents[props.place]}`}
    >
      <div className="flex items-start justify-between gap-2">
        {rankBadge(props.entry.rank)}
        <Badge className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-emerald-300">
          {props.entry.rewardBoostLabel}
        </Badge>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <img
          src={props.entry.avatarUrl}
          alt=""
          className="size-12 rounded-full border border-white/10 bg-white/5 object-cover"
        />
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-white">
            {props.entry.name}
          </p>
          <a
            href={props.entry.xUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-sky-300 hover:text-sky-200"
          >
            {props.entry.xHandle}
            <ExternalLink className="size-3" />
          </a>
        </div>
      </div>

      <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
        <StatPill label="Score" value={props.entry.score} tone="hot" />
        <StatPill label="Trades" value={props.entry.metrics.firstTrade} />
        <StatPill label="Signups" value={props.entry.metrics.referrals} />
        <StatPill
          label="7d signups"
          value={props.entry.metrics.referrals7d}
          tone={props.entry.metrics.referrals7d > 0 ? "hot" : undefined}
        />
      </div>
    </article>
  );
}

export function AffiliateLeaderboardPanel(props: {
  showInternalFields?: boolean;
  publicView?: boolean;
}) {
  const query = useQuery({
    queryKey: ["affiliate-leaderboard"],
    queryFn: async () => {
      const response = await fetch("/api/affiliates/leaderboard");
      if (!response.ok) throw new Error("Failed to load affiliate leaderboard");
      return (await response.json()) as LeaderboardResponse;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const data = query.data;
  const splitByCode = new Map(
    AFFILIATE_SEEDS.map((seed) => [seed.code.toUpperCase(), seed.payoutSplitLabel]),
  );
  const entries =
    data?.entries.map((entry) => ({
      ...entry,
      payoutSplitLabel:
        entry.payoutSplitLabel ??
        splitByCode.get(entry.code.toUpperCase()) ??
        "—",
    })) ?? [];
  const topThree = entries.slice(0, 3);
  const leader = entries[0] ?? null;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Trophy className="size-5 text-amber-300" />
            <h2 className="text-2xl font-semibold tracking-[-0.03em] text-white">
              KOL leaderboard
            </h2>
          </div>
          <p className="mt-1 text-sm text-foreground/60">
            Public performance stats ranked by activation score — more shills,
            more traders, higher rank.
          </p>
        </div>
        {props.publicView ? (
          <Link
            href="/internal/affiliates"
            className="text-sm text-foreground/55 hover:text-white"
          >
            Internal portal →
          </Link>
        ) : (
          <Link
            href="/affiliates/leaderboard"
            target="_blank"
            className="inline-flex items-center gap-1 text-sm text-sky-300 hover:text-sky-200"
          >
            Public page
            <ArrowUpRight className="size-3.5" />
          </Link>
        )}
      </div>

      {query.isLoading ? (
        <div className="rounded-2xl border border-white/10 bg-[#121726] p-8 text-sm text-foreground/55">
          Loading leaderboard…
        </div>
      ) : query.isError || !data ? (
        <div className="rounded-2xl border border-rose-400/20 bg-rose-400/5 p-8 text-sm text-rose-200">
          Could not load affiliate leaderboard.
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <StatPill label="Active KOLs" value={data.totals.affiliates} />
            <StatPill label="Total signups" value={data.totals.referrals} />
            <StatPill label="Enabled" value={data.totals.builderApproved} />
            <StatPill label="First trades" value={data.totals.firstTrade} />
            <StatPill
              label="7d signups"
              value={data.totals.referrals7d}
              tone={data.totals.referrals7d > 0 ? "hot" : undefined}
            />
          </div>

          {topThree.length > 0 ? (
            <div className="grid gap-3 lg:grid-cols-3">
              {topThree[1] ? <PodiumCard entry={topThree[1]} place={2} /> : null}
              {topThree[0] ? <PodiumCard entry={topThree[0]} place={1} /> : null}
              {topThree[2] ? <PodiumCard entry={topThree[2]} place={3} /> : null}
            </div>
          ) : null}

          {leader ? (
            <div className="rounded-xl border border-white/10 bg-[#121726] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-foreground/45">
                    Current #1
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-white">
                    {leader.name}
                  </p>
                  <p className="mt-1 text-sm text-foreground/60">
                    {leader.metrics.firstTrade} traders activated ·{" "}
                    {formatPercent(leader.conversion.signupToTradePct)} signup →
                    trade
                  </p>
                </div>
                <Badge className="rounded-full border border-amber-400/35 bg-amber-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-amber-300">
                  Score {leader.score}
                </Badge>
              </div>
            </div>
          ) : null}

          <div className="rounded-xl border border-white/10 bg-[#121726] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.12em] text-foreground/45">
                Full rankings
              </p>
              <p className="text-[11px] text-foreground/40">
                Updated {formatRelativeTime(data.updatedAt)}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="text-[11px] uppercase tracking-[0.12em] text-foreground/45">
                  <tr>
                    <th className="py-2 pr-3">Rank</th>
                    <th className="py-2 pr-3">KOL</th>
                    <th className="py-2 pr-3">Code</th>
                    <th className="py-2 pr-3">Score</th>
                    <th className="py-2 pr-3">Signups</th>
                    <th className="py-2 pr-3">Enabled</th>
                    <th className="py-2 pr-3">Trades</th>
                    <th className="py-2 pr-3">Pro</th>
                    <th className="py-2 pr-3">7d</th>
                    <th className="py-2 pr-3">Signup → trade</th>
                    {props.showInternalFields ? (
                      <th className="py-2 pr-3">Split</th>
                    ) : null}
                    <th className="py-2">Last signup</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr
                      key={entry.code}
                      className="border-t border-white/8 transition hover:bg-white/[0.02]"
                    >
                      <td className="py-3 pr-3">{rankBadge(entry.rank)}</td>
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={entry.avatarUrl}
                            alt=""
                            className="size-9 rounded-full border border-white/10 bg-white/5 object-cover"
                          />
                          <div>
                            <p className="font-medium text-white">{entry.name}</p>
                            <a
                              href={entry.xUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-foreground/55 hover:text-white"
                            >
                              {entry.xHandle}
                              <ExternalLink className="size-3" />
                            </a>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-3 font-mono text-sky-300">
                        {entry.code}
                      </td>
                      <td className="py-3 pr-3">
                        <span className="inline-flex items-center gap-1 font-semibold text-amber-300">
                          {entry.score}
                          {entry.metrics.referrals7d > 0 ? (
                            <Flame className="size-3.5 text-orange-300" />
                          ) : null}
                        </span>
                      </td>
                      <td className="py-3 pr-3 text-white">
                        {entry.metrics.referrals}
                      </td>
                      <td className="py-3 pr-3 text-emerald-300">
                        {entry.metrics.builderApproved}
                      </td>
                      <td className="py-3 pr-3 text-white">
                        {entry.metrics.firstTrade}
                      </td>
                      <td className="py-3 pr-3 text-violet-300">
                        {entry.metrics.proStarted}
                      </td>
                      <td className="py-3 pr-3 text-orange-300">
                        {entry.metrics.referrals7d}
                      </td>
                      <td className="py-3 pr-3 text-white/80">
                        {formatPercent(entry.conversion.signupToTradePct)}
                      </td>
                      {props.showInternalFields ? (
                        <td className="py-3 pr-3 text-white/70">
                          {entry.payoutSplitLabel ?? "—"}
                        </td>
                      ) : null}
                      <td className="py-3 text-foreground/55">
                        {formatRelativeTime(entry.lastReferralAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#121726] p-4 text-sm text-foreground/60">
            <div className="flex items-start gap-2">
              <Users className="mt-0.5 size-4 shrink-0 text-sky-300" />
              <p>
                Score = signups × 10 + enabled × 25 + first trades × 100 + Pro
                starts × 150 + 7-day signups × 5. Rankings refresh every minute
                from live referral and funnel data.
              </p>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
