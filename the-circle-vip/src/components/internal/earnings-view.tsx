"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import {
  AreaLineChart,
  BreakdownBar,
} from "@/components/internal/charts";
import { CountryFlag } from "@/components/internal/country-flag";
import { ProprReferralsPanel } from "@/components/internal/propr-referrals-panel";
import { RevenueForecast } from "@/components/internal/revenue-forecast";
import {
  isLifetimeRange,
  type DashboardRange,
  type InternalDashboardStats,
} from "@/lib/internal-stats-types";
import { formatUsd } from "@/lib/internal-money";
import { FALLBACK_PLANS } from "@/lib/plans";
import type { ProprReferralSummary } from "@/lib/propr-referrals-types";

type EarningsTab = "overview" | "forecast" | "referrals";

const RANGES: { days: DashboardRange; label: string }[] = [
  { days: 1, label: "Today" },
  { days: 7, label: "7d" },
  { days: 14, label: "14d" },
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
  { days: 0, label: "Lifetime" },
];

function planLabel(planId: string) {
  if (planId in FALLBACK_PLANS) {
    return FALLBACK_PLANS[planId as keyof typeof FALLBACK_PLANS].label;
  }
  return planId;
}

function pct(part: number, whole: number) {
  if (whole <= 0) return "0%";
  return `${((part / whole) * 100).toFixed(1)}%`;
}

export function EarningsView({
  initialStats,
  proprReferrals = null,
}: {
  initialStats: InternalDashboardStats;
  proprReferrals?: ProprReferralSummary | null;
}) {
  const [stats, setStats] = useState(initialStats);
  const [referrals, setReferrals] = useState(proprReferrals);
  const [range, setRange] = useState<DashboardRange>(initialStats.rangeDays);
  const [tab, setTab] = useState<EarningsTab>("overview");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setReferrals(proprReferrals);
  }, [proprReferrals]);

  function refresh(days: DashboardRange) {
    setRange(days);
    startTransition(async () => {
      const res = await fetch(`/api/internal/stats?days=${days}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      setStats((await res.json()) as InternalDashboardStats);
    });
  }

  // Forecast needs a real trend window — bump Today/Lifetime → 30d when opening the tab.
  useEffect(() => {
    if (tab === "forecast" && (isLifetimeRange(range) || range < 30)) {
      refresh(30);
    }
  }, [tab, range]);

  const insights = useMemo(() => {
    const cardVolume = stats.rangeGross;
    const cryptoPayments = stats.crypto.payments;
    const lifetime = isLifetimeRange(stats.rangeDays);
    const rangeStart = lifetime
      ? 0
      : Date.now() - stats.rangeDays * 86_400_000;
    const cryptoInRange = lifetime
      ? cryptoPayments
      : cryptoPayments.filter((p) => Date.parse(p.createdAt) >= rangeStart);
    const cryptoVolume =
      cryptoInRange.reduce((sum, p) => sum + p.amountUsdc, 0) ||
      (lifetime ? stats.crypto.totals.revenueUsdc : 0);
    const gross = cardVolume + cryptoVolume;

    const cryptoByPlan = new Map<string, { amount: number; count: number }>();
    for (const payment of cryptoInRange) {
      const key = payment.planId || "unknown";
      const entry = cryptoByPlan.get(key) ?? { amount: 0, count: 0 };
      entry.amount += payment.amountUsdc;
      entry.count += 1;
      cryptoByPlan.set(key, entry);
    }

    const productRows = new Map<
      string,
      { planId: string; card: number; crypto: number; count: number }
    >();
    for (const row of stats.earnings.cardByPlan) {
      const entry = productRows.get(row.planId) ?? {
        planId: row.planId,
        card: 0,
        crypto: 0,
        count: 0,
      };
      entry.card += row.amount;
      entry.count += row.count;
      productRows.set(row.planId, entry);
    }
    for (const [planId, row] of cryptoByPlan) {
      const entry = productRows.get(planId) ?? {
        planId,
        card: 0,
        crypto: 0,
        count: 0,
      };
      entry.crypto += row.amount;
      entry.count += row.count;
      productRows.set(planId, entry);
    }

    const cryptoByCountry = new Map<string, { amount: number; count: number }>();
    for (const wallet of stats.crypto.wallets) {
      if (!wallet.totalUsdc) continue;
      const country = (wallet.lastCountry || "XX").toUpperCase();
      const entry = cryptoByCountry.get(country) ?? { amount: 0, count: 0 };
      entry.amount += wallet.totalUsdc;
      entry.count += wallet.payCount || 1;
      cryptoByCountry.set(country, entry);
    }

    const countryRows = new Map<
      string,
      { country: string; card: number; crypto: number; count: number }
    >();
    for (const row of stats.earnings.cardByCountry) {
      countryRows.set(row.country, {
        country: row.country,
        card: row.amount,
        crypto: 0,
        count: row.count,
      });
    }
    for (const [country, row] of cryptoByCountry) {
      const entry = countryRows.get(country) ?? {
        country,
        card: 0,
        crypto: 0,
        count: 0,
      };
      entry.crypto += row.amount;
      entry.count += row.count;
      countryRows.set(country, entry);
    }

    const cardSeries = stats.revenueSeries.map((d) => d.amount);
    const cryptoSeries = stats.crypto.series.map((d) => d.metrics.revenueUsdc);
    // Align lengths to the card series window.
    const alignedCrypto =
      cryptoSeries.length >= cardSeries.length
        ? cryptoSeries.slice(-cardSeries.length)
        : [
            ...Array(Math.max(0, cardSeries.length - cryptoSeries.length)).fill(
              0,
            ),
            ...cryptoSeries,
          ];

    const mrrByPlan = stats.store.map((plan) => ({
      key: plan.label,
      value: Math.round(plan.mrr),
    }));

    return {
      cardVolume,
      cryptoVolume,
      gross,
      cryptoInRange,
      productRows: [...productRows.values()].sort(
        (a, b) => b.card + b.crypto - (a.card + a.crypto),
      ),
      countryRows: [...countryRows.values()]
        .map((row) => ({
          ...row,
          total: row.card + row.crypto,
        }))
        .sort((a, b) => b.total - a.total),
      cardSeries,
      cryptoSeries: alignedCrypto,
      mrrByPlan,
      avgCard:
        stats.earnings.cardChargeCount > 0
          ? cardVolume / stats.earnings.cardChargeCount
          : 0,
      avgCrypto:
        cryptoInRange.length > 0 ? cryptoVolume / cryptoInRange.length : 0,
    };
  }, [stats]);

  const railColors = {
    Card: "#70a7ff",
    Crypto: "#34d399",
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[32px] font-semibold tracking-tight text-[#fafafa]">
            Earnings
          </h1>
          <p className="mt-1 text-[14px] text-[#a1a1aa]">
            {tab === "forecast"
              ? "Revenue forecast from MRR, cash run-rate, trials, and churn risk."
              : tab === "referrals"
                ? "Propr partner attribution — summed referral signups, purchase volume, and estimated commission."
                : "Gross volume across Stripe card and on-chain USDC — by rail, product, country, and source."}
            {pending ? " · refreshing…" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {tab === "overview"
            ? RANGES.map((item) => (
                <button
                  key={item.days}
                  type="button"
                  onClick={() => refresh(item.days)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                    range === item.days
                      ? "border-white bg-white text-black"
                      : "border-[#262626] bg-[#141414] text-[#a1a1aa] hover:bg-[#1c1c1c]"
                  }`}
                >
                  {item.label}
                </button>
              ))
            : tab === "forecast"
              ? ([30, 90] as DashboardRange[]).map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => refresh(days)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                      range === days
                        ? "border-white bg-white text-black"
                        : "border-[#262626] bg-[#141414] text-[#a1a1aa] hover:bg-[#1c1c1c]"
                    }`}
                  >
                    Trend {days}d
                  </button>
                ))
              : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-[#262626] bg-[#0f0f0f] p-1.5">
        <button
          type="button"
          onClick={() => setTab("overview")}
          className={`rounded-full px-4 py-2 text-[13px] font-semibold ${
            tab === "overview"
              ? "bg-white text-black"
              : "text-[#a1a1aa] hover:text-white"
          }`}
        >
          Overview
        </button>
        <button
          type="button"
          onClick={() => setTab("referrals")}
          className={`rounded-full px-4 py-2 text-[13px] font-semibold ${
            tab === "referrals"
              ? "bg-white text-black"
              : "text-[#a1a1aa] hover:text-white"
          }`}
        >
          Referrals
          {referrals ? (
            <span className="ml-2 rounded-md bg-[#70a7ff]/15 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-[#70a7ff] uppercase">
              Propr
            </span>
          ) : null}
        </button>
        <button
          type="button"
          onClick={() => setTab("forecast")}
          className={`rounded-full px-4 py-2 text-[13px] font-semibold ${
            tab === "forecast"
              ? "bg-white text-black"
              : "text-[#a1a1aa] hover:text-white"
          }`}
        >
          Revenue forecast
          <span className="ml-2 rounded-md bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-amber-200 uppercase">
            Key
          </span>
        </button>
      </div>

      {tab === "forecast" ? <RevenueForecast stats={stats} /> : null}
      {tab === "referrals" ? (
        <ProprReferralsPanel
          summary={referrals}
          onSummaryChange={setReferrals}
        />
      ) : null}

      {tab === "overview" ? (
      <>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5">
          <p className="text-[13px] text-[#a1a1aa]">Gross volume</p>
          <p className="mt-2 text-4xl font-semibold tracking-tight">
            {formatUsd(insights.gross)}
          </p>
          <p className="mt-2 text-[12px] text-[#71717a]">
            Card + crypto ·{" "}
            {isLifetimeRange(range)
              ? "lifetime"
              : range === 1
                ? "last day"
                : `last ${range} days`}
          </p>
        </div>
        <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5">
          <p className="text-[13px] text-[#a1a1aa]">Card (Stripe)</p>
          <p className="mt-2 text-4xl font-semibold tracking-tight text-[#70a7ff]">
            {formatUsd(insights.cardVolume)}
          </p>
          <p className="mt-2 text-[12px] text-[#71717a]">
            {stats.earnings.cardChargeCount} charges · avg{" "}
            {formatUsd(insights.avgCard)}
          </p>
        </div>
        <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5">
          <p className="text-[13px] text-[#a1a1aa]">Crypto (USDC)</p>
          <p className="mt-2 text-4xl font-semibold tracking-tight text-emerald-400">
            {formatUsd(insights.cryptoVolume)}
          </p>
          <p className="mt-2 text-[12px] text-[#71717a]">
            {insights.cryptoInRange.length} pays · avg{" "}
            {formatUsd(insights.avgCrypto)}
          </p>
        </div>
        <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5">
          <p className="text-[13px] text-[#a1a1aa]">Recurring MRR</p>
          <p className="mt-2 text-4xl font-semibold tracking-tight">
            {formatUsd(stats.mrr)}
          </p>
          <p className="mt-2 text-[12px] text-[#71717a]">
            {stats.activeSubscribers} active · ARR {formatUsd(stats.arr)}
          </p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
        <div className="rounded-2xl border border-[#262626] bg-[#141414] p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[15px] font-semibold">Volume over time</p>
            <p className="text-[12px] text-[#71717a]">
              Solid = card · dashed compare = crypto USDC
            </p>
          </div>
          <div className="mt-4">
            <AreaLineChart
              primary={insights.cardSeries}
              secondary={insights.cryptoSeries}
              primaryStroke="#70a7ff"
              secondaryStroke="#34d399"
              heightClass="h-72"
              label="Card"
              secondaryLabel="Crypto"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-[#262626] bg-[#141414] p-6">
            <p className="text-[15px] font-semibold">Rail mix</p>
            <div className="mt-5">
              <BreakdownBar
                rows={[
                  { key: "Card", value: Math.round(insights.cardVolume) },
                  { key: "Crypto", value: Math.round(insights.cryptoVolume) },
                ]}
                colors={railColors}
              />
            </div>
            <ul className="mt-4 space-y-2 text-[13px]">
              <li className="flex justify-between gap-3">
                <span className="text-[#a1a1aa]">Card share</span>
                <span className="font-semibold">
                  {pct(insights.cardVolume, insights.gross)}
                </span>
              </li>
              <li className="flex justify-between gap-3">
                <span className="text-[#a1a1aa]">Crypto share</span>
                <span className="font-semibold">
                  {pct(insights.cryptoVolume, insights.gross)}
                </span>
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-[#262626] bg-[#141414] p-6">
            <p className="text-[15px] font-semibold">Stripe balance</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight">
              {formatUsd(stats.balance.available)}
            </p>
            <p className="mt-2 text-[12px] text-[#a1a1aa]">
              Pending {formatUsd(stats.balance.pending)} · crypto settles to
              wallet
            </p>
            <a
              href="https://dashboard.stripe.com/balance/overview"
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex text-[13px] font-medium text-[#70a7ff] hover:underline"
            >
              Open Stripe balance
            </a>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#262626] bg-[#141414] p-6">
        <p className="text-[15px] font-semibold">By product</p>
        <p className="mt-1 text-[12px] text-[#71717a]">
          Gross in range · card charges + crypto pays by plan
        </p>
        <div className="mt-5 overflow-hidden rounded-xl border border-[#262626]">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-[#0f0f0f] text-[#a1a1aa]">
              <tr>
                <th className="px-3 py-2 font-medium">Plan</th>
                <th className="px-3 py-2 font-medium">Card</th>
                <th className="px-3 py-2 font-medium">Crypto</th>
                <th className="px-3 py-2 font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#262626]">
              {insights.productRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-6 text-center text-[#71717a]"
                  >
                    No product revenue in this window.
                  </td>
                </tr>
              ) : (
                insights.productRows.map((row) => (
                  <tr key={row.planId}>
                    <td className="px-3 py-2.5 font-medium text-[#fafafa]">
                      {planLabel(row.planId)}
                      <span className="ml-2 text-[11px] text-[#71717a]">
                        {row.count} tx
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-[#70a7ff]">
                      {formatUsd(row.card)}
                    </td>
                    <td className="px-3 py-2.5 text-emerald-400">
                      {formatUsd(row.crypto)}
                    </td>
                    <td className="px-3 py-2.5 font-semibold">
                      {formatUsd(row.card + row.crypto)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-5">
          <p className="text-[13px] font-medium text-[#a1a1aa]">
            Active MRR mix
          </p>
          <div className="mt-3">
            <BreakdownBar
              rows={insights.mrrByPlan}
              colors={{
                "1 Month": "#38bdf8",
                "3 Months": "#a78bfa",
                "One Year": "#f59e0b",
              }}
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#262626] bg-[#141414] p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[15px] font-semibold">By country</p>
            <p className="mt-1 text-[12px] text-[#71717a]">
              Card from Stripe billing country · crypto from wallet last country
            </p>
          </div>
          <p className="text-[12px] text-[#71717a]">
            {insights.countryRows.length} countries
          </p>
        </div>

        {insights.countryRows.length === 0 ? (
          <p className="mt-5 text-[13px] text-[#71717a]">
            No geo revenue signals yet.
          </p>
        ) : (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {insights.countryRows.slice(0, 24).map((row, index) => {
              const share = pct(row.total, insights.gross);
              const isHero = index === 0;
              return (
                <div
                  key={row.country}
                  className={`flex flex-col rounded-2xl border border-[#262626] bg-[#0f0f0f] p-4 ${
                    isHero
                      ? "col-span-2 row-span-2 min-h-[180px] sm:min-h-[220px]"
                      : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="inline-flex items-center gap-2 text-[13px] font-semibold tracking-wide text-[#fafafa]">
                      <CountryFlag
                        code={row.country}
                        size={isHero ? 28 : 20}
                      />
                      {row.country}
                    </span>
                    <span
                      className={`font-semibold tabular-nums text-[#fafafa] ${
                        isHero ? "text-2xl" : "text-[13px]"
                      }`}
                    >
                      {formatUsd(row.total)}
                    </span>
                  </div>
                  <div
                    className={`mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[#a1a1aa] ${
                      isHero ? "text-[12px]" : "text-[11px]"
                    }`}
                  >
                    <span>Card {formatUsd(row.card)}</span>
                    <span>Crypto {formatUsd(row.crypto)}</span>
                    <span>{row.count} txs</span>
                    <span>{share} of gross</span>
                  </div>
                  <div className="mt-auto pt-4">
                    <div className="h-1.5 overflow-hidden rounded-full bg-[#262626]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#70a7ff] to-emerald-400"
                        style={{ width: share }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#262626] bg-[#141414] p-6">
          <p className="text-[15px] font-semibold">Card sources</p>
          <p className="mt-1 text-[12px] text-[#71717a]">
            Checkout vs claim links vs Whop migration vs other Stripe metadata
          </p>
          <ul className="mt-5 space-y-2 text-[13px]">
            {stats.earnings.cardBySource.length === 0 ? (
              <li className="text-[#71717a]">No card charges in range.</li>
            ) : (
              stats.earnings.cardBySource.map((row) => (
                <li
                  key={row.source}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2.5"
                >
                  <span className="capitalize text-[#a1a1aa]">
                    {row.source.replaceAll("_", " ")}
                    <span className="ml-2 text-[11px] text-[#71717a]">
                      {row.count}×
                    </span>
                  </span>
                  <span className="font-semibold text-[#fafafa]">
                    {formatUsd(row.amount)}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="rounded-2xl border border-[#262626] bg-[#141414] p-6">
          <p className="text-[15px] font-semibold">Crypto rails</p>
          <p className="mt-1 text-[12px] text-[#71717a]">
            Chains & wallets from the crypto funnel
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-[12px] font-medium text-[#a1a1aa]">By chain</p>
              <ul className="mt-2 space-y-1.5 text-[13px]">
                {Object.entries(stats.crypto.totals.byChain)
                  .sort((a, b) => b[1] - a[1])
                  .map(([chain, count]) => (
                    <li key={chain} className="flex justify-between gap-2">
                      <span className="text-[#d4d4d8]">{chain || "unknown"}</span>
                      <span className="font-semibold">{count}</span>
                    </li>
                  ))}
                {Object.keys(stats.crypto.totals.byChain).length === 0 ? (
                  <li className="text-[#71717a]">No chain data.</li>
                ) : null}
              </ul>
            </div>
            <div>
              <p className="text-[12px] font-medium text-[#a1a1aa]">By wallet</p>
              <ul className="mt-2 space-y-1.5 text-[13px]">
                {Object.entries(stats.crypto.totals.byWallet)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 8)
                  .map(([brand, count]) => (
                    <li key={brand} className="flex justify-between gap-2">
                      <span className="text-[#d4d4d8]">{brand || "unknown"}</span>
                      <span className="font-semibold">{count}</span>
                    </li>
                  ))}
                {Object.keys(stats.crypto.totals.byWallet).length === 0 ? (
                  <li className="text-[#71717a]">No wallet data.</li>
                ) : null}
              </ul>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 text-[12px]">
            <div className="rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2">
              <p className="text-[#71717a]">View → paid</p>
              <p className="mt-1 text-[18px] font-semibold text-[#fafafa]">
                {stats.crypto.conversion.viewToPaid == null
                  ? "—"
                  : `${(stats.crypto.conversion.viewToPaid * 100).toFixed(1)}%`}
              </p>
            </div>
            <div className="rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2">
              <p className="text-[#71717a]">Paid events</p>
              <p className="mt-1 text-[18px] font-semibold text-[#fafafa]">
                {stats.crypto.totals.paid.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </section>
      </>
      ) : null}
    </div>
  );
}
