import { NextResponse } from "next/server";

import { getSystemHealthReport } from "~/lib/blink/system-health.server";
import { maybeSendStatusAlert } from "~/lib/blink/status-alerts.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const report = await getSystemHealthReport();
  try {
    await maybeSendStatusAlert(report);
  } catch (error) {
    console.error("[health] status alert failed", error);
  }

  return NextResponse.json(report, {
    status: report.status === "outage" ? 503 : 200,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
