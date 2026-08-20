import { NextResponse } from "next/server";

import {
  getInternalDashboardStats,
  normalizeRange,
} from "@/lib/internal-stats.server";
import { DEFAULT_DASHBOARD_RANGE } from "@/lib/internal-stats-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rangeDays = normalizeRange(
    searchParams.get("days") ?? DEFAULT_DASHBOARD_RANGE,
  );
  const stats = await getInternalDashboardStats(rangeDays);
  return NextResponse.json(stats);
}
