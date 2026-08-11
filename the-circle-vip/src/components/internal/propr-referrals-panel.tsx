"use client";

import { useEffect, useMemo, useState } from "react";

import {
  AreaLineChart,
  BreakdownBar,
  VerticalBarChart,
} from "@/components/internal/charts";
import { CountryFlag } from "@/components/internal/country-flag";
import type { ProprReferralSummary } from "@/lib/propr-referrals-types";

/** Propr attributes challenge volume in USD — keep $ (not Circle EUR ledger). */
function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatWhen(iso: string | null | undefined) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDay(iso: string | null | undefined) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function pct(rate: number | null | undefined) {
  if (rate == null || !Number.isFinite(rate)) return "—";
  return `${(rate * 100).toFixed(1)}%`;
}

const SOURCE_COLORS: Record<string, string> = {
  Referral: "#70a7ff",
  Affiliate: "#34d399",
  referral: "#70a7ff",
  affiliate: "#34d399",
};

export function ProprReferralsPanel({
  summary: initialSummary,
  onSummaryChange,
}: {
  summary: ProprReferralSummary | null;
  onSummaryChange?: (summary: ProprReferralSummary) => void;
}) {
  const [summary, setSummary] = useState(initialSummary);
  const [query, setQuery] = useState("");
  const [historyMode, setHistoryMode] = useState<"activity" | "earnings">(
    "activity",
  );
  const [token, setToken] = useState("");
  const [syncPending, setSyncPending] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    setSummary(initialSummary);
  }, [initialSummary]);

  const filteredUsers = useMemo(() => {
    if (!summary) return [];
    const q = query.trim().toLowerCase();
    if (!q) return summary.users;
    return summary.users.filter((row) => {
      const hay =
        `${row.username} ${row.country} ${row.codes.join(" ")} ${row.userId}`.toLowerCase();
      return hay.includes(q);
    });
  }, [summary, query]);

  async function syncFromApi() {
    setSyncPending(true);
    setSyncError(null);
    setSyncMessage(null);
    try {
      const res = await fetch("/api/internal/propr-referrals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          action: "sync",
          token: token.trim() || undefined,
          persistToken: Boolean(token.trim()),
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        summary?: ProprReferralSummary;
        tokenExpiresAt?: string | null;
        tokenPersisted?: boolean;
      };
      if (!res.ok || !data.summary) {
        throw new Error(data.error || "Propr sync failed.");
      }
      setSummary(data.summary);
      onSummaryChange?.(data.summary);
      setToken("");
      const expiry = data.tokenExpiresAt
        ? ` Token kept until ${new Date(data.tokenExpiresAt).toLocaleTimeString()}.`
        : "";
      setSyncMessage(
        `Synced live from Propr · ${formatMoney(data.summary.estCommission)} earnings · ${data.summary.signups} signups.${expiry}`,
      );
    } catch (error) {
      setSyncError(
        error instanceof Error ? error.message : "Propr sync failed.",
      );
    } finally {
      setSyncPending(false);
    }
  }

  const syncCard = (
    <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-[#fafafa]">
            Live Propr sync
          </h2>
          <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-[#71717a]">
            Pull signups, volume, and earnings from{" "}
            <code className="text-[#a1a1aa]">api.propr.xyz</code>. Session
            tokens last ~30 minutes — paste a fresh Bearer from the Propr app
            network tab, or rely on a stored / env token.
          </p>
        </div>
        <button
          type="button"
          onClick={syncFromApi}
          disabled={syncPending}
          className="rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-black disabled:opacity-50"
        >
          {syncPending ? "Syncing…" : "Sync now"}
        </button>
      </div>
      <label className="mt-4 block">
        <span className="text-[12px] font-medium text-[#a1a1aa]">
          Bearer token (optional)
        </span>
        <input
          type="password"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          placeholder="eyJhbGciOiJIUzI1NiIs…"
          autoComplete="off"
          spellCheck={false}
          className="mt-1.5 w-full rounded-xl border border-[#262626] bg-[#0a0a0a] px-3 py-2.5 font-mono text-[12px] text-[#fafafa] outline-none placeholder:text-[#3f3f46] focus:border-[#52525b]"
        />
      </label>
      {syncMessage ? (
        <p className="mt-3 text-[12px] text-emerald-300">{syncMessage}</p>
      ) : null}
      {syncError ? (
        <p className="mt-3 text-[12px] text-rose-300">{syncError}</p>
      ) : null}
      {summary?.liveSyncedAt ? (
        <p className="mt-3 text-[11px] text-[#52525b]">
          Last live sync {formatWhen(summary.liveSyncedAt)}
          {summary.liveSource ? ` · ${summary.liveSource}` : ""}
        </p>
      ) : null}
    </div>
  );

  if (!summary) {
    return (
      <div className="space-y-4">
        {syncCard}
        <div className="rounded-2xl border border-dashed border-[#262626] px-4 py-12 text-center text-[14px] text-[#71717a]">
          No Propr referral data yet. Sync from the live API above, or drop a
          CSV into <code className="text-[#a1a1aa]">data/propr/</code>.
        </div>
      </div>
    );
  }

  const sources = summary.sources?.length
    ? summary.sources
    : summary.codes.reduce<
        {
          source: string;
          label: string;
          users: number;
          signups: number;
          purchases: number;
          amount: number;
          estCommission: number;
        }[]
      >((acc, row) => {
        const existing = acc.find((item) => item.source === row.codeType);
        if (existing) {
          existing.users += row.users;
          existing.signups += row.signups;
          existing.purchases += row.purchases;
          existing.amount += row.amount;
          existing.estCommission += row.estCommission;
        } else {
          acc.push({
            source: row.codeType,
            label:
              row.codeType === "affiliate"
                ? "Affiliate"
                : row.codeType === "referral"
                  ? "Referral"
                  : row.codeType,
            users: row.users,
            signups: row.signups,
            purchases: row.purchases,
            amount: row.amount,
            estCommission: row.estCommission,
          });
        }
        return acc;
      }, []);

  const sourceVolumeBars = sources.map((row) => ({
    key: row.label,
    value: Math.round(row.amount),
  }));
  const sourceCommissionBars = sources.map((row) => ({
    key: row.label,
    value: Math.round(row.estCommission),
  }));
  const codeVolumeBars = summary.codes.map((row) => ({
    key: row.code,
    value: Math.round(row.amount),
  }));
  const countryBars = summary.countries
    .filter((c) => c.amount > 0)
    .slice(0, 8)
    .map((c) => ({ key: c.country, value: Math.round(c.amount) }));

  const amountSeries = summary.series.map((p) => p.amount);
  const commissionSeries = summary.series.map((p) => p.commission ?? 0);
  const signupSeries = summary.series.map((p) => p.signups);
  const purchaseSeries = summary.series.map((p) => p.purchases);
  const labels = summary.series.map((p) => p.label);
  const activity = summary.activity ?? [];
  const conversion =
    summary.conversionRate ??
    (summary.eventRows > 0 ? summary.purchases / summary.eventRows : 0);

  return (
    <div className="space-y-6">
      {syncCard}

      <div className="rounded-2xl border border-[#262626] bg-[#141414] px-5 py-4 text-[13px] leading-relaxed text-[#a1a1aa]">
        <p className="font-medium text-[#fafafa]">
          Propr referrals · earn {summary.commissionPercent}% on every challenge
          purchase
        </p>
        <p className="mt-1">
          {summary.liveSource === "propr_api"
            ? "Live from Propr partner API"
            : "Mirrored from Propr partner stats"}{" "}
          ({summary.dateStart} → {summary.dateEnd}). Volume and earnings are
          attributed challenge purchases — not Circle Stripe revenue. Source{" "}
          <code className="text-[#d4d4d8]">{summary.sourceFile}</code>.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Total referral earnings"
          value={formatMoney(summary.estCommission)}
          hint={`${summary.commissionPercent}% commission on attributed volume`}
          accent
        />
        <Kpi
          label="Available to claim"
          value={formatMoney(summary.availableToClaim ?? 0)}
          hint="Latest eligible purchase commission"
        />
        <Kpi
          label="Volume"
          value={formatMoney(summary.grossVolume)}
          hint={`${summary.purchasesWithAmount} paid · ${summary.buyers} buyers`}
        />
        <Kpi
          label="Conversion rate"
          value={pct(conversion)}
          hint={`${summary.purchases} / ${summary.eventRows} events`}
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <MiniStat label="Signups" value={String(summary.signups)} />
        <MiniStat label="Purchases" value={String(summary.purchases)} />
        <MiniStat
          label="Unique users"
          value={String(summary.uniqueUsers)}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold text-[#fafafa]">
                Revenue by source
              </h2>
              <p className="mt-1 text-[12px] text-[#71717a]">
                Attributed challenge volume · referral vs affiliate codes
              </p>
            </div>
          </div>
          {sourceVolumeBars.some((r) => r.value > 0) ? (
            <div className="mt-4 space-y-4">
              <VerticalBarChart
                rows={sourceVolumeBars}
                colors={SOURCE_COLORS}
                valueLabel="Volume"
              />
              <BreakdownBar
                rows={sourceVolumeBars}
                colors={SOURCE_COLORS}
              />
            </div>
          ) : (
            <EmptyChart />
          )}
          <ul className="mt-4 space-y-2">
            {sources.map((row) => (
              <li
                key={row.source}
                className="flex items-center justify-between gap-3 rounded-xl border border-[#1f1f1f] bg-[#0f0f0f] px-3 py-2 text-[13px]"
              >
                <span>
                  <span className="font-medium text-[#fafafa]">{row.label}</span>
                  <span className="ml-2 text-[11px] text-[#71717a]">
                    {row.users} users · {row.purchases} buys
                  </span>
                </span>
                <span className="text-right">
                  <span className="font-semibold text-[#fafafa]">
                    {formatMoney(row.amount)}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-[#71717a]">
                    {formatMoney(row.estCommission)} earned
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5">
          <h2 className="text-[15px] font-semibold text-[#fafafa]">
            Earnings by source
          </h2>
          <p className="mt-1 text-[12px] text-[#71717a]">
            Estimated commission at {summary.commissionPercent}%
          </p>
          {sourceCommissionBars.some((r) => r.value > 0) ? (
            <div className="mt-4">
              <VerticalBarChart
                rows={sourceCommissionBars}
                colors={SOURCE_COLORS}
                valueLabel="Earnings"
              />
            </div>
          ) : (
            <EmptyChart />
          )}
          <div className="mt-4">
            <h3 className="text-[13px] font-semibold text-[#d4d4d8]">
              By code
            </h3>
            {codeVolumeBars.some((r) => r.value > 0) ? (
              <div className="mt-3">
                <VerticalBarChart
                  rows={codeVolumeBars}
                  colors={{
                    ADBs3Qpn: "#70a7ff",
                    ROKIT: "#34d399",
                  }}
                  heightClass="h-44"
                  valueLabel="Volume"
                />
              </div>
            ) : (
              <EmptyChart />
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold text-[#fafafa]">
                Referral history
              </h2>
              <p className="mt-1 text-[12px] text-[#71717a]">
                Signups vs purchases over time
              </p>
            </div>
            <div className="flex rounded-xl border border-[#262626] bg-[#0f0f0f] p-1">
              {(
                [
                  ["activity", "Activity"],
                  ["earnings", "Earnings"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setHistoryMode(value)}
                  className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                    historyMode === value
                      ? "bg-white text-black"
                      : "text-[#a1a1aa] hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4">
            {historyMode === "activity" ? (
              signupSeries.some((v) => v > 0) ||
              purchaseSeries.some((v) => v > 0) ? (
                <AreaLineChart
                  primary={purchaseSeries}
                  secondary={signupSeries}
                  labels={labels}
                  label="Purchases"
                  secondaryLabel="Signups"
                  heightClass="h-56"
                  primaryStroke="#70a7ff"
                  secondaryStroke="#34d399"
                />
              ) : (
                <EmptyChart />
              )
            ) : commissionSeries.some((v) => v > 0) ? (
              <AreaLineChart
                primary={commissionSeries}
                secondary={amountSeries}
                labels={labels}
                label="Earnings"
                secondaryLabel="Volume"
                heightClass="h-56"
                primaryStroke="#f59e0b"
                secondaryStroke="#70a7ff"
              />
            ) : (
              <EmptyChart />
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5">
          <h2 className="text-[15px] font-semibold text-[#fafafa]">
            Volume by country
          </h2>
          <p className="mt-1 text-[12px] text-[#71717a]">
            Where paying referred users sit
          </p>
          {countryBars.length > 0 ? (
            <div className="mt-4">
              <VerticalBarChart
                rows={countryBars}
                valueLabel="Volume"
              />
            </div>
          ) : (
            <EmptyChart />
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-[#262626] bg-[#141414] p-5">
        <h2 className="text-[15px] font-semibold text-[#fafafa]">
          Referral links
        </h2>
        <p className="mt-1 text-[12px] text-[#71717a]">
          Share and earn {summary.commissionPercent}% on every challenge purchase
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {summary.codes.map((row) => (
            <div
              key={row.code}
              className="rounded-xl border border-[#1f1f1f] bg-[#0f0f0f] px-4 py-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] font-bold tracking-[0.14em] text-[#71717a] uppercase">
                    {row.codeType}
                  </p>
                  <p className="mt-1 font-mono text-[18px] font-semibold text-[#fafafa]">
                    {row.code}
                  </p>
                </div>
                <span className="rounded-full border border-[#262626] px-2 py-0.5 text-[11px] text-[#a1a1aa]">
                  {summary.commissionPercent}%
                </span>
              </div>
              <p className="mt-2 truncate font-mono text-[12px] text-[#70a7ff]">
                {row.shareUrl ?? `https://app.propr.xyz/r/${row.code}`}
              </p>
              <p className="mt-2 text-[12px] text-[#71717a]">
                {formatMoney(row.amount)} volume · {formatMoney(row.estCommission)}{" "}
                earned · {row.users} users
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5">
          <h2 className="text-[15px] font-semibold text-[#fafafa]">Activity</h2>
          <p className="mt-1 text-[12px] text-[#71717a]">
            Latest signups and challenge purchases
          </p>
          <ul className="mt-4 max-h-[480px] space-y-2 overflow-y-auto">
            {activity.slice(0, 40).map((row) => (
              <li
                key={`${row.userId}-${row.createdAt}-${row.action}-${row.amount}`}
                className="rounded-xl border border-[#1f1f1f] bg-[#0f0f0f] px-3 py-2.5 text-[13px]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-[#fafafa]">
                      {row.username}{" "}
                      <span className="font-normal text-[#a1a1aa]">
                        {row.action === "purchase"
                          ? "purchased a challenge"
                          : "signed up"}
                      </span>
                    </p>
                    <p className="mt-0.5 truncate font-mono text-[11px] text-[#52525b]">
                      {row.userId}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    {row.action === "purchase" ? (
                      <>
                        <p className="font-semibold text-[#fafafa]">
                          {formatMoney(row.amount)}
                        </p>
                        <p className="text-[11px] text-emerald-300">
                          (+{formatMoney(row.commission)})
                        </p>
                      </>
                    ) : (
                      <p className="text-[11px] text-[#71717a]">signup</p>
                    )}
                    <p className="mt-1 text-[11px] text-[#52525b]">
                      <CountryFlag code={row.country} /> {row.country} ·{" "}
                      {formatDay(row.createdAt)}
                    </p>
                  </div>
                </div>
              </li>
            ))}
            {activity.length === 0 ? (
              <li className="text-[13px] text-[#71717a]">No activity yet.</li>
            ) : null}
          </ul>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-[16px] font-semibold text-[#fafafa]">
                Referred users
              </h2>
              <p className="mt-1 text-[13px] text-[#71717a]">
                Ranked by attributed purchase volume
              </p>
            </div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search username, code, country…"
              className="w-full max-w-xs rounded-full border border-[#262626] bg-[#0f0f0f] px-3 py-1.5 text-[13px] text-[#fafafa] outline-none placeholder:text-[#52525b] focus:border-[#404040]"
            />
          </div>
          <div className="overflow-x-auto rounded-2xl border border-[#262626]">
            <table className="min-w-full text-left text-[13px]">
              <thead className="bg-[#141414] text-[11px] tracking-[0.12em] text-[#71717a] uppercase">
                <tr>
                  <th className="px-4 py-3 font-bold">User</th>
                  <th className="px-4 py-3 font-bold">Code</th>
                  <th className="px-4 py-3 font-bold">Purchases</th>
                  <th className="px-4 py-3 font-bold">Volume</th>
                  <th className="px-4 py-3 font-bold">Earnings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1f1f1f] bg-[#0f0f0f]">
                {filteredUsers.slice(0, 40).map((row) => (
                  <tr key={row.userId}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#fafafa]">
                        {row.username}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#71717a]">
                        <CountryFlag code={row.country} />
                        {row.country || "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#a1a1aa]">
                      {row.codes.join(", ")}
                    </td>
                    <td className="px-4 py-3 text-[#a1a1aa]">{row.purchases}</td>
                    <td className="px-4 py-3 font-medium text-[#fafafa]">
                      {formatMoney(row.amount)}
                    </td>
                    <td className="px-4 py-3 text-emerald-300">
                      {formatMoney(row.estCommission)}
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-[#71717a]"
                    >
                      No users match.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: string;
  hint: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5">
      <p className="text-[13px] text-[#a1a1aa]">{label}</p>
      <p
        className={`mt-2 text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl ${
          accent ? "text-emerald-300" : "text-[#fafafa]"
        }`}
      >
        {value}
      </p>
      <p className="mt-2 text-[12px] text-[#71717a]">{hint}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#262626] bg-[#141414] px-4 py-4">
      <p className="text-[11px] font-bold tracking-[0.16em] text-[#71717a] uppercase">
        {label}
      </p>
      <p className="mt-2 text-[28px] font-semibold tracking-tight text-[#fafafa]">
        {value}
      </p>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="mt-4 grid h-56 place-items-center rounded-xl border border-dashed border-[#262626] text-[13px] text-[#71717a]">
      No activity in this export yet
    </div>
  );
}
