import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

import type { ClientFingerprint } from "@/lib/analytics-types";
import { jitterCentroid } from "@/lib/geo-centroids";
import type {
  MinuteBucket,
  TrafficLiveSnapshot,
  TrafficLiveWindow,
  VisitorPin,
} from "@/lib/traffic-live-types";

const MINUTE_TTL_SECONDS = 60 * 60 * 3;
const PINS_KEY = "traffic:live:pins";
const HITS_KEY = "traffic:live:hits";
const MAX_PINS = 250;
const MAX_HITS = 500;
const MAX_UNIQUES_PER_MINUTE = 400;

async function getKv(): Promise<KVNamespace | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return (env as CloudflareEnv).CRYPTO_PAYMENTS ?? null;
  } catch {
    return null;
  }
}

function minuteKeyUtc(d = new Date()) {
  const iso = new Date(
    Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      d.getUTCHours(),
      d.getUTCMinutes(),
    ),
  ).toISOString();
  return iso.slice(0, 16); // YYYY-MM-DDTHH:MM
}

function metricsMinuteKey(minute: string) {
  return `metrics:minute:${minute}`;
}

function hueFromId(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 33 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}

function deviceFromFingerprint(
  fp: ClientFingerprint | null | undefined,
  ua: string,
): VisitorPin["device"] {
  const platform = (fp?.platform || "").toLowerCase();
  const touch = fp?.maxTouchPoints ?? 0;
  const hay = `${platform} ${ua}`.toLowerCase();
  if (
    touch > 1 ||
    /iphone|android|mobile|ipod/.test(hay) ||
    platform.includes("iphone") ||
    platform.includes("android")
  ) {
    if (/ipad|tablet/.test(hay) || (touch > 1 && /mac/.test(platform))) {
      return "tablet";
    }
    return "mobile";
  }
  return "desktop";
}

function normalizePin(raw: VisitorPin): VisitorPin {
  const visitorId = raw.visitorId || raw.id;
  return {
    ...raw,
    visitorId,
    shortId: raw.shortId || visitorId.slice(0, 6),
  };
}

export async function recordLiveTrafficHit(input: {
  visitorId: string;
  country?: string;
  region?: string;
  city?: string;
  path?: string;
  ua?: string;
  fingerprint?: ClientFingerprint | null;
  pageviewsTotal?: number;
}) {
  const kv = await getKv();
  if (!kv) return;

  const now = new Date();
  const minute = minuteKeyUtc(now);
  const country = (input.country || "XX").toUpperCase().slice(0, 8);
  const visitorId = input.visitorId;
  const fp = input.fingerprint ?? null;
  const hitSeed = `${visitorId}:${now.getTime()}:${Math.random().toString(36).slice(2, 8)}`;
  const { lng, lat } = jitterCentroid(country, hitSeed);

  const key = metricsMinuteKey(minute);
  const existing =
    (await kv.get<MinuteBucket>(key, "json")) ?? {
      minute,
      pageviews: 0,
      uniques: [],
      byCountry: {},
    };
  const uniqueSet = new Set(existing.uniques);
  uniqueSet.add(visitorId);
  const next: MinuteBucket = {
    minute,
    pageviews: existing.pageviews + 1,
    uniques: [...uniqueSet].slice(-MAX_UNIQUES_PER_MINUTE),
    byCountry: {
      ...existing.byCountry,
      [country]: (existing.byCountry[country] ?? 0) + 1,
    },
  };
  await kv.put(key, JSON.stringify(next), {
    expirationTtl: MINUTE_TTL_SECONDS,
  });

  const pins =
    ((await kv.get<VisitorPin[]>(PINS_KEY, "json")) ?? []).map(normalizePin);
  const previous = pins.find((row) => row.visitorId === visitorId);
  const basePin: Omit<VisitorPin, "id" | "lng" | "lat"> = {
    visitorId,
    shortId: visitorId.slice(0, 6),
    country,
    region: (input.region || "").slice(0, 64),
    city: (input.city || "").slice(0, 64),
    path: (input.path || "/").slice(0, 200),
    lastSeen: now.toISOString(),
    pageviews:
      input.pageviewsTotal ??
      (previous ? previous.pageviews + 1 : 1),
    platform: fp?.platform || previous?.platform || "unknown",
    timezone: fp?.timezone || previous?.timezone || "unknown",
    language: fp?.language || previous?.language || "unknown",
    screen: fp?.screen || previous?.screen || "0x0@1",
    device: deviceFromFingerprint(fp, input.ua || ""),
    hue: hueFromId(visitorId),
    fingerprint: fp ?? previous?.fingerprint ?? null,
  };

  // Unique visitor pin (latest location / profile) for the uniques map.
  const uniquePin: VisitorPin = {
    ...basePin,
    id: visitorId,
    lng,
    lat,
  };
  const nextPins = [
    uniquePin,
    ...pins.filter((row) => row.visitorId !== visitorId),
  ].slice(0, MAX_PINS);
  await kv.put(PINS_KEY, JSON.stringify(nextPins), {
    expirationTtl: MINUTE_TTL_SECONDS,
  });

  // One marker per pageview hit — pageviews map should match live PV count.
  const hitPin: VisitorPin = {
    ...basePin,
    id: `hit_${hitSeed}`,
    pageviews: 1,
    lng,
    lat,
  };
  const hits =
    ((await kv.get<VisitorPin[]>(HITS_KEY, "json")) ?? []).map(normalizePin);
  const nextHits = [hitPin, ...hits].slice(0, MAX_HITS);
  await kv.put(HITS_KEY, JSON.stringify(nextHits), {
    expirationTtl: MINUTE_TTL_SECONDS,
  });
}

export async function getTrafficLiveSnapshot(
  windowMinutes: TrafficLiveWindow = 60,
): Promise<TrafficLiveSnapshot> {
  const kv = await getKv();
  const generatedAt = new Date().toISOString();
  const empty: TrafficLiveSnapshot = {
    generatedAt,
    windowMinutes,
    pageviews: 0,
    uniques: 0,
    series: [],
    byCountry: [],
    pins: [],
    uniquePins: [],
  };
  if (!kv) return empty;

  const now = new Date();
  const series: TrafficLiveSnapshot["series"] = [];
  const countryPageviews = new Map<string, number>();
  const countryUniques = new Map<string, Set<string>>();
  const uniqueIds = new Set<string>();
  let pageviews = 0;

  for (let i = windowMinutes - 1; i >= 0; i -= 1) {
    const d = new Date(now.getTime() - i * 60_000);
    const minute = minuteKeyUtc(d);
    const row = await kv.get<MinuteBucket>(metricsMinuteKey(minute), "json");
    const pv = row?.pageviews ?? 0;
    const uniques = row?.uniques ?? [];
    pageviews += pv;
    for (const id of uniques) uniqueIds.add(id);
    series.push({
      minute,
      pageviews: pv,
      uniques: uniques.length,
    });
    for (const [country, count] of Object.entries(row?.byCountry ?? {})) {
      countryPageviews.set(
        country,
        (countryPageviews.get(country) ?? 0) + count,
      );
      if (!countryUniques.has(country)) {
        countryUniques.set(country, new Set());
      }
    }
  }

  const cutoff = now.getTime() - windowMinutes * 60_000;
  const allUniquePins = (
    (await kv.get<VisitorPin[]>(PINS_KEY, "json")) ?? []
  ).map(normalizePin);
  const allHits = (
    (await kv.get<VisitorPin[]>(HITS_KEY, "json")) ?? []
  ).map(normalizePin);

  const uniquePins = allUniquePins
    .filter((pin) => Date.parse(pin.lastSeen) >= cutoff)
    .sort((a, b) => Date.parse(b.lastSeen) - Date.parse(a.lastSeen));

  let hitPins = allHits
    .filter((pin) => Date.parse(pin.lastSeen) >= cutoff)
    .sort((a, b) => Date.parse(b.lastSeen) - Date.parse(a.lastSeen));

  // Back-compat: older KV only had unique pins — expand by pageviews so the
  // activity map isn't stuck at unique count until new hits accrue.
  if (hitPins.length === 0 && uniquePins.length > 0) {
    hitPins = uniquePins.flatMap((pin) => {
      const copies = Math.max(1, Math.min(pin.pageviews || 1, 24));
      return Array.from({ length: copies }, (_, index) => {
        const seed = `${pin.visitorId}:expand:${index}`;
        const { lng, lat } = jitterCentroid(pin.country, seed);
        return {
          ...pin,
          id: `hit_expand_${pin.visitorId}_${index}`,
          pageviews: 1,
          lng,
          lat,
        } satisfies VisitorPin;
      });
    });
  }

  for (const pin of uniquePins) {
    const set = countryUniques.get(pin.country) ?? new Set<string>();
    set.add(pin.visitorId);
    countryUniques.set(pin.country, set);
  }

  const byCountry = [...countryPageviews.entries()]
    .map(([country, pv]) => ({
      country,
      pageviews: pv,
      uniques: countryUniques.get(country)?.size ?? 0,
    }))
    .sort((a, b) => b.pageviews - a.pageviews);

  const uniqueCount = Math.max(uniqueIds.size, uniquePins.length);

  return {
    generatedAt,
    windowMinutes,
    pageviews,
    uniques: uniqueCount,
    series,
    byCountry,
    pins: hitPins,
    uniquePins,
  };
}
