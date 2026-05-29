"use client";

import { useMemo, useState } from "react";

import Link from "next/link";

import type { AdminStats } from "~/app/actions/get-admin-stats";
import { getInternalUserPath } from "~/lib/blink/wallet-address";
import {
  TableRowsSkeleton,
  internalLabelClass,
  internalPanelInsetClass,
} from "./internal-dashboard-primitives";

type Attribution = AdminStats["builder"]["attribution"];
type TabId = "source" | "country" | "market" | "users";

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: amount < 100 ? 2 : 0,
  }).format(amount);
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatLabel(input: string) {
  if (!input) return "Unknown";
  return input
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function countryWithFlag(value: string | null | undefined) {
  if (!value) return "—";
  const code = value.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return value;
  const flag = String.fromCodePoint(
    ...code.split("").map((char) => 127397 + char.charCodeAt(0)),
  );
  return `${flag} ${code}`;
}

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "source", label: "Revenue by source" },
  { id: "country", label: "Revenue by country" },
  { id: "market", label: "Revenue by market" },
  { id: "users", label: "Top users" },
];

export function InternalAttributionPanel(props: {
  attribution: Attribution | undefined;
  isLoading: boolean;
  windowLabel: string;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("source");

  const rowCount = useMemo(() => {
    if (!props.attribution) return 0;
    if (activeTab === "source") return props.attribution.bySource.length;
    if (activeTab === "country") return props.attribution.byCountry.length;
    if (activeTab === "market") return props.attribution.byMarket.length;
    return props.attribution.byUser.length;
  }, [activeTab, props.attribution]);

  const totalRevenue = useMemo(() => {
    if (!props.attribution) return 0;
    if (activeTab === "source") {
      return props.attribution.bySource.reduce(
        (sum, row) => sum + row.revenueUsd,
        0,
      );
    }
    if (activeTab === "country") {
      return props.attribution.byCountry.reduce(
        (sum, row) => sum + row.revenueUsd,
        0,
      );
    }
    if (activeTab === "market") {
      return props.attribution.byMarket.reduce(
        (sum, row) => sum + row.revenueUsd,
        0,
      );
    }
    return props.attribution.byUser.reduce(
      (sum, row) => sum + row.revenueUsd,
      0,
    );
  }, [activeTab, props.attribution]);

  return (
    <section className="mt-4 rounded-2xl border border-white/10 bg-[#0b0d13] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">
            Revenue attribution
          </h2>
          <p className={`mt-1 ${internalLabelClass}`}>
            Builder fee breakdown for the selected window ({props.windowLabel}).
            Signup source and country come from off-chain events; revenue is
            reconciled from Hyperliquid fills.
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#121726] px-3 py-2 text-right">
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/35">
            Tab total
          </p>
          <p className="text-lg font-semibold text-emerald-300">
            {formatMoney(totalRevenue)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-xl border px-3 py-2 text-sm transition ${
              activeTab === tab.id
                ? "border-white/20 bg-white/10 font-medium text-white"
                : "border-white/10 bg-[#121726] text-white/55 hover:text-white/85"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={`mt-4 min-h-[280px] ${internalPanelInsetClass}`}>
        {props.isLoading ? (
          <div className="p-4">
            <TableRowsSkeleton rows={6} />
          </div>
        ) : rowCount === 0 ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center px-6 py-10 text-center">
            <p className="text-sm font-medium text-white/75">
              No attributed builder revenue yet
            </p>
            <p className="mt-2 max-w-md text-sm leading-6 text-white/45">
              This window has no routed fills with builder fees, or attribution
              is still syncing. Try widening the period selector or hit Refresh
              to pull a Hyperliquid sync.
            </p>
          </div>
        ) : activeTab === "source" ? (
          <AttributionTable
            headers={["Source", "Users", "Fills", "Revenue"]}
            rows={(props.attribution?.bySource ?? []).map((row) => ({
              key: row.source,
              cells: [
                formatLabel(row.source),
                String(row.users),
                String(row.fillsCount),
                formatMoney(row.revenueUsd),
              ],
              revenueClass: "text-emerald-300",
            }))}
          />
        ) : activeTab === "country" ? (
          <AttributionTable
            headers={["Country", "Users", "Fills", "Revenue"]}
            rows={(props.attribution?.byCountry ?? []).map((row) => ({
              key: row.country,
              cells: [
                countryWithFlag(row.country),
                String(row.users),
                String(row.fillsCount),
                formatMoney(row.revenueUsd),
              ],
              revenueClass: "text-emerald-300",
            }))}
          />
        ) : activeTab === "market" ? (
          <AttributionTable
            headers={["Market", "Users", "Fills", "Volume", "Revenue"]}
            rows={(props.attribution?.byMarket ?? []).map((row) => ({
              key: row.market,
              cells: [
                row.market,
                String(row.users),
                String(row.fillsCount),
                formatCompact(row.volumeUsd),
                formatMoney(row.revenueUsd),
              ],
              revenueClass: "text-emerald-300",
            }))}
          />
        ) : (
          <AttributionTable
            headers={["Wallet", "Source", "Country", "Volume", "Revenue"]}
            rows={(props.attribution?.byUser ?? []).map((row) => ({
              key: row.walletAddress,
              cells: [
                truncateAddress(row.walletAddress),
                formatLabel(row.source),
                countryWithFlag(row.country),
                formatCompact(row.volumeUsd),
                formatMoney(row.revenueUsd),
              ],
              revenueClass: "text-emerald-300",
              href: getInternalUserPath(row.walletAddress),
            }))}
          />
        )}
      </div>

      {!props.isLoading && rowCount > 0 ? (
        <p className="mt-3 text-xs text-white/35">
          Showing {rowCount} {activeTab === "users" ? "traders" : "rows"} ·{" "}
          {props.windowLabel} window
        </p>
      ) : null}
    </section>
  );
}

function AttributionTable(props: {
  headers: string[];
  rows: Array<{
    key: string;
    cells: string[];
    revenueClass?: string;
    href?: string;
  }>;
}) {
  const gridClass =
    props.headers.length === 5
      ? "grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.8fr)]"
      : "grid-cols-[minmax(0,1.4fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,0.8fr)]";

  return (
    <div className="overflow-x-auto">
      <div
        className={`grid ${gridClass} gap-3 border-b border-white/[0.05] px-4 py-2.5 text-xs font-medium text-white/40`}
      >
        {props.headers.map((header) => (
          <span key={header}>{header}</span>
        ))}
      </div>
      <div className="divide-y divide-white/[0.04]">
        {props.rows.map((row) => (
          <div
            key={row.key}
            className={`grid ${gridClass} gap-3 px-4 py-3 text-sm`}
          >
            {row.cells.map((cell, index) => {
              const isPrimary = index === 0;
              const isRevenue = index === row.cells.length - 1;

              if (isPrimary && row.href) {
                return (
                  <Link
                    key={`${row.key}-${index}`}
                    href={row.href}
                    className="font-mono text-[#6fa8ff] hover:underline"
                  >
                    {cell}
                  </Link>
                );
              }

              return (
                <span
                  key={`${row.key}-${index}`}
                  className={
                    isRevenue
                      ? `font-medium ${row.revenueClass ?? "text-white/85"}`
                      : isPrimary
                        ? "text-white/85"
                        : "text-white/55"
                  }
                >
                  {cell}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
