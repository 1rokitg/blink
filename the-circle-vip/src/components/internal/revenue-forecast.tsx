"use client";

import { useMemo } from "react";

import { AreaLineChart, BreakdownBar } from "@/components/internal/charts";
import { CountUpUsd } from "@/components/internal/count-up-stat";
import type { InternalDashboardStats } from "@/lib/internal-stats-types";
import { formatUsd } from "@/lib/internal-money";
import { FALLBACK_PLANS } from "@/lib/plans";

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function growthRate(series: number[]) {
  if (series.length < 4) return 0;
  const mid = Math.floor(series.length / 2);
  const first = average(series.slice(0, mid));
  const second = average(series.slice(mid));
  if (first <= 0) return second > 0 ? 0.15 : 0;
  return Math.max(-0.5, Math.min(1.5, (second - first) / first));
}

function projectDays(daily: number, days: number, monthlyGrowth: number) {
  // Compound a mild daily growth derived from observed window growth.
  const dailyGrowth = monthlyGrowth / 30;
  const out: number[] = [];
  let cursor = daily;
  for (let i = 0; i < days; i += 1) {
    cursor = Math.max(0, cursor * (1 + dailyGrowth));
    out.push(cursor);
  }
  return out;
}

export function RevenueForecast({ stats }: { stats: InternalDashboardStats }) {
  const model = useMemo(() => {
    const cardDaily = stats.revenueSeries.map((d) => d.amount);
    const cryptoDaily = stats.crypto.series.map((d) => d.metrics.revenueUsdc);
    const len = Math.max(cardDaily.length, cryptoDaily.length, 1);
    const grossDaily = Array.from({ length: len }, (_, index) => {
      const card = cardDaily[cardDaily.length - len + index] ?? 0;
      const crypto = cryptoDaily[cryptoDaily.length - len + index] ?? 0;
      return card + crypto;
    });

    const recentWindow = Math.min(14, grossDaily.length);
    const recentGross = grossDaily.slice(-recentWindow);
    const dailyRunRate = average(recentGross);
    const monthlyFromGross = dailyRunRate * 30;
    const mrr = stats.mrr;
    const arr = stats.arr;

    const active = stats.members.filter(
      (m) => m.status === "active" || m.status === "trialing",
    );
    const trialing = stats.members.filter((m) => m.status === "trialing");
    const canceling = active.filter((m) => m.cancelAtPeriodEnd);
    const paidActive = active.filter((m) => m.status === "active");

    const atRiskMrr = canceling.reduce((sum, m) => sum + m.mrr, 0);
    const trialMrr = trialing.reduce((sum, m) => sum + m.mrr, 0);

    const windowGrowth = growthRate(grossDaily);
    // Blend subscription MRR with observed cash collections run-rate.
    const baseMonthly = Math.max(mrr, monthlyFromGross * 0.85);
    const conservativeMonthly = Math.max(
      0,
      baseMonthly - atRiskMrr + trialMrr * 0.25,
    );
    const optimisticMonthly =
      baseMonthly * (1 + Math.max(0.05, windowGrowth)) + trialMrr * 0.7;

    const horizons = [
      { key: "30d", label: "Next 30 days", days: 30 },
      { key: "90d", label: "Next 90 days", days: 90 },
      { key: "12m", label: "Next 12 months", days: 365 },
    ] as const;

    const scenarios = horizons.map((horizon) => {
      const months = horizon.days / 30;
      return {
        ...horizon,
        conservative: conservativeMonthly * months,
        base: baseMonthly * months,
        optimistic: optimisticMonthly * months,
      };
    });

    const history = grossDaily.slice(-30);
    const forecastBase = projectDays(
      dailyRunRate || baseMonthly / 30,
      30,
      windowGrowth,
    );
    const forecastUp = projectDays(
      (dailyRunRate || baseMonthly / 30) * 1.08,
      30,
      Math.max(windowGrowth, 0.1),
    );

    // Chart: history then forecast; secondary shows upside path on the forecast window.
    const chartPrimary = [...history, ...forecastBase];
    const chartSecondary = [
      ...history,
      ...forecastUp,
    ];

    const planMix = stats.store
      .filter((plan) => plan.mrr > 0 || plan.subscribers > 0)
      .map((plan) => ({
        key: plan.label,
        value: Math.round(plan.mrr),
        subscribers: plan.subscribers,
        amountUsd: plan.amountEur ?? plan.amountUsd,
        id: plan.id,
      }));

    const renewals30 = paidActive.filter((member) => {
      const due = member.dueAt ?? member.currentPeriodEnd;
      if (!due) return false;
      const end = Date.parse(due);
      const delta = end - Date.now();
      return delta >= 0 && delta <= 30 * 86_400_000;
    });
    const renewalMrr = renewals30.reduce((sum, m) => sum + m.mrr, 0);

    return {
      dailyRunRate,
      monthlyFromGross,
      mrr,
      arr,
      windowGrowth,
      baseMonthly,
      conservativeMonthly,
      optimisticMonthly,
      atRiskMrr,
      trialMrr,
      cancelingCount: canceling.length,
      trialingCount: trialing.length,
      activeCount: active.length,
      scenarios,
      chartPrimary,
      chartSecondary,
      historyLen: history.length,
      planMix,
      renewals30: renewals30.length,
      renewalMrr,
      cardShare:
        monthlyFromGross > 0
          ? average(cardDaily.slice(-recentWindow)) /
            Math.max(dailyRunRate, 0.0001)
          : mrr > 0
            ? 1
            : 0,
    };
  }, [stats]);

  const growthLabel =
    model.windowGrowth === 0
      ? "flat"
      : `${model.windowGrowth > 0 ? "+" : ""}${(model.windowGrowth * 100).toFixed(1)}% vs prior half-window`;

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-[13px] text-amber-100/90">
        Forward model blends <span className="font-semibold">live MRR</span>,
        recent card+crypto cash run-rate, trial conversion assumptions, and
        cancel-at-period-end risk. Not a guarantee — a planning lens.
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5">
          <p className="text-[13px] text-[#a1a1aa]">Base monthly run-rate</p>
          <p className="mt-2 text-4xl font-semibold tracking-tight">
            <CountUpUsd value={model.baseMonthly} className="tabular-nums" />
          </p>
          <p className="mt-2 text-[12px] text-[#71717a]">
            MRR {formatUsd(model.mrr)} · cash/30d{" "}
            {formatUsd(model.monthlyFromGross)}
          </p>
        </div>
        <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5">
          <p className="text-[13px] text-[#a1a1aa]">Projected ARR</p>
          <p className="mt-2 text-4xl font-semibold tracking-tight">
            <CountUpUsd
              value={model.baseMonthly * 12}
              className="tabular-nums"
            />
          </p>
          <p className="mt-2 text-[12px] text-[#71717a]">
            Stripe ARR today {formatUsd(model.arr)}
          </p>
        </div>
        <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5">
          <p className="text-[13px] text-[#a1a1aa]">Trend signal</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-[#fafafa]">
            {growthLabel}
          </p>
          <p className="mt-2 text-[12px] text-[#71717a]">
            Daily cash avg {formatUsd(model.dailyRunRate)}
          </p>
        </div>
        <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5">
          <p className="text-[13px] text-[#a1a1aa]">Revenue at risk (30d)</p>
          <p className="mt-2 text-4xl font-semibold tracking-tight text-amber-300">
            <CountUpUsd value={model.atRiskMrr} className="tabular-nums" />
          </p>
          <p className="mt-2 text-[12px] text-[#71717a]">
            {model.cancelingCount} members canceling at period end
          </p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.45fr_0.85fr]">
        <div className="rounded-2xl border border-[#262626] bg-[#141414] p-6">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-[15px] font-semibold">30-day forward path</p>
              <p className="mt-1 text-[12px] text-[#71717a]">
                Left = recent actuals · right = base vs upside forecast
              </p>
            </div>
            <p className="text-[12px] text-[#a1a1aa]">
              History {model.historyLen}d → +30d
            </p>
          </div>
          <div className="mt-4">
            <AreaLineChart
              primary={model.chartPrimary}
              secondary={model.chartSecondary}
              primaryStroke="#f59e0b"
              secondaryStroke="#34d399"
              heightClass="h-80"
              label="Base forecast"
              secondaryLabel="Upside"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-[#262626] bg-[#141414] p-6">
            <p className="text-[15px] font-semibold">Scenario band</p>
            <ul className="mt-4 space-y-3 text-[13px]">
              <li className="flex items-center justify-between gap-3 rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2.5">
                <span className="text-[#a1a1aa]">Conservative / mo</span>
                <span className="font-semibold text-[#fafafa]">
                  {formatUsd(model.conservativeMonthly)}
                </span>
              </li>
              <li className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2.5">
                <span className="text-amber-100">Base / mo</span>
                <span className="font-semibold text-amber-50">
                  {formatUsd(model.baseMonthly)}
                </span>
              </li>
              <li className="flex items-center justify-between gap-3 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-2.5">
                <span className="text-emerald-200">Optimistic / mo</span>
                <span className="font-semibold text-emerald-100">
                  {formatUsd(model.optimisticMonthly)}
                </span>
              </li>
            </ul>
            <p className="mt-3 text-[11px] leading-relaxed text-[#71717a]">
              Conservative subtracts canceling MRR and only banks 25% of trial
              MRR. Optimistic adds trend lift and 70% trial conversion.
            </p>
          </div>

          <div className="rounded-2xl border border-[#262626] bg-[#141414] p-6">
            <p className="text-[15px] font-semibold">Near-term renewals</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight">
              {formatUsd(model.renewalMrr)}
            </p>
            <p className="mt-2 text-[12px] text-[#a1a1aa]">
              {model.renewals30} active subs renew in the next 30 days
            </p>
            <p className="mt-3 text-[12px] text-[#71717a]">
              {model.trialingCount} trialing · {model.activeCount} active/trial
              total
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#262626] bg-[#141414] p-6">
        <p className="text-[15px] font-semibold">Horizon projections</p>
        <p className="mt-1 text-[12px] text-[#71717a]">
          Cumulative expected gross under each scenario
        </p>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead className="text-[#a1a1aa]">
              <tr className="border-b border-[#262626]">
                <th className="px-3 py-2 font-medium">Horizon</th>
                <th className="px-3 py-2 font-medium">Conservative</th>
                <th className="px-3 py-2 font-medium">Base</th>
                <th className="px-3 py-2 font-medium">Optimistic</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#262626]">
              {model.scenarios.map((row) => (
                <tr key={row.key}>
                  <td className="px-3 py-3 font-medium text-[#fafafa]">
                    {row.label}
                  </td>
                  <td className="px-3 py-3 text-[#a1a1aa]">
                    {formatUsd(row.conservative)}
                  </td>
                  <td className="px-3 py-3 font-semibold text-amber-200">
                    {formatUsd(row.base)}
                  </td>
                  <td className="px-3 py-3 font-semibold text-emerald-300">
                    {formatUsd(row.optimistic)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#262626] bg-[#141414] p-6">
          <p className="text-[15px] font-semibold">MRR by product</p>
          <p className="mt-1 text-[12px] text-[#71717a]">
            What the forecast is standing on today
          </p>
          <div className="mt-5">
            <BreakdownBar
              rows={model.planMix.map((row) => ({
                key: row.key,
                value: row.value,
              }))}
              colors={{
                "1 Month": "#38bdf8",
                "3 Months": "#a78bfa",
                "One Year": "#f59e0b",
              }}
            />
          </div>
          <ul className="mt-4 space-y-2 text-[13px]">
            {model.planMix.length === 0 ? (
              <li className="text-[#71717a]">No active plan MRR yet.</li>
            ) : (
              model.planMix.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="text-[#a1a1aa]">
                    {row.key}
                    <span className="ml-2 text-[11px] text-[#71717a]">
                      {row.subscribers} subs · list{" "}
                      {formatUsd(row.amountUsd)}
                    </span>
                  </span>
                  <span className="font-semibold">{formatUsd(row.value)}</span>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="rounded-2xl border border-[#262626] bg-[#141414] p-6">
          <p className="text-[15px] font-semibold">Model inputs</p>
          <ul className="mt-4 space-y-3 text-[13px]">
            <li className="flex justify-between gap-3 rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2.5">
              <span className="text-[#a1a1aa]">Trial MRR (potential)</span>
              <span className="font-semibold">{formatUsd(model.trialMrr)}</span>
            </li>
            <li className="flex justify-between gap-3 rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2.5">
              <span className="text-[#a1a1aa]">Canceling MRR</span>
              <span className="font-semibold text-amber-300">
                {formatUsd(model.atRiskMrr)}
              </span>
            </li>
            <li className="flex justify-between gap-3 rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2.5">
              <span className="text-[#a1a1aa]">Cash card share (recent)</span>
              <span className="font-semibold">
                {(Math.max(0, Math.min(1, model.cardShare)) * 100).toFixed(0)}%
              </span>
            </li>
            <li className="rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2.5 text-[12px] leading-relaxed text-[#71717a]">
              Catalog anchors:{" "}
              {Object.values(FALLBACK_PLANS)
                .map((plan) => `${plan.label} ${formatUsd(plan.amountEur ?? plan.amountUsd)}`)
                .join(" · ")}
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}
