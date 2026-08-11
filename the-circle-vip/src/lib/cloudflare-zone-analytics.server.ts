import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

import type {
  CloudflareSeriesGranularity,
  CloudflareTrafficSeriesPoint,
  CloudflareTrafficSnapshot,
} from "@/lib/cloudflare-zone-analytics-types";

const GRAPHQL_URL = "https://api.cloudflare.com/client/v4/graphql";
const CACHE_TTL_MULTI_DAY_SECONDS = 60 * 10;
const CACHE_TTL_TODAY_SECONDS = 60;
const CACHE_VERSION = "v2";
const DEFAULT_HOSTS = ["rokitg.com", "www.rokitg.com"];

type GqlResponse<T> = {
  data?: T;
  errors?: { message?: string }[];
};

function getZoneId() {
  return (
    process.env.CF_ZONE_ID?.trim() ||
    process.env.CLOUDFLARE_ZONE_ID?.trim() ||
    ""
  );
}

function getAnalyticsToken() {
  return (
    process.env.CF_ANALYTICS_API_TOKEN?.trim() ||
    process.env.CLOUDFLARE_API_TOKEN?.trim() ||
    ""
  );
}

function getHosts() {
  const raw = process.env.CF_TRAFFIC_HOSTS?.trim();
  if (!raw) return DEFAULT_HOSTS;
  return raw
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

async function getKv(): Promise<KVNamespace | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return (env as CloudflareEnv).CRYPTO_PAYMENTS ?? null;
  } catch {
    return null;
  }
}

function emptySnapshot(
  rangeDays: number,
  partial?: Partial<CloudflareTrafficSnapshot>,
): CloudflareTrafficSnapshot {
  return {
    generatedAt: new Date().toISOString(),
    source: "cloudflare_graphql",
    configured: Boolean(getZoneId() && getAnalyticsToken()),
    ok: false,
    error: null,
    zoneId: getZoneId() || null,
    hosts: getHosts(),
    rangeDays,
    seriesGranularity: rangeDays === 1 ? "minute" : "day",
    totals: {
      requests: 0,
      bytes: 0,
      pageviews: 0,
      visits: 0,
      uniques: 0,
    },
    series: [],
    countries: [],
    paths: [],
    statusCodes: [],
    contentTypes: [],
    today: null,
    ...partial,
  };
}

function dayKeyUtc(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function addDaysIso(isoDay: string, days: number) {
  const d = new Date(`${isoDay}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return dayKeyUtc(d);
}

function minuteKeyUtc(d: Date) {
  const copy = new Date(d);
  copy.setUTCSeconds(0, 0);
  return copy.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function emptyPoint(date: string): CloudflareTrafficSeriesPoint {
  return {
    date,
    requests: 0,
    bytes: 0,
    pageviews: 0,
    visits: 0,
    uniques: 0,
  };
}

async function graphql<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<{ data: T | null; error: string | null }> {
  const token = getAnalyticsToken();
  if (!token) {
    return {
      data: null,
      error:
        "Missing CF_ANALYTICS_API_TOKEN (needs Zone → Analytics → Read).",
    };
  }

  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = (await res.json()) as GqlResponse<T>;
  if (!res.ok) {
    return {
      data: null,
      error: `Cloudflare GraphQL HTTP ${res.status}`,
    };
  }
  if (json.errors?.length) {
    return {
      data: null,
      error: json.errors.map((e) => e.message).filter(Boolean).join(" · ") ||
        "Cloudflare GraphQL error",
    };
  }
  return { data: json.data ?? null, error: null };
}

type AdaptiveRow = {
  count: number;
  sum?: {
    edgeResponseBytes?: number | null;
    visits?: number | null;
  } | null;
  dimensions?: {
    date?: string | null;
    datetimeHour?: string | null;
    datetimeMinute?: string | null;
    clientCountryName?: string | null;
    clientRequestPath?: string | null;
    edgeResponseStatus?: number | null;
  } | null;
};

type DailyRow = {
  dimensions?: { date?: string | null } | null;
  sum?: {
    requests?: number | null;
    bytes?: number | null;
    pageViews?: number | null;
    threats?: number | null;
  } | null;
  uniq?: { uniques?: number | null } | null;
};

function bump(map: Map<string, number>, key: string, n: number) {
  if (!key || !n) return;
  map.set(key, (map.get(key) ?? 0) + n);
}

function sortEntries(map: Map<string, number>, limit = 20) {
  return [...map.entries()]
    .map(([key, value]) => ({ key, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

function sumSeries(series: CloudflareTrafficSeriesPoint[]) {
  return series.reduce(
    (acc, row) => ({
      requests: acc.requests + row.requests,
      bytes: acc.bytes + row.bytes,
      pageviews: acc.pageviews + row.pageviews,
      visits: acc.visits + row.visits,
      uniques: acc.uniques + row.uniques,
    }),
    { requests: 0, bytes: 0, pageviews: 0, visits: 0, uniques: 0 },
  );
}

function buildMinuteSeries(
  rows: AdaptiveRow[],
  dayStart: Date,
  now: Date,
): CloudflareTrafficSeriesPoint[] {
  const byMinute = new Map<string, CloudflareTrafficSeriesPoint>();
  const cursor = new Date(dayStart);
  cursor.setUTCSeconds(0, 0);
  const end = new Date(now);
  end.setUTCSeconds(0, 0);

  while (cursor <= end) {
    const key = minuteKeyUtc(cursor);
    byMinute.set(key, emptyPoint(key));
    cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);
  }

  for (const row of rows) {
    const minute = row.dimensions?.datetimeMinute;
    if (!minute) continue;
    const key = minute.replace(/\.\d{3}Z$/, "Z");
    const point = byMinute.get(key) ?? emptyPoint(key);
    point.requests += row.count ?? 0;
    point.bytes += row.sum?.edgeResponseBytes ?? 0;
    point.visits += row.sum?.visits ?? 0;
    byMinute.set(key, point);
  }

  return [...byMinute.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Poll Cloudflare Zone Analytics GraphQL for host-filtered traffic
 * matching the dashboard Traffic view (rokitg.com host filter).
 * Today uses minute buckets; multi-day ranges use daily rollups.
 */
export async function getCloudflareZoneTraffic(
  rangeDaysInput = 30,
): Promise<CloudflareTrafficSnapshot> {
  const rangeDays = Math.min(90, Math.max(1, Math.floor(rangeDaysInput) || 30));
  const zoneId = getZoneId();
  const hosts = getHosts();
  const token = getAnalyticsToken();
  const seriesGranularity: CloudflareSeriesGranularity =
    rangeDays === 1 ? "minute" : "day";
  const cacheTtl =
    seriesGranularity === "minute"
      ? CACHE_TTL_TODAY_SECONDS
      : CACHE_TTL_MULTI_DAY_SECONDS;

  if (!zoneId || !token) {
    return emptySnapshot(rangeDays, {
      error: !zoneId
        ? "Missing CF_ZONE_ID for rokitg.com."
        : "Missing CF_ANALYTICS_API_TOKEN with Zone Analytics Read.",
    });
  }

  const cacheKey = `traffic:cf:zone:${CACHE_VERSION}:${zoneId}:${hosts.join(",")}:${rangeDays}:${seriesGranularity}`;
  const kv = await getKv();
  if (kv) {
    const cached = await kv.get<CloudflareTrafficSnapshot>(cacheKey, "json");
    if (cached?.ok && cached.generatedAt) {
      const age = Date.now() - Date.parse(cached.generatedAt);
      if (Number.isFinite(age) && age >= 0 && age < cacheTtl * 1000) {
        return cached;
      }
    }
  }

  const now = new Date();
  const until = dayKeyUtc(now);
  const since = addDaysIso(until, -(rangeDays - 1));
  const startIso =
    seriesGranularity === "minute"
      ? `${until}T00:00:00Z`
      : `${since}T00:00:00Z`;
  const endIso = now.toISOString();

  // Do not request edgeResponseContentTypeName — many tokens lack that field
  // and a single subquery authz error fails the whole adaptive response.
  const adaptiveQuery =
    seriesGranularity === "minute"
      ? `
    query ZoneHostTrafficMinute(
      $zoneTag: string!
      $start: Time!
      $end: Time!
      $hosts: [string!]!
    ) {
      viewer {
        zones(filter: { zoneTag: $zoneTag }) {
          byMinute: httpRequestsAdaptiveGroups(
            limit: 2000
            orderBy: [datetimeMinute_ASC]
            filter: {
              datetime_geq: $start
              datetime_leq: $end
              clientRequestHTTPHost_in: $hosts
              requestSource: "eyeball"
            }
          ) {
            count
            sum { edgeResponseBytes visits }
            dimensions { datetimeMinute }
          }
          byCountry: httpRequestsAdaptiveGroups(
            limit: 40
            orderBy: [count_DESC]
            filter: {
              datetime_geq: $start
              datetime_leq: $end
              clientRequestHTTPHost_in: $hosts
              requestSource: "eyeball"
            }
          ) {
            count
            dimensions { clientCountryName }
          }
          byPath: httpRequestsAdaptiveGroups(
            limit: 40
            orderBy: [count_DESC]
            filter: {
              datetime_geq: $start
              datetime_leq: $end
              clientRequestHTTPHost_in: $hosts
              requestSource: "eyeball"
            }
          ) {
            count
            dimensions { clientRequestPath }
          }
          byStatus: httpRequestsAdaptiveGroups(
            limit: 30
            orderBy: [count_DESC]
            filter: {
              datetime_geq: $start
              datetime_leq: $end
              clientRequestHTTPHost_in: $hosts
              requestSource: "eyeball"
            }
          ) {
            count
            dimensions { edgeResponseStatus }
          }
        }
      }
    }
  `
      : `
    query ZoneHostTrafficDaily(
      $zoneTag: string!
      $start: Time!
      $end: Time!
      $hosts: [string!]!
    ) {
      viewer {
        zones(filter: { zoneTag: $zoneTag }) {
          byHour: httpRequestsAdaptiveGroups(
            limit: 5000
            orderBy: [datetimeHour_ASC]
            filter: {
              datetime_geq: $start
              datetime_leq: $end
              clientRequestHTTPHost_in: $hosts
              requestSource: "eyeball"
            }
          ) {
            count
            sum { edgeResponseBytes visits }
            dimensions { datetimeHour }
          }
          byCountry: httpRequestsAdaptiveGroups(
            limit: 40
            orderBy: [count_DESC]
            filter: {
              datetime_geq: $start
              datetime_leq: $end
              clientRequestHTTPHost_in: $hosts
              requestSource: "eyeball"
            }
          ) {
            count
            dimensions { clientCountryName }
          }
          byPath: httpRequestsAdaptiveGroups(
            limit: 40
            orderBy: [count_DESC]
            filter: {
              datetime_geq: $start
              datetime_leq: $end
              clientRequestHTTPHost_in: $hosts
              requestSource: "eyeball"
            }
          ) {
            count
            dimensions { clientRequestPath }
          }
          byStatus: httpRequestsAdaptiveGroups(
            limit: 30
            orderBy: [count_DESC]
            filter: {
              datetime_geq: $start
              datetime_leq: $end
              clientRequestHTTPHost_in: $hosts
              requestSource: "eyeball"
            }
          ) {
            count
            dimensions { edgeResponseStatus }
          }
        }
      }
    }
  `;

  const dailyQuery = `
    query ZoneDailyTraffic(
      $zoneTag: string!
      $since: Date!
      $until: Date!
    ) {
      viewer {
        zones(filter: { zoneTag: $zoneTag }) {
          httpRequests1dGroups(
            limit: 100
            filter: { date_geq: $since, date_leq: $until }
            orderBy: [date_ASC]
          ) {
            dimensions { date }
            sum { requests bytes pageViews threats }
            uniq { uniques }
          }
        }
      }
    }
  `;

  const adaptive = await graphql<{
    viewer: {
      zones: {
        byMinute?: AdaptiveRow[];
        byHour?: AdaptiveRow[];
        byCountry: AdaptiveRow[];
        byPath: AdaptiveRow[];
        byStatus: AdaptiveRow[];
      }[];
    };
  }>(adaptiveQuery, {
    zoneTag: zoneId,
    start: startIso,
    end: endIso,
    hosts,
  });

  if (adaptive.error || !adaptive.data?.viewer.zones[0]) {
    const daily = await graphql<{
      viewer: { zones: { httpRequests1dGroups: DailyRow[] }[] };
    }>(dailyQuery, { zoneTag: zoneId, since, until });

    if (daily.error || !daily.data?.viewer.zones[0]) {
      return emptySnapshot(rangeDays, {
        error:
          adaptive.error ||
          daily.error ||
          "No Cloudflare zone analytics returned. Token needs Zone Analytics Read.",
      });
    }

    const rows = daily.data.viewer.zones[0].httpRequests1dGroups ?? [];
    const series: CloudflareTrafficSeriesPoint[] = rows.map((row) => ({
      date: row.dimensions?.date || "",
      requests: row.sum?.requests ?? 0,
      bytes: row.sum?.bytes ?? 0,
      pageviews: row.sum?.pageViews ?? 0,
      visits: 0,
      uniques: row.uniq?.uniques ?? 0,
    }));
    const snapshot = emptySnapshot(rangeDays, {
      ok: true,
      seriesGranularity: "day",
      error:
        "Host filter unavailable with current query path — showing zone-wide daily analytics (includes all hosts on the zone).",
      series,
      totals: sumSeries(series),
      today: series.find((row) => row.date === until) ?? null,
    });
    if (kv) {
      await kv.put(cacheKey, JSON.stringify(snapshot), {
        expirationTtl: cacheTtl,
      });
    }
    return snapshot;
  }

  const zone = adaptive.data.viewer.zones[0];
  let series: CloudflareTrafficSeriesPoint[] = [];

  if (seriesGranularity === "minute") {
    const dayStart = new Date(`${until}T00:00:00.000Z`);
    series = buildMinuteSeries(zone.byMinute ?? [], dayStart, now);
  } else {
    const byDay = new Map<string, CloudflareTrafficSeriesPoint>();
    const ensureDay = (date: string) => {
      const existing = byDay.get(date);
      if (existing) return existing;
      const row = emptyPoint(date);
      byDay.set(date, row);
      return row;
    };

    for (let i = 0; i < rangeDays; i += 1) {
      ensureDay(addDaysIso(since, i));
    }

    for (const row of zone.byHour ?? []) {
      const hour = row.dimensions?.datetimeHour;
      if (!hour) continue;
      const point = ensureDay(hour.slice(0, 10));
      point.requests += row.count ?? 0;
      point.bytes += row.sum?.edgeResponseBytes ?? 0;
      point.visits += row.sum?.visits ?? 0;
    }

    series = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
  }

  // Pageviews + uniques come from classic daily groups (zone-wide).
  // Content-type HTML adaptive is not available on this token.
  const daily = await graphql<{
    viewer: { zones: { httpRequests1dGroups: DailyRow[] }[] };
  }>(dailyQuery, { zoneTag: zoneId, since, until });

  let todayUniques = 0;
  let todayPageviews = 0;
  if (daily.data?.viewer.zones[0]?.httpRequests1dGroups) {
    for (const row of daily.data.viewer.zones[0].httpRequests1dGroups) {
      const date = row.dimensions?.date;
      if (!date) continue;
      if (seriesGranularity === "day") {
        const point = series.find((item) => item.date === date);
        if (!point) continue;
        point.uniques = row.uniq?.uniques ?? point.uniques;
        if (point.pageviews === 0) {
          point.pageviews = row.sum?.pageViews ?? 0;
        }
      }
      if (date === until) {
        todayUniques = row.uniq?.uniques ?? 0;
        todayPageviews = row.sum?.pageViews ?? 0;
      }
    }
  }

  const totals = sumSeries(series);
  if (seriesGranularity === "minute") {
    totals.pageviews = todayPageviews;
    totals.uniques = todayUniques;
  } else {
    // Uniques are not additive across days — use sum of daily uniq as range estimate
    // (matches prior behavior / CF daily cards).
  }

  const countries = sortEntries(
    (zone.byCountry ?? []).reduce((map, row) => {
      bump(map, row.dimensions?.clientCountryName || "Unknown", row.count ?? 0);
      return map;
    }, new Map<string, number>()),
  ).map((row) => ({ country: row.key, requests: row.value }));

  const paths = sortEntries(
    (zone.byPath ?? []).reduce((map, row) => {
      bump(map, row.dimensions?.clientRequestPath || "/", row.count ?? 0);
      return map;
    }, new Map<string, number>()),
  ).map((row) => ({ path: row.key, requests: row.value }));

  const statusCodes = sortEntries(
    (zone.byStatus ?? []).reduce((map, row) => {
      const status = row.dimensions?.edgeResponseStatus;
      bump(map, String(status ?? 0), row.count ?? 0);
      return map;
    }, new Map<string, number>()),
  ).map((row) => ({ status: Number(row.key) || 0, requests: row.value }));

  const todayPoint =
    seriesGranularity === "minute"
      ? {
          date: until,
          requests: totals.requests,
          bytes: totals.bytes,
          pageviews: todayPageviews,
          visits: totals.visits,
          uniques: todayUniques,
        }
      : (series.find((row) => row.date === until) ?? null);

  const snapshot: CloudflareTrafficSnapshot = {
    generatedAt: new Date().toISOString(),
    source: "cloudflare_graphql",
    configured: true,
    ok: true,
    error: null,
    zoneId,
    hosts,
    rangeDays,
    seriesGranularity,
    totals,
    series,
    countries,
    paths,
    statusCodes,
    contentTypes: [],
    today: todayPoint,
  };

  if (kv) {
    await kv.put(cacheKey, JSON.stringify(snapshot), {
      expirationTtl: cacheTtl,
    });
  }
  return snapshot;
}

export { formatBandwidth } from "@/lib/cloudflare-zone-analytics-types";
