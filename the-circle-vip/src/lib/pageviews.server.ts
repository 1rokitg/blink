import "server-only";

import {
  getRecentVisitorsFromAe,
  getTrafficSeriesFromAe,
  visitorHash,
  writeCircleEvent,
} from "@/lib/analytics-engine.server";
import {
  ANALYTICS_BUDGET,
  trimCounterMap,
} from "@/lib/analytics-budget";
import type {
  ClientFingerprint,
  DailyMetrics,
  VisitorProfile,
} from "@/lib/analytics-types";
import type { Attribution } from "@/lib/attribution";
import { normalizeChannel, sanitizeAttribution } from "@/lib/attribution";
import { recordLiveTrafficHit } from "@/lib/traffic-live.server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export type { DailyMetrics, VisitorProfile };

function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function metricsKey(day: string) {
  return `metrics:daily:${day}`;
}

function visitorKey(id: string) {
  return `visitor:${id}`;
}

async function getKv() {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return (env as CloudflareEnv).CRYPTO_PAYMENTS ?? null;
  } catch {
    return null;
  }
}

async function hasAnalyticsEngine() {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return Boolean((env as CloudflareEnv).CIRCLE_EVENTS);
  } catch {
    return false;
  }
}

/**
 * Record a pageview (budget-first).
 *
 * - Analytics Engine writes are no-op while disabled in analytics-budget.
 * - KV daily counters keep Monetise charts working on month-1 volume.
 * - Visitor profiles are throttled to cut KV write spend.
 * - When AE is re-enabled + bound, skip unique-hash list growth in KV
 *   (counts only) — AE owns high-cardinality identity.
 */
export async function recordPageview(input: {
  path: string;
  ip: string;
  ua: string;
  host: string;
  country?: string;
  region?: string;
  city?: string;
  fingerprint?: ClientFingerprint | null;
  attribution?: Attribution | null;
}) {
  const attribution = sanitizeAttribution(input.attribution);
  const channel = normalizeChannel(attribution?.channel || "direct");

  await writeCircleEvent({
    event: "pageview",
    path: input.path,
    ip: input.ip,
    ua: input.ua,
    host: input.host,
    country: input.country,
    region: input.region,
    city: input.city,
    fingerprint: input.fingerprint,
  });

  const kv = await getKv();
  if (!kv) return;

  const aeOn = await hasAnalyticsEngine();
  const now = new Date().toISOString();
  const day = dayKey();
  const ip = (input.ip || "unknown").slice(0, 64);
  const ua = (input.ua || "unknown").slice(0, 180);
  const path = (input.path || "/").slice(0, 200);
  const country = (input.country || "XX").toUpperCase().slice(0, 8);
  const id = visitorHash(ip, ua);

  // Always record minute buckets + map pins for the realtime Traffic visor.
  await recordLiveTrafficHit({
    visitorId: id,
    country,
    region: input.region,
    city: input.city,
    path,
    ua,
    fingerprint: input.fingerprint ?? null,
  });

  const key = metricsKey(day);
  const existing = (await kv.get<DailyMetrics>(key, "json")) ?? {
    pageviews: 0,
    uniques: [],
    uniquesCount: 0,
    byCountry: {},
    byPath: {},
    byChannel: {},
  };

  let uniques = existing.uniques ?? [];
  let uniquesCount =
    existing.uniquesCount ?? existing.uniques?.length ?? 0;

  if (aeOn) {
    // AE owns identity cardinality — don't invent unique counts in KV.
    uniques = [];
  } else {
    const set = new Set(uniques);
    set.add(id);
    uniques = [...set].slice(-ANALYTICS_BUDGET.maxDailyUniques);
    uniquesCount = set.size;
  }

  const byCountry = trimCounterMap(
    {
      ...(existing.byCountry ?? {}),
      [country]: (existing.byCountry?.[country] ?? 0) + 1,
    },
    ANALYTICS_BUDGET.maxDailyCountries,
  );
  const byPath = trimCounterMap(
    {
      ...(existing.byPath ?? {}),
      [path]: (existing.byPath?.[path] ?? 0) + 1,
    },
    ANALYTICS_BUDGET.maxDailyPaths,
  );
  const byChannel = trimCounterMap(
    {
      ...(existing.byChannel ?? {}),
      [channel]: (existing.byChannel?.[channel] ?? 0) + 1,
    },
    ANALYTICS_BUDGET.maxDailyChannels,
  );

  await kv.put(
    key,
    JSON.stringify({
      pageviews: existing.pageviews + 1,
      uniques,
      uniquesCount: aeOn ? existing.uniquesCount : uniquesCount,
      byCountry,
      byPath,
      byChannel,
    } satisfies DailyMetrics),
    { expirationTtl: ANALYTICS_BUDGET.ttlSeconds },
  );

  // When AE is bound, People/identity come from AE SQL — skip KV profiles.
  if (aeOn) return;

  const profileKey = visitorKey(id);
  const prev = await kv.get<VisitorProfile>(profileKey, "json");
  const lastSeenMs = prev ? Date.parse(prev.lastSeen) : 0;
  const shouldWriteProfile =
    !prev ||
    !Number.isFinite(lastSeenMs) ||
    Date.now() - lastSeenMs >= ANALYTICS_BUDGET.visitorWriteThrottleMs;

  if (!shouldWriteProfile) return;

  const isNewDay = prev?.lastDayKey !== day;
  const profile: VisitorProfile = {
    id,
    ip,
    country,
    region: (input.region || prev?.region || "").slice(0, 64),
    city: (input.city || prev?.city || "").slice(0, 64),
    ua,
    firstSeen: prev?.firstSeen ?? now,
    lastSeen: now,
    visitDays: (prev?.visitDays ?? 0) + (isNewDay || !prev ? 1 : 0),
    pageviews: (prev?.pageviews ?? 0) + 1,
    lastPath: path,
    lastHost: (input.host || "").slice(0, 120),
    topPaths: prev?.topPaths ?? {},
    lastDayKey: day,
    fingerprint: input.fingerprint ?? prev?.fingerprint ?? null,
    // First-touch: keep original channel forever.
    channel: prev?.channel || channel,
    utmSource: prev?.utmSource || attribution?.utmSource || null,
    utmMedium: prev?.utmMedium || attribution?.utmMedium || null,
    utmCampaign: prev?.utmCampaign || attribution?.utmCampaign || null,
    referrer: prev?.referrer || attribution?.referrer || null,
    wallets: prev?.wallets ?? [],
    walletBrands: prev?.walletBrands ?? [],
    cryptoConnects: prev?.cryptoConnects ?? 0,
    cryptoPays: prev?.cryptoPays ?? 0,
    lastWalletAddress: prev?.lastWalletAddress ?? null,
    lastWalletBrand: prev?.lastWalletBrand ?? null,
  };
  await kv.put(profileKey, JSON.stringify(profile), {
    expirationTtl: ANALYTICS_BUDGET.ttlSeconds,
  });

  const recent = (await kv.get<{ ids: string[] }>("visitors:recent", "json")) ?? {
    ids: [],
  };
  if (recent.ids[0] === id) return;
  const ids = [id, ...recent.ids.filter((item) => item !== id)].slice(
    0,
    ANALYTICS_BUDGET.maxRecentVisitors,
  );
  await kv.put("visitors:recent", JSON.stringify({ ids }), {
    expirationTtl: ANALYTICS_BUDGET.ttlSeconds,
  });
}

export async function getTrafficSeries(days = 1) {
  // Always load yesterday so Today vs yesterday comparisons stay accurate.
  const lookback = Math.max(days, 2);
  try {
    const fromAe = await getTrafficSeriesFromAe(days);
    const hasData = fromAe.series.some((d) => d.pageviews > 0 || d.uniques > 0);
    if (hasData) return fromAe;
  } catch (error) {
    console.error("[pageviews] AE traffic query failed", error);
  }

  const kv = await getKv();
  const fullSeries: {
    date: string;
    pageviews: number;
    uniques: number;
    byCountry: Record<string, number>;
    byPath: Record<string, number>;
    byChannel: Record<string, number>;
  }[] = [];

  for (let i = lookback - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const date = dayKey(d);
    if (!kv) {
      fullSeries.push({
        date,
        pageviews: 0,
        uniques: 0,
        byCountry: {},
        byPath: {},
        byChannel: {},
      });
      continue;
    }
    const row = await kv.get<DailyMetrics>(metricsKey(date), "json");
    fullSeries.push({
      date,
      pageviews: row?.pageviews ?? 0,
      uniques: row?.uniquesCount ?? row?.uniques?.length ?? 0,
      byCountry: row?.byCountry ?? {},
      byPath: row?.byPath ?? {},
      byChannel: row?.byChannel ?? {},
    });
  }

  const series = fullSeries.slice(-days);
  return {
    series,
    today: fullSeries[fullSeries.length - 1]!,
    yesterday: fullSeries[fullSeries.length - 2] ?? {
      date: "",
      pageviews: 0,
      uniques: 0,
      byCountry: {},
      byPath: {},
      byChannel: {},
    },
  };
}

export async function getRecentVisitors(limit = 100): Promise<VisitorProfile[]> {
  try {
    const fromAe = await getRecentVisitorsFromAe(limit);
    if (fromAe.length > 0) return fromAe;
  } catch (error) {
    console.error("[pageviews] AE visitors query failed", error);
  }

  const kv = await getKv();
  if (!kv) return [];
  const recent = (await kv.get<{ ids: string[] }>("visitors:recent", "json")) ?? {
    ids: [],
  };
  const max = Math.min(
    Math.max(limit, 1),
    ANALYTICS_BUDGET.maxRecentVisitors,
  );
  const ids = recent.ids.slice(0, max);
  const profiles: VisitorProfile[] = [];
  for (let i = 0; i < ids.length; i += 25) {
    const chunk = ids.slice(i, i + 25);
    const rows = await Promise.all(
      chunk.map((id) => kv.get<VisitorProfile>(visitorKey(id), "json")),
    );
    for (const row of rows) {
      if (row) profiles.push(row);
    }
  }
  return profiles.sort(
    (a, b) => Date.parse(b.lastSeen) - Date.parse(a.lastSeen),
  );
}

export function mergeCountryCounts(
  series: { byCountry: Record<string, number> }[],
) {
  const out: Record<string, number> = {};
  for (const day of series) {
    for (const [code, count] of Object.entries(day.byCountry ?? {})) {
      out[code] = (out[code] ?? 0) + count;
    }
  }
  return Object.entries(out)
    .map(([country, pageviews]) => ({ country, pageviews }))
    .sort((a, b) => b.pageviews - a.pageviews);
}

export function mergePathCounts(series: { byPath: Record<string, number> }[]) {
  const out: Record<string, number> = {};
  for (const day of series) {
    for (const [path, count] of Object.entries(day.byPath ?? {})) {
      out[path] = (out[path] ?? 0) + count;
    }
  }
  return Object.entries(out)
    .map(([path, pageviews]) => ({ path, pageviews }))
    .sort((a, b) => b.pageviews - a.pageviews);
}

export function mergeChannelCounts(
  series: { byChannel?: Record<string, number> }[],
) {
  const out: Record<string, number> = {};
  for (const day of series) {
    for (const [channel, count] of Object.entries(day.byChannel ?? {})) {
      out[channel] = (out[channel] ?? 0) + count;
    }
  }
  return Object.entries(out)
    .map(([channel, pageviews]) => ({ channel, pageviews }))
    .sort((a, b) => b.pageviews - a.pageviews);
}
