"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  Activity,
  CircleAlert,
  CircleCheck,
  Database,
  Loader2,
  Radio,
  RefreshCw,
  Server,
  Wifi,
} from "lucide-react";

import { Badge } from "@acme/ui/badge";
import { Button } from "@acme/ui/button";

import type { SystemHealthReport } from "~/lib/blink/system-health.types";

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; report: SystemHealthReport; httpStatus: number }
  | { kind: "error"; message: string };

const CHECK_LABELS: Record<
  keyof SystemHealthReport["checks"],
  { label: string; description: string; icon: typeof Database }
> = {
  neonDatabase: {
    label: "Neon database",
    description: "Primary Postgres connection (read/write path).",
    icon: Database,
  },
  hyperliquidRest: {
    label: "Hyperliquid REST",
    description: "Info API: exchange status and live mids.",
    icon: Server,
  },
  hyperliquidWebSocket: {
    label: "Hyperliquid WebSocket",
    description: "Live L2 book subscription on BTC.",
    icon: Wifi,
  },
  blinkApi: {
    label: "Blink API",
    description: "App runtime + builder fee resolution (DB + config).",
    icon: Activity,
  },
};

const STATUS_COPY = {
  ok: {
    headline: "All systems operational",
    tone: "text-emerald-300",
    badge: "Operational",
    badgeClass: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  },
  degraded: {
    headline: "Partial degradation",
    tone: "text-amber-300",
    badge: "Degraded",
    badgeClass: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  },
  outage: {
    headline: "Major outage",
    tone: "text-rose-300",
    badge: "Outage",
    badgeClass: "border-rose-400/30 bg-rose-400/10 text-rose-200",
  },
} as const;

function formatCheckedAt(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 24) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
}

export function SystemStatusPage() {
  const [loadState, setLoadState] = useState<LoadState>({ kind: "loading" });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (options?: { background?: boolean }) => {
    if (!options?.background) {
      setLoadState({ kind: "loading" });
    } else {
      setRefreshing(true);
    }

    try {
      const response = await fetch("/api/health", { cache: "no-store" });
      const json = (await response
        .json()
        .catch(() => null)) as SystemHealthReport | null;

      if (!json?.checks || !json.status) {
        throw new Error("Invalid health payload");
      }

      setLoadState({
        kind: "ready",
        report: json,
        httpStatus: response.status,
      });
    } catch (error) {
      setLoadState({
        kind: "error",
        message:
          error instanceof Error ? error.message : "Failed to load status",
      });
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      void load({ background: true });
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const report = loadState.kind === "ready" ? loadState.report : null;
  const statusMeta = report ? STATUS_COPY[report.status] : null;

  return (
    <main className="min-h-screen bg-[#06070b] px-4 py-8 text-foreground md:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              href="/"
              className="text-2xl font-bold tracking-[-0.04em] text-white"
            >
              blink
            </Link>
            <p className="mt-2 text-xs uppercase tracking-[0.2em] text-foreground/45">
              System status
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="rounded-xl border-white/10 bg-white/[0.03] text-foreground/80"
            disabled={refreshing || loadState.kind === "loading"}
            onClick={() => void load({ background: true })}
          >
            {refreshing || loadState.kind === "loading" ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 size-4" />
            )}
            Refresh
          </Button>
        </div>

        {loadState.kind === "loading" ? (
          <section className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0b0d13] px-5 py-8 text-foreground/60">
            <Loader2 className="size-5 animate-spin" />
            Running live health checks…
          </section>
        ) : null}

        {loadState.kind === "error" ? (
          <section className="rounded-2xl border border-rose-400/25 bg-rose-400/10 px-5 py-6">
            <div className="flex items-center gap-2 text-rose-200">
              <CircleAlert className="size-5" />
              <p className="font-medium">Could not load status</p>
            </div>
            <p className="mt-2 text-sm text-rose-100/75">{loadState.message}</p>
          </section>
        ) : null}

        {report && statusMeta ? (
          <>
            <section className="rounded-2xl border border-white/10 bg-[#0b0d13] p-6">
              <div className="flex flex-wrap items-center gap-3">
                <Badge
                  className={`rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] ${statusMeta.badgeClass}`}
                >
                  {statusMeta.badge}
                </Badge>
                {loadState.kind === "ready" && loadState.httpStatus === 503 ? (
                  <Badge className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-foreground/55">
                    HTTP 503
                  </Badge>
                ) : null}
                <span className="text-xs text-foreground/45">
                  Deploy {report.version.sha}
                </span>
              </div>
              <h1
                className={`mt-4 text-3xl font-semibold tracking-[-0.04em] ${statusMeta.tone}`}
              >
                {statusMeta.headline}
              </h1>
              <p className="mt-2 text-sm text-foreground/55">
                Last checked {formatCheckedAt(report.checkedAt)} · auto-refresh
                every 30s
              </p>
            </section>

            <section className="mt-4 rounded-2xl border border-white/10 bg-[#0b0d13] p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-white">
                    Uptime ({report.uptime.windowDays}d)
                  </h2>
                  <p className="mt-1 text-xs text-foreground/45">
                    Honest duration-based formula from status transition events (not event counts).
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[26px] font-semibold tracking-tight text-emerald-300">
                    {report.uptime.uptimePct.toFixed(3)}%
                  </p>
                  <p className="text-xs text-foreground/45">
                    coverage {report.uptime.coveragePct.toFixed(1)}%
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                <div className="rounded-xl border border-white/10 bg-[#111827] px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-foreground/45">
                    Uptime
                  </p>
                  <p className="mt-1 text-sm font-semibold text-emerald-300">
                    {formatMinutes(report.uptime.uptimeMinutes)}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#111827] px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-foreground/45">
                    Downtime
                  </p>
                  <p className="mt-1 text-sm font-semibold text-rose-300">
                    {formatMinutes(report.uptime.downtimeMinutes)}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#111827] px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-foreground/45">
                    Degraded
                  </p>
                  <p className="mt-1 text-sm font-semibold text-amber-300">
                    {formatMinutes(report.uptime.degradedMinutes)}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#111827] px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-foreground/45">
                    Incidents
                  </p>
                  <p className="mt-1 text-sm font-semibold text-white">
                    {report.uptime.incidentCount}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#111827] px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-foreground/45">
                    Recoveries
                  </p>
                  <p className="mt-1 text-sm font-semibold text-white">
                    {report.uptime.recoveryCount}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-[#0f1422] p-3">
                <div className="flex flex-wrap gap-1">
                  {report.uptime.timeline.map((day) => (
                    <span
                      key={day.day}
                      className={`h-5 w-2.5 rounded-[3px] ${
                        day.status === "ok"
                          ? "bg-emerald-400"
                          : day.status === "degraded"
                            ? "bg-amber-400"
                            : day.status === "outage"
                              ? "bg-rose-400"
                              : "bg-slate-500"
                      }`}
                      title={`${day.day}: ${day.status}`}
                    />
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-foreground/55">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-sm bg-emerald-400" />
                    Operational day
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-sm bg-amber-400" />
                    Degraded day
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-sm bg-rose-400" />
                    Outage day
                  </span>
                </div>
              </div>
            </section>

            <section className="mt-4 space-y-3">
              {(
                Object.entries(report.checks) as Array<
                  [
                    keyof SystemHealthReport["checks"],
                    SystemHealthReport["checks"][keyof SystemHealthReport["checks"]],
                  ]
                >
              ).map(([key, check]) => {
                const meta = CHECK_LABELS[key];
                const Icon = meta.icon;
                const isOk = check.status === "ok";

                return (
                  <article
                    key={key}
                    className="rounded-2xl border border-white/10 bg-[#0b0d13] p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div
                          className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl ${
                            isOk
                              ? "bg-emerald-400/10 text-emerald-300"
                              : "bg-rose-400/10 text-rose-300"
                          }`}
                        >
                          <Icon className="size-4" />
                        </div>
                        <div>
                          <p className="font-medium text-white">{meta.label}</p>
                          <p className="mt-1 text-sm text-foreground/50">
                            {meta.description}
                          </p>
                          {check.detail ? (
                            <p className="mt-2 text-xs text-foreground/45">
                              {check.detail}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isOk ? (
                            <CircleCheck className="size-4 text-emerald-300" />
                          ) : (
                            <CircleAlert className="size-4 text-rose-300" />
                          )}
                          <span
                            className={`text-sm font-medium ${
                              isOk ? "text-emerald-300" : "text-rose-300"
                            }`}
                          >
                            {isOk ? "Operational" : "Down"}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-foreground/40">
                          {check.durationMs}ms
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>

            <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-4">
              <div className="flex items-center gap-2 text-sm text-foreground/55">
                <Radio className="size-4" />
                <p>
                  Monitors call{" "}
                  <Link
                    href="/api/health"
                    className="text-foreground/75 underline-offset-2 hover:text-white hover:underline"
                  >
                    /api/health
                  </Link>{" "}
                  (live probes, not mocked).
                </p>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
