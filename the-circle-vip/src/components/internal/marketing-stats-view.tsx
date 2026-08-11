"use client";

import { useState, useTransition, type ReactNode } from "react";

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
import {
  buildMarketingStatsShowcase,
  formatPct,
  type MarketingStatsShowcase,
} from "@/lib/marketing-stats";

const STATUS_COLORS: Record<string, string> = {
  succeeded: "#34d399",
  paid: "#34d399",
  pending: "#fbbf24",
  failed: "#f87171",
  refunded: "#a78bfa",
  canceled: "#71717a",
  cancelled: "#71717a",
  active: "#34d399",
  trialing: "#60a5fa",
  past_due: "#fbbf24",
  unpaid: "#f87171",
};

const RANGES: { days: DashboardRange; label: string }[] = [
  { days: 1, label: "Today" },
  { days: 7, label: "7d" },
  { days: 14, label: "14d" },
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
];

function Section({
  title,
  body,
  action,
  children,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-[#fafafa]">
            {title}
          </h2>
          {body ? (
            <p className="mt-1 max-w-2xl text-sm text-[#a1a1aa]">{body}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function MetricCard({
  label,
  hint,
  pending,
  children,
  accent,
}: {
  label: string;
  hint?: string;
  pending?: boolean;
  children: ReactNode;
  accent?: string;
}) {
  return (
    <div
      className={`rounded-2xl border bg-[#141414] p-5 ${
        accent ?? "border-[#262626]"
      }`}
    >
      <p className="text-[12px] font-medium tracking-wide text-[#a1a1aa] uppercase">
        {label}
      </p>
      {pending ? (
        <SkeletonBlock className="mt-3 h-9 w-28" />
      ) : (
        <div className="mt-2 text-3xl font-semibold tracking-tight tabular-nums text-[#fafafa]">
          {children}
        </div>
      )}
      {hint ? <p className="mt-1.5 text-[12px] text-[#71717a]">{hint}</p> : null}
    </div>
  );
}

function ConversionPill({
  label,
  value,
  pending,
}: {
  label: string;
  value: number | null;
  pending?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[#262626] bg-[#0f0f0f] px-4 py-4">
      <p className="text-[12px] text-[#a1a1aa]">{label}</p>
      {pending ? (
        <SkeletonBlock className="mt-2 h-8 w-20" />
      ) : (
        <p className="mt-1 font-[family-name:var(--font-syne)] text-3xl font-semibold text-[#5ce1ff] tabular-nums">
          {formatPct(value)}
        </p>
      )}
    </div>
  );
}

export function MarketingStatsView({
  initialStats,
}: {
  initialStats: InternalDashboardStats;
}) {
  const [stats, setStats] = useState(initialStats);
  const [range, setRange] = useState<DashboardRange>(initialStats.rangeDays);
  const [pending, startTransition] = useTransition();
  const [refreshKey, setRefreshKey] = useState(0);

  const board: MarketingStatsShowcase = buildMarketingStatsShowcase(stats);

  function refresh(days: DashboardRange) {
    setRange(days);
    startTransition(async () => {
      const res = await fetch(`/api/internal/stats?days=${days}`, {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) return;
      setStats((await res.json()) as InternalDashboardStats);
      setRefreshKey((k) => k + 1);
    });
  }

  const rangeLabel =
    RANGES.find((r) => r.days === range)?.label ?? `${range}d`;

  return (
    <div className="mx-auto max-w-7xl space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold tracking-[0.18em] text-[#ff6a00] uppercase">
            Marketing
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#fafafa]">
            Stats
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[#a1a1aa]">
            Visitors, conversion, financial run-rate, product mix, and impact —
            one board for how The Circle is performing.
          </p>
          <p className="mt-2 text-[12px] text-[#71717a]">
            Updated {new Date(board.generatedAt).toLocaleString()}
            {pending ? " · refreshing…" : ""} · Traffic SoT:{" "}
            {board.trafficSource === "cloudflare" ? "Cloudflare" : "First-party"}
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

      {/* Hero KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total visitors"
          hint={`${rangeLabel} uniques · ${board.visitors.todayUniques} today`}
          pending={pending}
          accent="border-cyan-500/25"
        >
          <CountUpInt
            value={board.visitors.totalUniques}
            refreshKey={refreshKey}
          />
        </MetricCard>
        <MetricCard
          label="Visitor → member"
          hint={`${board.conversion.activeMembers} active · ${board.conversion.conversionLeads} leads`}
          pending={pending}
          accent="border-amber-500/25"
        >
          {formatPct(board.conversion.visitorToMemberPct)}
        </MetricCard>
        <MetricCard
          label="MRR"
          hint={`ARR ${formatUsd(board.financial.arr)}`}
          pending={pending}
          accent="border-emerald-500/25"
        >
          <CountUpUsd value={board.financial.mrr} refreshKey={refreshKey} />
        </MetricCard>
        <MetricCard
          label="Active members"
          hint={`${board.impact.whopMembers} Whop · ${board.impact.stripeNativeMembers} Stripe`}
          pending={pending}
          accent="border-violet-500/25"
        >
          <CountUpInt
            value={board.impact.activeMembers}
            refreshKey={refreshKey}
          />
        </MetricCard>
      </div>

      <Section
        title="Visitors"
        body="Reach across the marketing site and join funnel."
        action={
          <a
            href="/internal/traffic"
            className="text-sm font-medium text-[#70a7ff] hover:underline"
          >
            Open Traffic →
          </a>
        }
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5 lg:col-span-2">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-[#d4d4d8]">
                Impressions vs uniques
              </p>
              <p className="text-[12px] text-[#71717a]">
                {pending ? (
                  <SkeletonBlock className="inline-block h-4 w-32" />
                ) : (
                  <>
                    <CountUpInt
                      value={board.visitors.totalPageviews}
                      refreshKey={refreshKey}
                    />{" "}
                    impressions ·{" "}
                    <CountUpInt
                      value={board.visitors.totalUniques}
                      refreshKey={refreshKey}
                    />{" "}
                    uniques
                  </>
                )}
              </p>
            </div>
            {pending ? (
              <SkeletonBlock className="h-64 w-full" />
            ) : (
              <AreaLineChart
                primary={board.visitors.pageviewSeries}
                secondary={board.visitors.uniqueSeries}
                labels={board.visitors.seriesLabels}
                primaryStroke="var(--chart-4)"
                secondaryStroke="var(--chart-3)"
                label="Impressions"
                secondaryLabel="Uniques"
                heightClass="h-64"
              />
            )}
          </div>
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5">
              <p className="text-sm font-medium text-[#d4d4d8]">Today</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px] text-[#71717a]">Impressions</p>
                  <p className="text-2xl font-semibold tabular-nums">
                    {pending ? (
                      <SkeletonBlock className="h-8 w-16" />
                    ) : (
                      <CountUpInt
                        value={board.visitors.todayPageviews}
                        refreshKey={refreshKey}
                      />
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-[#71717a]">Uniques</p>
                  <p className="text-2xl font-semibold tabular-nums">
                    {pending ? (
                      <SkeletonBlock className="h-8 w-16" />
                    ) : (
                      <CountUpInt
                        value={board.visitors.todayUniques}
                        refreshKey={refreshKey}
                      />
                    )}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-[12px] text-[#71717a]">
                Yesterday {board.visitors.yesterdayPageviews} imp ·{" "}
                {board.visitors.yesterdayUniques} uniques
              </p>
              {!pending ? (
                <div className="mt-3">
                  <Sparkline
                    points={board.visitors.pageviewSeries}
                    stroke="var(--chart-4)"
                    label="Impressions"
                  />
                </div>
              ) : null}
            </div>
            <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5">
              <p className="text-sm font-medium text-[#d4d4d8]">
                Countries reached
              </p>
              <p className="mt-2 text-3xl font-semibold tabular-nums">
                {pending ? (
                  <SkeletonBlock className="h-9 w-16" />
                ) : (
                  <CountUpInt
                    value={board.visitors.countriesReached}
                    refreshKey={refreshKey}
                  />
                )}
              </p>
              <ul className="mt-3 max-h-40 space-y-1.5 overflow-y-auto text-[12px]">
                {board.visitors.topCountries.map((row) => (
                  <li
                    key={row.country}
                    className="flex justify-between gap-2 text-[#a1a1aa]"
                  >
                    <span>{row.country || "—"}</span>
                    <span className="tabular-nums text-[#fafafa]">
                      {row.pageviews}
                    </span>
                  </li>
                ))}
                {board.visitors.topCountries.length === 0 ? (
                  <li className="text-[#71717a]">No country data yet.</li>
                ) : null}
              </ul>
            </div>
          </div>
        </div>
      </Section>

      <Section
        title="Conversion"
        body="How traffic and leads turn into paid Circle members."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ConversionPill
            label="Visitor → member"
            value={board.conversion.visitorToMemberPct}
            pending={pending}
          />
          <ConversionPill
            label="Lead → paid"
            value={board.conversion.leadToPaidPct}
            pending={pending}
          />
          <ConversionPill
            label="Crypto view → paid"
            value={board.conversion.cryptoViewToPaidPct}
            pending={pending}
          />
          <ConversionPill
            label="Crypto connect → sign"
            value={board.conversion.cryptoConnectToSignPct}
            pending={pending}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard
            label="Paying members"
            hint="Active with paid history / MRR"
            pending={pending}
          >
            <CountUpInt
              value={board.conversion.payingMembers}
              refreshKey={refreshKey}
            />
          </MetricCard>
          <MetricCard
            label="Conversion leads"
            hint="Trialing / unpaid Whop"
            pending={pending}
          >
            <CountUpInt
              value={board.conversion.conversionLeads}
              refreshKey={refreshKey}
            />
          </MetricCard>
          <MetricCard
            label="Crypto funnel"
            hint={`View→connect ${formatPct(board.conversion.cryptoViewToConnectPct)} · Sign→paid ${formatPct(board.conversion.cryptoSignToPaidPct)}`}
            pending={pending}
          >
            {formatPct(board.conversion.cryptoViewToPaidPct)}
          </MetricCard>
        </div>
      </Section>

      <Section
        title="Financial"
        body="Revenue run-rate across The Circle and Referrals."
        action={
          <a
            href="/internal/earnings"
            className="text-sm font-medium text-[#70a7ff] hover:underline"
          >
            Open Earnings →
          </a>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="All-time revenue" pending={pending}>
            <CountUpUsd
              value={board.financial.allTimeRevenue}
              refreshKey={refreshKey}
            />
          </MetricCard>
          <MetricCard
            label={`${rangeLabel} gross`}
            pending={pending}
            hint={
              board.financial.todayPctChange != null
                ? `Today ${formatUsd(board.financial.todayGross)} (${board.financial.todayPctChange >= 0 ? "+" : ""}${board.financial.todayPctChange.toFixed(0)}% vs yday)`
                : `Today ${formatUsd(board.financial.todayGross)}`
            }
          >
            <CountUpUsd
              value={board.financial.rangeGross}
              refreshKey={refreshKey}
            />
          </MetricCard>
          <MetricCard
            label="ARPU"
            hint="MRR ÷ paying members"
            pending={pending}
          >
            {board.financial.arpu != null ? (
              <CountUpUsd
                value={board.financial.arpu}
                refreshKey={refreshKey}
              />
            ) : (
              "—"
            )}
          </MetricCard>
          <MetricCard
            label="Avg order"
            hint="Stripe all-time ÷ paid charges"
            pending={pending}
          >
            {board.financial.avgOrderValue != null ? (
              <CountUpUsd
                value={board.financial.avgOrderValue}
                refreshKey={refreshKey}
              />
            ) : (
              "—"
            )}
          </MetricCard>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5 lg:col-span-2">
            <p className="mb-3 text-sm font-medium text-[#d4d4d8]">
              Revenue series
            </p>
            {pending ? (
              <SkeletonBlock className="h-64 w-full" />
            ) : (
              <AreaLineChart
                primary={board.financial.revenueSeries}
                labels={board.financial.revenueLabels}
                primaryStroke="var(--chart-2)"
                label="Revenue"
                heightClass="h-64"
                showLegend={false}
              />
            )}
          </div>
          <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5">
            <p className="text-sm font-medium text-[#d4d4d8]">
              Payments breakdown
            </p>
            {pending ? (
              <div className="mt-4 space-y-3">
                <SkeletonBlock className="h-3.5 w-full rounded-full" />
                <SkeletonBlock className="h-4 w-3/4" />
              </div>
            ) : (
              <div className="mt-4">
                <BreakdownBar
                  showLegend={false}
                  rows={board.financial.paymentsBreakdown.map((row) => ({
                    key: row.status.replaceAll("_", " "),
                    value: row.amount,
                  }))}
                  colors={Object.fromEntries(
                    board.financial.paymentsBreakdown.map((row) => [
                      row.status.replaceAll("_", " "),
                      STATUS_COLORS[row.status] ?? "#94a3b8",
                    ]),
                  )}
                />
                <ul className="mt-4 space-y-1.5 text-[12px] text-[#a1a1aa]">
                  {board.financial.paymentsBreakdown.map((row) => (
                    <li key={row.status} className="flex justify-between gap-2">
                      <span className="capitalize">
                        {row.status.replaceAll("_", " ")}
                      </span>
                      <span className="tabular-nums text-[#fafafa]">
                        {formatUsd(row.amount)} · {row.count}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-5 border-t border-[#262626] pt-4 text-[12px] text-[#71717a]">
              Balance {formatUsd(board.financial.balanceAvailable)} available ·{" "}
              {formatUsd(board.financial.balancePending)} pending
            </div>
          </div>
        </div>
      </Section>

      <Section
        title="Product"
        body="Live plans, subscriber mix, and partner surface."
        action={
          <a
            href="/internal/products"
            className="text-sm font-medium text-[#70a7ff] hover:underline"
          >
            Open Products →
          </a>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Live plans" pending={pending}>
            <CountUpInt
              value={board.product.livePlans}
              refreshKey={refreshKey}
            />
          </MetricCard>
          <MetricCard label="Plan subscribers" pending={pending}>
            <CountUpInt
              value={board.product.totalPlanSubscribers}
              refreshKey={refreshKey}
            />
          </MetricCard>
          <MetricCard label="Checkout starts" pending={pending}>
            <CountUpInt
              value={board.product.checkoutStarts}
              refreshKey={refreshKey}
            />
          </MetricCard>
          <MetricCard label="Partners" pending={pending}>
            <CountUpInt
              value={board.product.partnerCount}
              refreshKey={refreshKey}
            />
          </MetricCard>
        </div>
        <div className="overflow-hidden rounded-2xl border border-[#262626]">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-[#141414] text-[12px] tracking-wide text-[#a1a1aa] uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Subscribers</th>
                <th className="px-4 py-3 font-medium">MRR</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#262626] bg-[#0f0f0f]">
              {board.product.plans.map((plan) => (
                <tr key={plan.id}>
                  <td className="px-4 py-3 font-medium text-[#fafafa]">
                    {plan.label}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-[#d4d4d8]">
                    {formatUsd(plan.amountEur)}
                    <span className="ml-1 text-[11px] text-[#71717a]">
                      · {plan.amountUsd} USDC
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {plan.subscribers}
                  </td>
                  <td className="px-4 py-3 tabular-nums font-semibold">
                    {formatUsd(plan.mrr)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                        plan.active
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-zinc-500/15 text-zinc-400"
                      }`}
                    >
                      {plan.active ? "Live" : "Off"}
                    </span>
                  </td>
                </tr>
              ))}
              {board.product.plans.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-[#71717a]"
                  >
                    No plans in catalog yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        title="Impact"
        body="Reach, reputation, and how members found The Circle."
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Member rating"
            hint={board.impact.reviewBlurb}
            pending={pending}
            accent="border-[#ff6a00]/30"
          >
            {board.impact.rating}
          </MetricCard>
          <MetricCard
            label="Countries"
            hint="From traffic SoT"
            pending={pending}
          >
            <CountUpInt
              value={board.impact.countriesReached}
              refreshKey={refreshKey}
            />
          </MetricCard>
          <MetricCard
            label="Card charges"
            hint="Earnings card count"
            pending={pending}
          >
            <CountUpInt
              value={board.impact.cardChargeCount}
              refreshKey={refreshKey}
            />
          </MetricCard>
          <MetricCard
            label="Crypto paid"
            hint={`${formatUsd(board.impact.cryptoRevenueUsdc)} USDC`}
            pending={pending}
          >
            <CountUpInt
              value={board.impact.cryptoPaid}
              refreshKey={refreshKey}
            />
          </MetricCard>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5">
            <p className="text-sm font-medium text-[#d4d4d8]">Member mix</p>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] text-[#71717a]">Whop migrants</p>
                <p className="text-2xl font-semibold tabular-nums">
                  {board.impact.whopMembers}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-[#71717a]">Stripe native</p>
                <p className="text-2xl font-semibold tabular-nums">
                  {board.impact.stripeNativeMembers}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-[#71717a]">Partners</p>
                <p className="text-2xl font-semibold tabular-nums">
                  {board.impact.partnerCount}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-[#71717a]">Feature tiles</p>
                <p className="text-2xl font-semibold tabular-nums">
                  {board.impact.featureCount}
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5">
            <p className="text-sm font-medium text-[#d4d4d8]">Top paths</p>
            <ul className="mt-3 space-y-1.5 text-[12px]">
              {board.visitors.topPaths.map((row) => (
                <li
                  key={row.path}
                  className="flex justify-between gap-3 text-[#a1a1aa]"
                >
                  <span className="truncate font-mono">{row.path || "/"}</span>
                  <span className="shrink-0 tabular-nums text-[#fafafa]">
                    {row.pageviews}
                  </span>
                </li>
              ))}
              {board.visitors.topPaths.length === 0 ? (
                <li className="text-[#71717a]">No path data yet.</li>
              ) : null}
            </ul>
          </div>
        </div>
      </Section>
    </div>
  );
}
