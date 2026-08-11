/** Cloudflare Zone Analytics (GraphQL) — source of truth for Traffic History. */

export function formatBandwidth(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export type CloudflareSeriesGranularity = "minute" | "day";

export type CloudflareTrafficSeriesPoint = {
  /** ISO day `YYYY-MM-DD` or minute `YYYY-MM-DDTHH:mm:00Z`. */
  date: string;
  requests: number;
  bytes: number;
  pageviews: number;
  visits: number;
  uniques: number;
};

export type CloudflareTrafficSnapshot = {
  generatedAt: string;
  source: "cloudflare_graphql";
  configured: boolean;
  /** True when GraphQL returned usable zone data. */
  ok: boolean;
  error: string | null;
  zoneId: string | null;
  hosts: string[];
  rangeDays: number;
  /** Chart series resolution — minute for Today, day for multi-day ranges. */
  seriesGranularity: CloudflareSeriesGranularity;
  totals: {
    requests: number;
    bytes: number;
    pageviews: number;
    visits: number;
    uniques: number;
  };
  series: CloudflareTrafficSeriesPoint[];
  countries: { country: string; requests: number }[];
  paths: { path: string; requests: number }[];
  statusCodes: { status: number; requests: number }[];
  contentTypes: { contentType: string; requests: number }[];
  today: CloudflareTrafficSeriesPoint | null;
};
