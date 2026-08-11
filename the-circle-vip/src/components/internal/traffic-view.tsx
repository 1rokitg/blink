"use client";

import { useEffect, useState, useTransition } from "react";

import { AreaLineChart } from "@/components/internal/charts";
import { VisitorAvatar } from "@/components/internal/visitor-avatar";
import { WorldTrafficMap } from "@/components/internal/world-traffic-map";
import {
  formatBandwidth,
  type CloudflareTrafficSnapshot,
} from "@/lib/cloudflare-zone-analytics-types";
import type {
  DashboardRange,
  InternalDashboardStats,
} from "@/lib/internal-stats-types";
import type {
  TrafficLiveSnapshot,
  TrafficLiveWindow,
} from "@/lib/traffic-live-types";

const DAY_RANGES: { days: DashboardRange; label: string }[] = [
  { days: 1, label: "Today" },
  { days: 7, label: "7d" },
  { days: 14, label: "14d" },
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
];

const LIVE_WINDOWS: { minutes: TrafficLiveWindow; label: string }[] = [
  { minutes: 5, label: "5m" },
  { minutes: 30, label: "30m" },
  { minutes: 60, label: "1h" },
];

function countryFlag(code: string) {
  if (!code || code.length !== 2 || code === "XX" || code === "T1") return "·";
  const base = 127397;
  return String.fromCodePoint(
    ...code
      .toUpperCase()
      .split("")
      .map((char) => base + char.charCodeAt(0)),
  );
}

function emptyLive(windowMinutes: TrafficLiveWindow): TrafficLiveSnapshot {
  return {
    generatedAt: new Date().toISOString(),
    windowMinutes,
    pageviews: 0,
    uniques: 0,
    series: [],
    byCountry: [],
    pins: [],
    uniquePins: [],
  };
}

function emptyCf(rangeDays: DashboardRange): CloudflareTrafficSnapshot {
  return {
    generatedAt: new Date().toISOString(),
    source: "cloudflare_graphql",
    configured: false,
    ok: false,
    error: null,
    zoneId: null,
    hosts: ["rokitg.com", "www.rokitg.com"],
    rangeDays,
    seriesGranularity: rangeDays === 1 ? "minute" : "day",
    totals: {
      requests: 0,
      bytes: 0,
      pageviews: 0,
      visits: 0,
      uniques: 0,
    },
    series: [],
    countries: [],
    paths: [],
    statusCodes: [],
    contentTypes: [],
    today: null,
  };
}

function formatSeriesLabel(
  date: string,
  granularity: CloudflareTrafficSnapshot["seriesGranularity"],
) {
  if (granularity === "minute") {
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return date.slice(11, 16) || date;
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  // Multi-day: show month/day when available.
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const d = new Date(`${date}T00:00:00Z`);
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  }
  return date;
}

export function TrafficView({
  initialCloudflare,
}: {
  initialStats?: InternalDashboardStats;
  initialCloudflare?: CloudflareTrafficSnapshot | null;
}) {
  const [range, setRange] = useState<DashboardRange>(30);
  const [cf, setCf] = useState<CloudflareTrafficSnapshot>(
    () => initialCloudflare ?? emptyCf(30),
  );
  const [liveWindow, setLiveWindow] = useState<TrafficLiveWindow>(60);
  const [live, setLive] = useState<TrafficLiveSnapshot>(() => emptyLive(60));
  const [pending, startTransition] = useTransition();
  const [livePending, startLiveTransition] = useTransition();
  const [pulseMetric, setPulseMetric] = useState<"pageviews" | "uniques">(
    "pageviews",
  );

  function refreshDays(days: DashboardRange) {
    setRange(days);
    startTransition(async () => {
      const res = await fetch(`/api/internal/traffic-cf?days=${days}`, {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) return;
      setCf((await res.json()) as CloudflareTrafficSnapshot);
    });
  }

  useEffect(() => {
    if (initialCloudflare?.ok) return;
    refreshDays(30);
  }, []);

  function loadLive(windowMinutes: TrafficLiveWindow) {
    startLiveTransition(async () => {
      const res = await fetch(
        `/api/internal/traffic-live?window=${windowMinutes}`,
        { cache: "no-store", credentials: "include" },
      );
      if (!res.ok) return;
      setLive((await res.json()) as TrafficLiveSnapshot);
    });
  }

  function refreshLive(windowMinutes: TrafficLiveWindow) {
    setLiveWindow(windowMinutes);
    loadLive(windowMinutes);
  }

  useEffect(() => {
    loadLive(liveWindow);
    const id = window.setInterval(() => loadLive(liveWindow), 15_000);
    return () => window.clearInterval(id);
  }, [liveWindow]);

  const liveSeriesPrimary = live.series.map((row) =>
    pulseMetric === "uniques" ? row.uniques : row.pageviews,
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[32px] font-semibold tracking-tight text-[#fafafa]">
            Traffic
          </h1>
          <p className="mt-1 text-[14px] text-[#a1a1aa]">
            Cloudflare Zone Analytics is the source of truth for History
            (rokitg.com host filter). Live maps stay first-party fingerprints
            {livePending || pending ? " · refreshing…" : ""}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold tracking-[0.14em] text-[#71717a] uppercase">
            Live
          </span>
          {LIVE_WINDOWS.map((item) => (
            <button
              key={item.minutes}
              type="button"
              onClick={() => refreshLive(item.minutes)}
              className={`rounded-full border px-3 py-1.5 text-[13px] font-medium ${
                liveWindow === item.minutes
                  ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-300"
                  : "border-[#262626] bg-[#141414] text-[#a1a1aa] hover:bg-[#0f0f0f]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-emerald-500/20 bg-[#141414] p-5">
          <p className="text-[13px] text-[#a1a1aa]">
            Live uniques · {liveWindow}m
          </p>
          <p className="mt-2 text-4xl font-semibold tracking-tight text-emerald-300">
            {live.uniques.toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5">
          <p className="text-[13px] text-[#a1a1aa]">
            Live impressions · {liveWindow}m
          </p>
          <p className="mt-2 text-4xl font-semibold tracking-tight">
            {live.pageviews.toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5">
          <p className="text-[13px] text-[#a1a1aa]">Peak minute</p>
          <p className="mt-2 text-4xl font-semibold tracking-tight">
            {Math.max(0, ...live.series.map((row) => row.pageviews)).toLocaleString()}
          </p>
          <p className="mt-1 text-[12px] text-[#71717a]">impressions / min</p>
        </div>
        <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5">
          <p className="text-[13px] text-[#a1a1aa]">Updated</p>
          <p className="mt-2 text-lg font-semibold tracking-tight">
            {new Date(live.generatedAt).toLocaleTimeString()}
          </p>
          <p className="mt-1 text-[12px] text-[#71717a]">auto-refresh 15s</p>
        </div>
      </div>

      <div className="rounded-2xl border border-[#262626] bg-[#141414] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[15px] font-semibold">Intra-hour pulse</p>
            <p className="mt-1 text-[12px] text-[#71717a]">
              Per-minute{" "}
              {pulseMetric === "uniques" ? "uniques" : "impressions"} for the last{" "}
              {liveWindow} minutes
            </p>
          </div>
          <div className="flex rounded-xl border border-[#262626] bg-[#0f0f0f] p-1">
            {(
              [
                ["pageviews", "Impressions"],
                ["uniques", "Uniques"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setPulseMetric(value)}
                className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                  pulseMetric === value
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
          <AreaLineChart
            primary={liveSeriesPrimary}
            primaryStroke={pulseMetric === "uniques" ? "#34d399" : "#f59e0b"}
            heightClass="h-56"
            label={
              pulseMetric === "uniques" ? "Uniques / min" : "Impressions / min"
            }
          />
        </div>
      </div>

      <WorldTrafficMap
        pins={live.pins}
        mode="pageviews"
        title="Impressions · world map"
        subtitle="One pulsing blue dot per live hit in this window — matches impression count as traffic accrues"
      />

      <WorldTrafficMap
        pins={live.uniquePins}
        mode="uniques"
        title="Unique visitors · world map"
        subtitle="One teal pulse per distinct fingerprinted visitor — pan/zoom enabled"
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#262626] bg-[#141414] p-6">
          <p className="text-[15px] font-semibold">Live countries</p>
          <ul className="mt-4 space-y-2 text-[13px]">
            {live.byCountry.slice(0, 12).map((row) => (
              <li
                key={row.country}
                className="flex items-center justify-between gap-3 rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2"
              >
                <span className="text-[#a1a1aa]">
                  {countryFlag(row.country)} {row.country}
                </span>
                <span className="text-right">
                  <span className="font-semibold text-[#fafafa]">
                    {row.pageviews.toLocaleString()}
                  </span>
                  <span className="ml-2 text-[11px] text-[#71717a]">
                    {row.uniques} uniques
                  </span>
                </span>
              </li>
            ))}
            {live.byCountry.length === 0 ? (
              <li className="text-[#71717a]">No live country data yet.</li>
            ) : null}
          </ul>
        </div>
        <div className="rounded-2xl border border-[#262626] bg-[#141414] p-6">
          <p className="text-[15px] font-semibold">Fingerprint stream</p>
          <ul className="mt-4 max-h-[420px] space-y-2 overflow-y-auto text-[13px]">
            {live.pins.slice(0, 24).map((pin) => (
              <li
                key={`stream-${pin.id}`}
                className="flex items-start gap-3 rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2.5"
              >
                <VisitorAvatar pin={pin} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[12px] font-semibold text-[#fafafa]">
                      {pin.shortId}
                    </span>
                    <span className="text-[11px] text-[#71717a]">
                      {new Date(pin.lastSeen).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] text-[#a1a1aa]">
                    {countryFlag(pin.country)} {pin.city || pin.country} ·{" "}
                    {pin.device} · {pin.platform}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-[#70a7ff]">
                    {pin.path}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#52525b]">
                    {pin.timezone} · {pin.language} · {pin.screen} ·{" "}
                    {pin.pageviews} impressions
                  </p>
                </div>
              </li>
            ))}
            {live.pins.length === 0 ? (
              <li className="text-[#71717a]">
                Fingerprint stream fills as visitors hit the public site.
              </li>
            ) : null}
          </ul>
        </div>
      </div>

      <section className="space-y-4 border-t border-[#1f1f1f] pt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              Cloudflare Traffic
            </h2>
            <p className="mt-1 text-[13px] text-[#a1a1aa]">
              Source of truth via Cloudflare GraphQL Zone Analytics · host
              filter {cf.hosts.join(", ")}
              {pending ? " · refreshing…" : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {DAY_RANGES.map((item) => (
              <button
                key={item.days}
                type="button"
                onClick={() => refreshDays(item.days)}
                className={`rounded-full border px-3 py-1.5 text-[13px] font-medium ${
                  range === item.days
                    ? "border-white bg-white text-black"
                    : "border-[#262626] bg-[#141414] text-[#a1a1aa] hover:bg-[#0f0f0f]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {cf.error ? (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-[13px] text-amber-200">
            <p className="font-semibold">Cloudflare analytics not synced</p>
            <p className="mt-1 text-amber-100/80">{cf.error}</p>
            <p className="mt-2 text-[12px] text-amber-100/70">
              Create a user API token with{" "}
              <span className="font-semibold">Zone → Analytics → Read</span> for
              rokitg.com, set it as{" "}
              <code className="font-mono">CF_ANALYTICS_API_TOKEN</code>, and set{" "}
              <code className="font-mono">CF_ZONE_ID</code>.
            </p>
          </div>
        ) : (
          <p className="text-[12px] text-[#71717a]">
            Updated {new Date(cf.generatedAt).toLocaleString()} ·{" "}
            {cf.seriesGranularity === "minute"
              ? "minute-by-minute · cached up to 60s"
              : "daily · cached up to 10m"}{" "}
            · host filter {cf.hosts.join(", ")} · zone {cf.zoneId?.slice(0, 8)}…
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5">
            <p className="text-[13px] text-[#a1a1aa]">Requests</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">
              {cf.totals.requests.toLocaleString()}
            </p>
          </div>
          <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5">
            <p className="text-[13px] text-[#a1a1aa]">Bandwidth</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">
              {formatBandwidth(cf.totals.bytes)}
            </p>
          </div>
          <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5">
            <p className="text-[13px] text-[#a1a1aa]">Impressions</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">
              {cf.totals.pageviews.toLocaleString()}
            </p>
          </div>
          <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5">
            <p className="text-[13px] text-[#a1a1aa]">Visits</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">
              {cf.totals.visits.toLocaleString()}
            </p>
          </div>
          <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5">
            <p className="text-[13px] text-[#a1a1aa]">Unique visitors</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">
              {cf.totals.uniques.toLocaleString()}
            </p>
            <p className="mt-1 text-[11px] text-[#71717a]">
              Today {cf.today?.uniques.toLocaleString() ?? 0}
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-[#262626] bg-[#141414] p-6">
            <p className="text-[15px] font-semibold">
              Requests
              {cf.seriesGranularity === "minute" ? (
                <span className="ml-2 text-[12px] font-normal text-[#71717a]">
                  per minute
                </span>
              ) : null}
            </p>
            <div className="mt-4">
              <AreaLineChart
                primary={cf.series.map((d) => d.requests)}
                labels={cf.series.map((d) =>
                  formatSeriesLabel(d.date, cf.seriesGranularity),
                )}
                primaryStroke="#70a7ff"
                heightClass="h-56"
                label="Requests"
                curveType={
                  cf.seriesGranularity === "minute" ? "monotone" : "basis"
                }
              />
            </div>
          </div>
          <div className="rounded-2xl border border-[#262626] bg-[#141414] p-6">
            <p className="text-[15px] font-semibold">
              Bandwidth (bytes)
              {cf.seriesGranularity === "minute" ? (
                <span className="ml-2 text-[12px] font-normal text-[#71717a]">
                  per minute
                </span>
              ) : null}
            </p>
            <div className="mt-4">
              <AreaLineChart
                primary={cf.series.map((d) => d.bytes)}
                labels={cf.series.map((d) =>
                  formatSeriesLabel(d.date, cf.seriesGranularity),
                )}
                primaryStroke="#34d399"
                heightClass="h-56"
                label="Bytes"
                curveType={
                  cf.seriesGranularity === "minute" ? "monotone" : "basis"
                }
              />
            </div>
          </div>
          <div className="rounded-2xl border border-[#262626] bg-[#141414] p-6">
            <p className="text-[15px] font-semibold">
              {cf.seriesGranularity === "minute" ? "Visits" : "Impressions"}
              {cf.seriesGranularity === "minute" ? (
                <span className="ml-2 text-[12px] font-normal text-[#71717a]">
                  per minute
                </span>
              ) : null}
            </p>
            <div className="mt-4">
              <AreaLineChart
                primary={cf.series.map((d) =>
                  cf.seriesGranularity === "minute" ? d.visits : d.pageviews,
                )}
                labels={cf.series.map((d) =>
                  formatSeriesLabel(d.date, cf.seriesGranularity),
                )}
                primaryStroke="#f59e0b"
                heightClass="h-56"
                label={
                  cf.seriesGranularity === "minute" ? "Visits" : "Impressions"
                }
                curveType={
                  cf.seriesGranularity === "minute" ? "monotone" : "basis"
                }
              />
            </div>
          </div>
          <div className="rounded-2xl border border-[#262626] bg-[#141414] p-6">
            <p className="text-[15px] font-semibold">
              {cf.seriesGranularity === "minute"
                ? "Uniques & impressions"
                : "Unique visitors"}
              {cf.seriesGranularity === "minute" ? (
                <span className="ml-2 text-[12px] font-normal text-[#71717a]">
                  daily totals
                </span>
              ) : null}
            </p>
            <div className="mt-4">
              {cf.seriesGranularity === "minute" ? (
                <div className="flex h-56 flex-col justify-center gap-3 rounded-xl border border-[#262626] bg-[#0f0f0f] px-5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[13px] text-[#a1a1aa]">
                      Unique visitors today
                    </span>
                    <span className="text-2xl font-semibold tracking-tight">
                      {(cf.today?.uniques ?? cf.totals.uniques).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[13px] text-[#a1a1aa]">
                      Impressions today
                    </span>
                    <span className="text-2xl font-semibold tracking-tight">
                      {(
                        cf.today?.pageviews ?? cf.totals.pageviews
                      ).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-[12px] text-[#71717a]">
                    Cloudflare does not expose minute-level uniques/impressions on
                    this query path — charts above are minute-by-minute for
                    requests, bandwidth, and visits.
                  </p>
                </div>
              ) : (
                <AreaLineChart
                  primary={cf.series.map((d) => d.uniques)}
                  labels={cf.series.map((d) =>
                    formatSeriesLabel(d.date, cf.seriesGranularity),
                  )}
                  primaryStroke="#0ea5e9"
                  heightClass="h-56"
                  label="Uniques"
                />
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-[#262626] bg-[#141414] p-6">
            <p className="text-[15px] font-semibold">Top countries</p>
            <ul className="mt-4 space-y-2 text-[13px]">
              {cf.countries.slice(0, 12).map((row) => (
                <li key={row.country} className="flex justify-between gap-3">
                  <span className="text-[#a1a1aa]">
                    {row.country.length === 2
                      ? `${countryFlag(row.country)} `
                      : ""}
                    {row.country}
                  </span>
                  <span className="font-semibold">
                    {row.requests.toLocaleString()}
                  </span>
                </li>
              ))}
              {cf.countries.length === 0 ? (
                <li className="text-[#71717a]">No country data yet.</li>
              ) : null}
            </ul>
          </div>
          <div className="rounded-2xl border border-[#262626] bg-[#141414] p-6">
            <p className="text-[15px] font-semibold">Top paths</p>
            <ul className="mt-4 space-y-2 text-[13px]">
              {cf.paths.slice(0, 12).map((row) => (
                <li key={row.path} className="flex justify-between gap-3">
                  <span className="truncate font-mono text-[12px] text-[#a1a1aa]">
                    {row.path}
                  </span>
                  <span className="font-semibold">
                    {row.requests.toLocaleString()}
                  </span>
                </li>
              ))}
              {cf.paths.length === 0 ? (
                <li className="text-[#71717a]">No path data yet.</li>
              ) : null}
            </ul>
          </div>
          <div className="rounded-2xl border border-[#262626] bg-[#141414] p-6">
            <p className="text-[15px] font-semibold">Status codes</p>
            <ul className="mt-4 space-y-2 text-[13px]">
              {cf.statusCodes.slice(0, 12).map((row) => (
                <li key={row.status} className="flex justify-between gap-3">
                  <span className="font-mono text-[#a1a1aa]">{row.status}</span>
                  <span className="font-semibold">
                    {row.requests.toLocaleString()}
                  </span>
                </li>
              ))}
              {cf.statusCodes.length === 0 ? (
                <li className="text-[#71717a]">No status data yet.</li>
              ) : null}
            </ul>
          </div>
          <div className="rounded-2xl border border-[#262626] bg-[#141414] p-6">
            <p className="text-[15px] font-semibold">Content types</p>
            <ul className="mt-4 space-y-2 text-[13px]">
              {cf.contentTypes.slice(0, 12).map((row) => (
                <li
                  key={row.contentType}
                  className="flex justify-between gap-3"
                >
                  <span className="truncate font-mono text-[11px] text-[#a1a1aa]">
                    {row.contentType}
                  </span>
                  <span className="font-semibold">
                    {row.requests.toLocaleString()}
                  </span>
                </li>
              ))}
              {cf.contentTypes.length === 0 ? (
                <li className="text-[#71717a]">No content-type data yet.</li>
              ) : null}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
