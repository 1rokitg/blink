"use client";

import { useState, useTransition } from "react";

import {
  AreaLineChart,
  BreakdownBar,
  Sparkline,
} from "@/components/internal/charts";
import {
  CountUpInt,
  CountUpUsd,
  SkeletonBlock,
} from "@/components/internal/count-up-stat";
import type {
  DashboardRange,
  InternalDashboardStats,
} from "@/lib/internal-stats-types";
import { formatUsd } from "@/lib/internal-money";
import { SITE } from "@/lib/site";

function dayKeyUtc(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/** Map a milestone timestamp onto the Home impressions series index. */
function landingMarkerIndex(
  seriesDates: string[],
  pageviewPointCount: number,
  milestoneIso: string,
) {
  const milestoneDay = dayKeyUtc(milestoneIso);
  if (!milestoneDay) return null;

  if (seriesDates.length > 1) {
    const exact = seriesDates.findIndex((date) => date.slice(0, 10) === milestoneDay);
    if (exact >= 0) return exact;
    // First point on/after the switch day.
    const after = seriesDates.findIndex(
      (date) => date.slice(0, 10) >= milestoneDay,
    );
    return after >= 0 ? after : null;
  }

  // Today card falls back to [yesterday, today] when series is a single day.
  if (pageviewPointCount >= 2) {
    const today = dayKeyUtc(new Date().toISOString());
    const yesterday = dayKeyUtc(
      new Date(Date.now() - 86_400_000).toISOString(),
    );
    if (milestoneDay === today) return 1;
    if (milestoneDay === yesterday) return 0;
    // Switch already happened — keep the marker on "today" as the live baseline.
    if (milestoneDay < today) return 1;
  }

  return pageviewPointCount > 0 ? 0 : null;
}

function formatLandingMarkerCaption(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

const RANGES: { days: DashboardRange; label: string }[] = [
  { days: 1, label: "Today" },
  { days: 7, label: "Last 7 days" },
  { days: 14, label: "Last 14 days" },
  { days: 30, label: "Last 30 days" },
  { days: 90, label: "Last 90 days" },
];

const STATUS_COLORS: Record<string, string> = {
  active: "#22c55e",
  trialing: "#38bdf8",
  past_due: "#7dd3fc",
  canceled: "#1d4ed8",
  unpaid: "#ef4444",
  incomplete: "#94a3b8",
  incomplete_expired: "#64748b",
  paused: "#f97316",
};

function pctLabel(value: number | null) {
  if (value === null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function pageviewChange(today: number, yesterday: number) {
  if (yesterday > 0) return ((today - yesterday) / yesterday) * 100;
  if (today > 0) return 100;
  return null;
}

function RefreshIcon({ spinning }: { spinning?: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={spinning ? "animate-spin" : undefined}
    >
      <path
        d="M20 12a8 8 0 1 1-2.34-5.66"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M20 5v4.5H15.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function HomeView({
  initialStats,
}: {
  initialStats: InternalDashboardStats;
}) {
  const [stats, setStats] = useState(initialStats);
  const [range, setRange] = useState<DashboardRange>(initialStats.rangeDays);
  const [pending, startTransition] = useTransition();
  const [refreshKey, setRefreshKey] = useState(0);

  function refresh(days: DashboardRange = range) {
    setRange(days);
    startTransition(async () => {
      const response = await fetch(`/api/internal/stats?days=${days}`, {
        cache: "no-store",
      });
      if (!response.ok) return;
      setStats((await response.json()) as InternalDashboardStats);
      setRefreshKey((key) => key + 1);
    });
  }

  const pageviewsToday = stats.traffic.today.pageviews;
  const pageviewsYesterday = stats.traffic.yesterday.pageviews;
  const pageviewPct = pageviewChange(pageviewsToday, pageviewsYesterday);

  const pageviewPoints =
    stats.traffic.series.length > 1
      ? stats.traffic.series.map((d) => d.pageviews)
      : [pageviewsYesterday, pageviewsToday];
  const pageviewLabels =
    stats.traffic.series.length > 1
      ? stats.traffic.series.map((d) => {
          const day = d.date.slice(0, 10);
          const parsed = new Date(`${day}T00:00:00Z`);
          return Number.isNaN(parsed.getTime())
            ? day
            : parsed.toLocaleDateString([], { month: "short", day: "numeric" });
        })
      : ["Yesterday", "Today"];
  const uniquePoints =
    stats.traffic.series.length > 1
      ? stats.traffic.series.map((d) => d.uniques)
      : [stats.traffic.yesterday.uniques, stats.traffic.today.uniques];
  const revenuePoints = stats.revenueSeries.map((d) => d.amount);
  const yesterdayPageviewsFlat = pageviewPoints.map(() => pageviewsYesterday);

  const playbookMarkerIndex = landingMarkerIndex(
    stats.traffic.series.map((d) => d.date),
    pageviewPoints.length,
    SITE.landingPlaybookAt,
  );
  const playbookMarkers =
    playbookMarkerIndex === null
      ? undefined
      : [
          {
            index: playbookMarkerIndex,
            label: "Landing refresh",
            color: "#ff6a00",
          },
        ];
  const playbookCaption = formatLandingMarkerCaption(SITE.landingPlaybookAt);

  const breakdownTotal =
    stats.paymentsBreakdown.reduce((sum, row) => sum + row.amount, 0) || 1;

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {!stats.stripeConfigured ? (
        <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          Stripe is not configured — card revenue widgets stay empty until
          `STRIPE_SECRET_KEY` is set on the Worker.
        </p>
      ) : null}

      <section>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Today
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => refresh()}
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-full border border-[#262626] bg-[#141414] px-3.5 py-2 text-sm font-semibold text-[#fafafa] hover:bg-[#1c1c1c] disabled:opacity-60"
            >
              <RefreshIcon spinning={pending} />
              {pending ? "Refreshing…" : "Refresh"}
            </button>
            <a
              href="https://dashboard.stripe.com/balance/overview"
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-400 hover:bg-emerald-500/15"
            >
              Stripe · Withdraw{" "}
              {pending ? (
                <SkeletonBlock className="ml-1 inline-block h-4 w-14 align-middle" />
              ) : (
                <CountUpUsd
                  value={stats.balance.available}
                  refreshKey={refreshKey}
                  duration={0.9}
                  className="tabular-nums"
                />
              )}
            </a>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.75fr_0.85fr]">
          <div className="rounded-2xl border border-[#262626] bg-[#141414] p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[#a1a1aa]">Impressions</p>
                <p className="mt-1 text-[12px] text-[#71717a]">
                  {stats.trafficSource === "cloudflare"
                    ? "Synced with Cloudflare · Traffic History"
                    : "First-party beacon (Cloudflare not synced)"}
                </p>
              </div>
              <a
                href="/internal/traffic"
                className="inline-flex items-center gap-1.5 rounded-full border border-[#70a7ff]/35 bg-[#70a7ff]/10 px-3.5 py-2 text-sm font-semibold text-[#70a7ff] hover:bg-[#70a7ff]/15"
              >
                Traffic metrics
                <span aria-hidden>→</span>
              </a>
            </div>
            <div className="mt-5 flex flex-wrap items-end gap-10">
              <div>
                {pending ? (
                  <SkeletonBlock className="h-14 w-40 sm:h-16 sm:w-52" />
                ) : (
                  <p className="text-5xl font-semibold tracking-tight sm:text-7xl">
                    <CountUpInt
                      value={pageviewsToday}
                      refreshKey={refreshKey}
                      className="tabular-nums"
                    />
                  </p>
                )}
                <p className="mt-3 inline-flex items-center rounded-md bg-emerald-500/10 px-2.5 py-1 text-sm font-semibold text-emerald-400">
                  {pending ? (
                    <SkeletonBlock className="h-4 w-12 bg-emerald-500/20" />
                  ) : (
                    pctLabel(pageviewPct)
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-[#a1a1aa]">Yesterday</p>
                {pending ? (
                  <SkeletonBlock className="mt-3 h-10 w-28" />
                ) : (
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-[#a1a1aa] sm:text-4xl">
                    <CountUpInt
                      value={pageviewsYesterday}
                      refreshKey={refreshKey}
                      duration={0.9}
                      className="tabular-nums"
                    />
                  </p>
                )}
                <p className="mt-2 text-sm text-[#71717a]">
                  {pending ? (
                    <SkeletonBlock className="h-4 w-28" />
                  ) : (
                    <>
                      <CountUpInt
                        value={stats.traffic.today.uniques}
                        refreshKey={refreshKey}
                        duration={0.8}
                        className="tabular-nums"
                      />{" "}
                      uniques today
                    </>
                  )}
                </p>
              </div>
            </div>
            <div
              className={`mt-8 transition-opacity duration-300 ${
                pending ? "opacity-40" : "opacity-100"
              }`}
            >
              {pending ? (
                <SkeletonBlock className="h-80 w-full rounded-2xl" />
              ) : (
                <>
                  <AreaLineChart
                    primary={pageviewPoints}
                    secondary={yesterdayPageviewsFlat}
                    labels={pageviewLabels}
                    markers={playbookMarkers}
                    primaryStroke="var(--chart-4)"
                    heightClass="h-80"
                    label="Impressions"
                    secondaryLabel="Yesterday"
                  />
                  <p className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-[#a1a1aa]">
                    <span
                      className="inline-block h-2 w-2 rounded-full bg-[#ff6a00]"
                      aria-hidden
                    />
                    <span>
                      Landing refresh · new checkout on{" "}
                      <span className="font-mono text-[#d4d4d8]">/join</span>
                      {" · "}
                      <span className="font-medium text-[#fafafa]">
                        {playbookCaption}
                      </span>
                    </span>
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-[#262626] bg-[#141414] p-6">
              <div className="flex items-start justify-between">
                <p className="text-sm font-medium text-[#a1a1aa]">
                  All-time revenue
                </p>
                <a
                  href="/internal/earnings"
                  className="text-sm font-medium text-[#70a7ff] hover:underline"
                >
                  View
                </a>
              </div>
              {pending ? (
                <SkeletonBlock className="mt-4 h-12 w-36" />
              ) : (
                <p className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
                  <CountUpUsd
                    value={stats.allTimeRevenue}
                    refreshKey={refreshKey}
                    className="tabular-nums"
                  />
                </p>
              )}
              <p className="mt-2 text-sm text-[#a1a1aa]">
                {stats.proprReferrals && stats.proprReferrals.earnings > 0
                  ? `The Circle ${formatUsd(stats.stripeAllTimeRevenue)} · Referrals ${formatUsd(stats.proprReferrals.earnings)}`
                  : "The Circle"}
              </p>
            </div>

            <div className="rounded-2xl border border-[#262626] bg-[#141414] p-6">
              <div className="flex items-start justify-between">
                <p className="text-sm font-medium text-[#a1a1aa]">
                  Stripe balance
                </p>
                <a
                  href="https://dashboard.stripe.com/balance/overview"
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-[#70a7ff] hover:underline"
                >
                  Stripe
                </a>
              </div>
              {pending ? (
                <SkeletonBlock className="mt-4 h-12 w-36" />
              ) : (
                <p className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
                  <CountUpUsd
                    value={stats.balance.available}
                    refreshKey={refreshKey}
                    className="tabular-nums"
                  />
                </p>
              )}
              <p className="mt-2 text-sm text-[#a1a1aa]">
                Card payouts only — crypto settles to your wallet
              </p>
              <p className="mt-1 text-xs text-[#71717a]">
                {pending ? (
                  <SkeletonBlock className="h-3 w-40" />
                ) : (
                  <>
                    Pending {formatUsd(stats.balance.pending)} ·{" "}
                    {stats.balance.currency.toUpperCase()}
                  </>
                )}
              </p>
            </div>

            <div className="rounded-2xl border border-[#262626] bg-[#141414] p-6">
              <p className="text-sm font-medium text-[#a1a1aa]">Active members</p>
              {pending ? (
                <SkeletonBlock className="mt-4 h-12 w-24" />
              ) : (
                <p className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
                  <CountUpInt
                    value={stats.activeSubscribers}
                    refreshKey={refreshKey}
                    className="tabular-nums"
                  />
                </p>
              )}
              <p className="mt-2 text-sm text-[#a1a1aa]">
                {pending ? (
                  <SkeletonBlock className="h-4 w-28" />
                ) : (
                  <>
                    MRR{" "}
                    <CountUpUsd
                      value={stats.mrr}
                      refreshKey={refreshKey}
                      duration={0.9}
                      className="tabular-nums"
                    />
                  </>
                )}
              </p>
              <p className="mt-1 text-xs text-[#71717a]">
                via Stripe Payments run-rate
              </p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Stats</h2>
            <p className="mt-1 text-sm text-[#a1a1aa]">
              Updated {new Date(stats.generatedAt).toLocaleString()}
              {pending ? " · refreshing…" : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {RANGES.map((item) => (
              <button
                key={item.days}
                type="button"
                onClick={() => refresh(item.days)}
                disabled={pending}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium disabled:opacity-60 ${
                  range === item.days
                    ? "border-white bg-white text-black"
                    : "border-[#262626] bg-[#141414] text-[#a1a1aa] hover:bg-[#1c1c1c]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm text-[#a1a1aa]">Impressions</p>
              <a
                href="/internal/traffic"
                className="text-[12px] font-medium text-[#70a7ff] hover:underline"
              >
                Traffic →
              </a>
            </div>
            {pending ? (
              <SkeletonBlock className="mt-3 h-9 w-24" />
            ) : (
              <p className="mt-2 text-3xl font-semibold tracking-tight">
                <CountUpInt
                  value={stats.rangePageviews}
                  refreshKey={refreshKey}
                  className="tabular-nums"
                />
              </p>
            )}
            <p className="mt-1 text-[11px] text-[#71717a]">
              {stats.trafficSource === "cloudflare"
                ? "Cloudflare SoT"
                : "First-party"}
            </p>
            <div
              className={`mt-3 transition-opacity ${pending ? "opacity-40" : ""}`}
            >
              {pending ? (
                <SkeletonBlock className="h-12 w-44" />
              ) : (
                <Sparkline
                  points={pageviewPoints}
                  stroke="var(--chart-4)"
                  label="Impressions"
                />
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5">
            <p className="text-sm text-[#a1a1aa]">All-time revenue</p>
            {pending ? (
              <SkeletonBlock className="mt-3 h-9 w-28" />
            ) : (
              <p className="mt-2 text-3xl font-semibold tracking-tight">
                <CountUpUsd
                  value={stats.allTimeRevenue}
                  refreshKey={refreshKey}
                  className="tabular-nums"
                />
              </p>
            )}
            <p className="mt-1 text-sm text-[#71717a]">
              {stats.proprReferrals && stats.proprReferrals.earnings > 0
                ? `The Circle ${formatUsd(stats.stripeAllTimeRevenue)} · Referrals ${formatUsd(stats.proprReferrals.earnings)}`
                : "The Circle"}
            </p>
            <div
              className={`mt-3 transition-opacity ${pending ? "opacity-40" : ""}`}
            >
              {pending ? (
                <SkeletonBlock className="h-12 w-44" />
              ) : (
                <Sparkline points={revenuePoints} label="Revenue" />
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5">
            <p className="text-sm text-[#a1a1aa]">Uniques</p>
            {pending ? (
              <SkeletonBlock className="mt-3 h-9 w-20" />
            ) : (
              <p className="mt-2 text-3xl font-semibold tracking-tight">
                <CountUpInt
                  value={stats.rangeUniques}
                  refreshKey={refreshKey}
                  className="tabular-nums"
                />
              </p>
            )}
            <div
              className={`mt-4 transition-opacity ${pending ? "opacity-40" : ""}`}
            >
              {pending ? (
                <SkeletonBlock className="h-12 w-44" />
              ) : (
                <Sparkline
                  points={uniquePoints}
                  stroke="var(--chart-3)"
                  label="Uniques"
                />
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5">
            <p className="text-sm text-[#a1a1aa]">MRR</p>
            {pending ? (
              <SkeletonBlock className="mt-3 h-9 w-28" />
            ) : (
              <p className="mt-2 text-3xl font-semibold tracking-tight">
                <CountUpUsd
                  value={stats.mrr}
                  refreshKey={refreshKey}
                  className="tabular-nums"
                />
              </p>
            )}
            <p className="mt-1 text-xs text-[#71717a]">
              via Stripe Payments
            </p>
            <p className="mt-1 text-sm font-medium text-emerald-400">
              {pending ? (
                <SkeletonBlock className="h-4 w-24 bg-emerald-500/20" />
              ) : (
                <>
                  ARR{" "}
                  <CountUpUsd
                    value={stats.arr}
                    refreshKey={refreshKey}
                    duration={0.9}
                    className="tabular-nums"
                  />
                </>
              )}
            </p>
            <div
              className={`mt-3 transition-opacity ${pending ? "opacity-40" : ""}`}
            >
              {pending ? (
                <SkeletonBlock className="h-12 w-44" />
              ) : (
                <Sparkline
                  points={revenuePoints}
                  stroke="var(--chart-2)"
                  label="MRR"
                />
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-[#262626] bg-[#141414] p-6">
            <p className="text-base font-semibold">Payments breakdown</p>
            {pending ? (
              <div className="mt-5 space-y-3">
                <SkeletonBlock className="h-3.5 w-full rounded-full" />
                <SkeletonBlock className="h-4 w-3/4" />
                <SkeletonBlock className="h-4 w-2/3" />
                <SkeletonBlock className="h-4 w-1/2" />
              </div>
            ) : (
              <>
                <div className="mt-5">
                  <BreakdownBar
                    showLegend={false}
                    rows={stats.paymentsBreakdown.map((row) => ({
                      key: row.status.replaceAll("_", " "),
                      value: row.amount,
                    }))}
                    colors={Object.fromEntries(
                      stats.paymentsBreakdown.map((row) => [
                        row.status.replaceAll("_", " "),
                        STATUS_COLORS[row.status] ?? "#94a3b8",
                      ]),
                    )}
                  />
                </div>
                <ul
                  className="mt-5 space-y-3 text-sm"
                  aria-label="Payments breakdown legend"
                >
                  {stats.paymentsBreakdown.map((row) => (
                    <li
                      key={row.status}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="flex items-center gap-2 capitalize text-[#a1a1aa]">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{
                            background: STATUS_COLORS[row.status] ?? "#94a3b8",
                          }}
                          aria-hidden
                        />
                        {row.status.replaceAll("_", " ")}
                      </span>
                      <span className="font-semibold text-[#fafafa]">
                        {formatUsd(row.amount)}/mo ·{" "}
                        {((row.amount / breakdownTotal) * 100).toFixed(1)}%
                      </span>
                    </li>
                  ))}
                  {stats.paymentsBreakdown.length === 0 ? (
                    <li className="text-[#71717a]">No subscription data yet.</li>
                  ) : null}
                </ul>
              </>
            )}
          </div>

          <div className="rounded-2xl border border-[#262626] bg-[#141414] p-6">
            <p className="text-base font-semibold">Impression trend</p>
            <div className="mt-4">
              {pending ? (
                <SkeletonBlock className="h-56 w-full rounded-2xl" />
              ) : (
                <AreaLineChart
                  primary={pageviewPoints}
                  primaryStroke="var(--chart-4)"
                  heightClass="h-56"
                  label="Impressions"
                  secondaryLabel="Yesterday"
                />
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
