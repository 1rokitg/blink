import * as hl from "@nktkas/hyperliquid";
import { sql } from "drizzle-orm";

import { db } from "@acme/db/client";

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
    throw new Error("DATABASE_URL is not configured");
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
    version: { sha: getDeploymentSha() },
    checks,
  };
}
