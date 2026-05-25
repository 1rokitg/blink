import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@acme/db/client";
import { infoClient } from "~/lib/blink/hyperliquid";

export const runtime = "nodejs";

type HealthCheckResult = {
  detail?: string;
  durationMs: number;
  status: "ok" | "error";
};

async function runHealthCheck(
  check: () => Promise<void>,
): Promise<HealthCheckResult> {
  const startedAt = Date.now();

  try {
    await check();
    return {
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

export async function GET() {
  const [database, hyperliquid] = await Promise.all([
    runHealthCheck(async () => {
      await db.execute(sql`select 1`);
    }),
    runHealthCheck(async () => {
      await infoClient.exchangeStatus();
    }),
  ]);

  const overallStatus =
    database.status === "ok" && hyperliquid.status === "ok" ? "ok" : "degraded";

  return NextResponse.json(
    {
      checkedAt: new Date().toISOString(),
      status: overallStatus,
      checks: {
        database,
        hyperliquid,
      },
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
