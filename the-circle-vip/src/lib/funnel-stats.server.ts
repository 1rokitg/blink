import "server-only";

import { buildFunnelBoard, type FunnelBoard } from "@/lib/funnel-stats";
import { listLeads } from "@/lib/leads.server";
import {
  getInternalDashboardStats,
  normalizeRange,
} from "@/lib/internal-stats.server";
import type { DashboardRange } from "@/lib/internal-stats-types";

export type { FunnelBoard };

export async function getFunnelBoard(
  rangeDaysInput: DashboardRange | number = 30,
): Promise<FunnelBoard> {
  const rangeDays = normalizeRange(rangeDaysInput);
  const [stats, leads] = await Promise.all([
    getInternalDashboardStats(rangeDays),
    listLeads(500),
  ]);
  return buildFunnelBoard(stats, leads);
}
