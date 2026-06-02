import * as hl from "@nktkas/hyperliquid";
import { and, asc, desc, gte, inArray, lt, lte, sql } from "drizzle-orm";

import { db } from "@acme/db/client";
import { MetricEvent } from "@acme/db/schema";

import { BUILDER_ADDRESS } from "./builder";
import { infoClient } from "./hyperliquid";
import { getBuilderFeeUnitsForWallet } from "./membership.server";
import type {
  HealthCheckResult,
  SystemHealthReport,
} from "./system-health.types";

export type {
  HealthCheckResult,
  SystemHealthReport,
} from "./system-health.types";

const HYPERLIQUID_WS_URL = "wss://api.hyperliquid.xyz/ws";
const WS_HEALTH_TIMEOUT_MS = 8_000;
const UPTIME_WINDOW_DAYS = 90;
const STATUS_EVENT_TYPES = [
  "system_status_ok",
  "system_status_degraded",
  "system_status_outage",
] as const;
const STATUS_EVENT_TYPE_LIST: string[] = [...STATUS_EVENT_TYPES];
type StatusState = "ok" | "degraded" | "outage" | "unknown";

export function getDeploymentSha() {
  return (
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.GIT_SHA ??
    "dev"
  ).slice(0, 7);
}

async function runHealthCheck(
  check: () => Promise<string | undefined>,
): Promise<HealthCheckResult> {
  const startedAt = Date.now();

  try {
    const detail = await check();
    return {
      ...(typeof detail === "string" && detail ? { detail } : {}),
      durationMs: Date.now() - startedAt,
      status: "ok",
    };
  } catch (error) {
    return {
      detail: error instanceof Error ? error.message : "unknown_error",
      durationMs: Date.now() - startedAt,
      status: "error",
    };
  }
}

async function checkNeonDatabase() {
  await db.execute(sql`select 1 as ok`);
  return "Neon reachable";
}

async function checkHyperliquidRest() {
  await infoClient.exchangeStatus();
  const mids = await infoClient.allMids();
  const btcMid = mids.BTC;

  if (!btcMid) {
    throw new Error("Hyperliquid REST returned no BTC mid");
  }

  return `REST ok · BTC ${btcMid}`;
}

async function checkHyperliquidWebSocket() {
  const client = new hl.SubscriptionClient({
    transport: new hl.WebSocketTransport({ url: HYPERLIQUID_WS_URL }),
  });

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    let subscription: hl.Subscription | null = null;

    const finish = (handler: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      handler();
    };

    const timer = setTimeout(() => {
      finish(() => {
        void subscription?.unsubscribe().catch(() => undefined);
        reject(
          new Error(
            `WebSocket did not receive data within ${WS_HEALTH_TIMEOUT_MS}ms`,
          ),
        );
      });
    }, WS_HEALTH_TIMEOUT_MS);

    void client
      .l2Book({ coin: "BTC" }, () => {
        finish(() => {
          void subscription?.unsubscribe().catch(() => undefined);
          resolve();
        });
      })
      .then((sub) => {
        subscription = sub;
      })
      .catch((error: unknown) => {
        finish(() => {
          reject(
            error instanceof Error
              ? error
              : new Error("WebSocket subscription failed"),
          );
        });
      });
  });

  return "WebSocket stream ok";
}

async function checkBlinkApi() {
  if (!process.env.DATABASE_URL) {
    throw new Error("Blink API configuration is incomplete");
  }

  const resolved = await getBuilderFeeUnitsForWallet(BUILDER_ADDRESS, "BTC");

  return `builder-fee ${resolved.feeUnits}u · pro=${resolved.isPro ? "yes" : "no"}`;
}

function resolveOverallStatus(
  checks: SystemHealthReport["checks"],
): SystemHealthReport["status"] {
  const values = Object.values(checks);

  if (
    checks.neonDatabase.status === "error" ||
    checks.hyperliquidRest.status === "error"
  ) {
    return "outage";
  }

  if (values.some((check) => check.status === "error")) {
    return "degraded";
  }

  return "ok";
}

function eventTypeToStatus(eventType: string): Exclude<StatusState, "unknown"> {
  if (eventType === "system_status_outage") return "outage";
  if (eventType === "system_status_degraded") return "degraded";
  return "ok";
}

function dayKey(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}

async function getUptimeSummary(windowDays = UPTIME_WINDOW_DAYS) {
  const now = Date.now();
  const startMs = now - windowDays * 24 * 60 * 60 * 1000;
  const startDate = new Date(startMs);
  const nowDate = new Date(now);

  const [latestBeforeWindow, windowEvents] = await Promise.all([
    db
      .select({
        createdAt: MetricEvent.createdAt,
        eventType: MetricEvent.eventType,
      })
      .from(MetricEvent)
      .where(
        and(
          inArray(MetricEvent.eventType, STATUS_EVENT_TYPE_LIST),
          lt(MetricEvent.createdAt, startDate),
        ),
      )
      .orderBy(desc(MetricEvent.createdAt))
      .limit(1),
    db
      .select({
        createdAt: MetricEvent.createdAt,
        eventType: MetricEvent.eventType,
      })
      .from(MetricEvent)
      .where(
        and(
          inArray(MetricEvent.eventType, STATUS_EVENT_TYPE_LIST),
          gte(MetricEvent.createdAt, startDate),
          lte(MetricEvent.createdAt, nowDate),
        ),
      )
      .orderBy(asc(MetricEvent.createdAt)),
  ]);

  const minutesByState: Record<StatusState, number> = {
    degraded: 0,
    ok: 0,
    outage: 0,
    unknown: 0,
  };
  const perDay = new Map<
    string,
    Record<StatusState, number>
  >();

  const addDuration = (fromMs: number, toMs: number, status: StatusState) => {
    if (toMs <= fromMs) return;
    let cursor = fromMs;
    while (cursor < toMs) {
      const cursorDay = new Date(cursor);
      const dayEndMs = Date.UTC(
        cursorDay.getUTCFullYear(),
        cursorDay.getUTCMonth(),
        cursorDay.getUTCDate() + 1,
      );
      const segmentEnd = Math.min(toMs, dayEndMs);
      const segmentMinutes = (segmentEnd - cursor) / 60_000;
      minutesByState[status] += segmentMinutes;
      const key = dayKey(cursor);
      const bucket = perDay.get(key) ?? {
        degraded: 0,
        ok: 0,
        outage: 0,
        unknown: 0,
      };
      bucket[status] += segmentMinutes;
      perDay.set(key, bucket);
      cursor = segmentEnd;
    }
  };

  let currentStatus: StatusState = latestBeforeWindow[0]
    ? eventTypeToStatus(latestBeforeWindow[0].eventType)
    : "unknown";
  let cursorMs = startMs;
  let incidentCount = 0;
  let recoveryCount = 0;

  for (const event of windowEvents) {
    const eventMs = new Date(event.createdAt).getTime();
    addDuration(cursorMs, eventMs, currentStatus);

    const nextStatus = eventTypeToStatus(event.eventType);
    if (nextStatus !== currentStatus) {
      if (currentStatus === "ok" && nextStatus !== "ok") incidentCount += 1;
      if (currentStatus !== "ok" && nextStatus === "ok") recoveryCount += 1;
    }

    currentStatus = nextStatus;
    cursorMs = eventMs;
  }
  addDuration(cursorMs, now, currentStatus);

  const totalWindowMinutes = windowDays * 24 * 60;
  const observedMinutes =
    minutesByState.ok + minutesByState.degraded + minutesByState.outage;
  const uptimePct = observedMinutes > 0
    ? (minutesByState.ok / observedMinutes) * 100
    : 0;
  const coveragePct = (observedMinutes / totalWindowMinutes) * 100;

  const timeline = Array.from({ length: windowDays }, (_, index) => {
    const ms = startMs + index * 24 * 60 * 60 * 1000;
    const key = dayKey(ms);
    const bucket = perDay.get(key) ?? {
      degraded: 0,
      ok: 0,
      outage: 0,
      unknown: 24 * 60,
    };
    const ordered: StatusState[] = ["outage", "degraded", "ok", "unknown"];
    const status = ordered.reduce((best, candidate) =>
      bucket[candidate] > bucket[best] ? candidate : best,
    "unknown" as StatusState);
    return { day: key, status };
  });

  return {
    coveragePct: Number(coveragePct.toFixed(2)),
    degradedMinutes: Math.round(minutesByState.degraded),
    downtimeMinutes: Math.round(minutesByState.outage),
    incidentCount,
    recoveryCount,
    timeline,
    unknownMinutes: Math.round(minutesByState.unknown),
    uptimeMinutes: Math.round(minutesByState.ok),
    uptimePct: Number(uptimePct.toFixed(3)),
    windowDays,
  };
}

export async function getSystemHealthReport(): Promise<SystemHealthReport> {
  const [neonDatabase, hyperliquidRest, hyperliquidWebSocket, blinkApi] =
    await Promise.all([
      runHealthCheck(checkNeonDatabase),
      runHealthCheck(checkHyperliquidRest),
      runHealthCheck(checkHyperliquidWebSocket),
      runHealthCheck(checkBlinkApi),
    ]);

  const checks = {
    neonDatabase,
    hyperliquidRest,
    hyperliquidWebSocket,
    blinkApi,
  };

  return {
    checkedAt: new Date().toISOString(),
    status: resolveOverallStatus(checks),
    uptime: await getUptimeSummary(),
    version: { sha: getDeploymentSha() },
    checks,
  };
}
