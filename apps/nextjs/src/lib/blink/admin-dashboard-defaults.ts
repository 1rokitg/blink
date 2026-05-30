import type { AdminRange } from "~/components/blink/admin-dashboard-types";

export const DEFAULT_ADMIN_OVERVIEW_RANGE: AdminRange = "1d";

export const DEFAULT_ADMIN_STATS_OPTIONS = {
  syncHyperliquid: false,
  includeAttribution: true,
  windowDays: 1 as const,
  liveWindowMinutes: 60,
  liveLimit: 120,
};
