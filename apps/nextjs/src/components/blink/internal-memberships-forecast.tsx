"use client";

import type { InternalMembershipRevenueForecast } from "~/lib/blink/internal-memberships.types";

import {
  InternalSection,
  InternalStatCard,
  internalLabelClass,
  internalPanelInsetClass,
} from "./internal-dashboard-primitives";

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value < 100 ? 2 : 0,
  }).format(value);
}

function formatPercent(rate: number) {
  return `${Math.round(rate * 100)}%`;
}

export function InternalMembershipsForecast(props: {
  forecast: InternalMembershipRevenueForecast;
  loading?: boolean;
}) {
  const { forecast } = props;

  if (props.loading) {
    return (
      <InternalSection
        title="Revenue forecast"
        description="Loading subscription revenue projections…"
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {["a", "b", "c", "d"].map((slot) => (
            <div
              key={slot}
              className={`${internalPanelInsetClass} h-24 animate-pulse bg-white/[0.03]`}
            />
          ))}
        </div>
      </InternalSection>
    );
  }

  return (
    <InternalSection
      title="Revenue forecast"
      description="Subscription MRR run-rate and trial pipeline uplift. Scenarios model trial-to-paid conversion against today's active trials."
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <InternalStatCard
          label="Current MRR"
          value={formatMoney(forecast.currentMrrUsd)}
          hint="Paying subscribers"
        />
        <InternalStatCard
          label="ARR run-rate"
          value={formatMoney(forecast.arrUsd)}
          hint="MRR × 12"
        />
        <InternalStatCard
          label="Trial pipeline"
          value={formatMoney(forecast.trialPipelineMrrUsd)}
          hint="If all active trials convert"
          tone="warning"
        />
        <InternalStatCard
          label="Trials ending ≤7d"
          value={forecast.trialsEndingWithin7d}
          hint={
            forecast.trialsEndingWithin7d > 0
              ? `${formatMoney(forecast.pipelineEndingWithin7dMrrUsd)} potential MRR`
              : "No trials ending soon"
          }
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {forecast.scenarios.map((scenario) => (
          <div
            key={scenario.id}
            className={`${internalPanelInsetClass} p-4 ${
              scenario.id === "base"
                ? "border-sky-400/25 bg-sky-400/[0.04]"
                : ""
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-white">
                {scenario.label}
              </p>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/45">
                {formatPercent(scenario.trialConversionRate)} trials
              </span>
            </div>
            <p className="mt-1 text-xs text-white/40">{scenario.horizonLabel}</p>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-white">
              {formatMoney(scenario.projectedMrrUsd)}
              <span className="ml-1 text-sm font-normal text-white/40">
                MRR
              </span>
            </p>
            <p className="mt-1 text-xs text-emerald-300/90">
              +{formatMoney(scenario.upliftUsd)} vs current
            </p>
          </div>
        ))}
      </div>

      {forecast.mrrByTier.length > 0 ? (
        <div className={`mt-4 overflow-x-auto ${internalPanelInsetClass}`}>
          <table className="min-w-[520px] w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-xs text-white/40">
                <th className="px-4 py-3 font-medium">Tier</th>
                <th className="px-4 py-3 font-medium">Paying</th>
                <th className="px-4 py-3 font-medium">Trials</th>
                <th className="px-4 py-3 font-medium">MRR</th>
                <th className="px-4 py-3 font-medium">Trial pipeline</th>
              </tr>
            </thead>
            <tbody>
              {forecast.mrrByTier.map((row) => (
                <tr
                  key={row.tier}
                  className="border-b border-white/[0.04] last:border-0"
                >
                  <td className="px-4 py-3 font-medium text-white">
                    {row.label}
                  </td>
                  <td className="px-4 py-3 text-white/60">{row.payingCount}</td>
                  <td className="px-4 py-3 text-white/60">{row.trialCount}</td>
                  <td className="px-4 py-3 text-white/85">
                    {formatMoney(row.mrrUsd)}
                  </td>
                  <td className="px-4 py-3 text-sky-200/90">
                    {row.pipelineMrrUsd > 0
                      ? formatMoney(row.pipelineMrrUsd)
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <ul className="mt-4 space-y-1.5">
        {forecast.assumptions.map((note) => (
          <li key={note} className={`${internalLabelClass} leading-5`}>
            · {note}
          </li>
        ))}
      </ul>
    </InternalSection>
  );
}
