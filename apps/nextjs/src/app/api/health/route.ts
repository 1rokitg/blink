import { NextResponse } from "next/server";

import { getSystemHealthReport } from "~/lib/blink/system-health.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const report = await getSystemHealthReport();

  return NextResponse.json(report, {
    status: report.status === "outage" ? 503 : 200,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
