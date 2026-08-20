import "server-only";

import { createHash } from "node:crypto";

import { getCloudflareContext } from "@opennextjs/cloudflare";

import { ANALYTICS_BUDGET } from "@/lib/analytics-budget";
import type {
  ClientFingerprint,
  CryptoDailyMetrics,
  CryptoEventName,
  CryptoEventRecord,
  CryptoFunnelStats,
  VisitorProfile,
  WalletProfile,
} from "@/lib/analytics-types";

export const AE_DATASET = "circle_events";

/** Blob column map for circle_events (ordered, stable). */
export const AE_BLOBS = {
  event: 1,
  path: 2,
  country: 3,
  planId: 4,
  chainId: 5,
  walletBrand: 6,
  walletAddress: 7,
  txHash: 8,
  ip: 9,
  ua: 10,
  host: 11,
  error: 12,
  providers: 13,
  fingerprint: 14,
  region: 15,
  city: 16,
  visitorId: 17,
} as const;

type EventWrite = {
  event: string;
  path?: string;
  country?: string;
  region?: string;
  city?: string;
  planId?: string | null;
  chainId?: string | null;
  walletBrand?: string | null;
  walletAddress?: string | null;
  txHash?: string | null;
  ip?: string;
  ua?: string;
  host?: string;
  error?: string | null;
  providers?: string[];
  fingerprint?: ClientFingerprint | null;
  amountUsdc?: number | null;
  visitorId?: string;
};

async function getEnv(): Promise<CloudflareEnv | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return env as CloudflareEnv;
  } catch {
    return null;
  }
}

export function visitorHash(ip: string, ua: string) {
  return createHash("sha256")
    .update(`${ip}|${ua}`)
    .digest("hex")
    .slice(0, 16);
}

function compactFingerprint(fp: ClientFingerprint | null | undefined) {
  if (!fp) return "";
  return [
    fp.timezone,
    fp.language,
    fp.platform,
    fp.screen,
    fp.hardwareConcurrency,
    fp.deviceMemory ?? "",
    fp.maxTouchPoints,
    fp.vendor,
    fp.webdriver ? "1" : "0",
  ].join("|");
}

function parseFingerprint(raw: string | null | undefined): ClientFingerprint | null {
  if (!raw) return null;
  const [
    timezone = "unknown",
    language = "unknown",
    platform = "unknown",
    screen = "0x0@1",
    hardwareConcurrency = "0",
    deviceMemory = "",
    maxTouchPoints = "0",
    vendor = "",
    webdriver = "0",
  ] = raw.split("|");
  return {
    timezone,
    language,
    languages: language ? [language] : [],
    platform,
    screen,
    colorDepth: 0,
    hardwareConcurrency: Number(hardwareConcurrency) || 0,
    deviceMemory: deviceMemory === "" ? null : Number(deviceMemory),
    maxTouchPoints: Number(maxTouchPoints) || 0,
    cookieEnabled: true,
    doNotTrack: null,
    vendor,
    webdriver: webdriver === "1",
  };
}

/** Non-blocking Analytics Engine write — no-op while AE is disabled. */
export async function writeCircleEvent(input: EventWrite) {
  if (!ANALYTICS_BUDGET.analyticsEngineEnabled) return false;
  const env = await getEnv();
  const dataset = env?.CIRCLE_EVENTS;
  if (!dataset) return false;

  const ip = (input.ip || "unknown").slice(0, 64);
  const ua = (input.ua || "unknown").slice(0, 120);
  const visitorId = input.visitorId || visitorHash(ip, ua);

  // Do NOT await — writeDataPoint is fire-and-forget by design.
  dataset.writeDataPoint({
    indexes: [visitorId.slice(0, 96)],
    blobs: [
      (input.event || "unknown").slice(0, 64),
      (input.path || "/").slice(0, 200),
      (input.country || "XX").toUpperCase().slice(0, 8),
      (input.planId || "").slice(0, 32),
      (input.chainId || "").slice(0, 32),
      (input.walletBrand || "").slice(0, 64),
      (input.walletAddress || "").toLowerCase().slice(0, 128),
      (input.txHash || "").slice(0, 128),
      ip,
      ua,
      (input.host || "").slice(0, 120),
      (input.error || "").slice(0, 200),
      (input.providers ?? []).slice(0, 12).join(",").slice(0, 200),
      compactFingerprint(input.fingerprint).slice(0, 240),
      (input.region || "").slice(0, 64),
      (input.city || "").slice(0, 64),
      visitorId,
    ],
    doubles: [
      typeof input.amountUsdc === "number" && Number.isFinite(input.amountUsdc)
        ? input.amountUsdc
        : 0,
      1,
    ],
  });
  return true;
}

type SqlRow = Record<string, string | number | null>;

async function queryAnalyticsSql(sql: string): Promise<SqlRow[]> {
  // Hard-off until Workers Paid + AE binding are intentionally re-enabled.
  if (!(await isAnalyticsEngineConfigured())) return [];

  const accountId =
    process.env.CF_ACCOUNT_ID?.trim() ||
    process.env.CLOUDFLARE_ACCOUNT_ID?.trim() ||
    "72265998f8cf66e3ab4d88575895dd0d";
  const token =
    process.env.CF_ANALYTICS_API_TOKEN?.trim() ||
    process.env.CLOUDFLARE_API_TOKEN?.trim() ||
    "";
  if (!token) return [];

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "text/plain",
      },
      body: sql.includes("FORMAT ") ? sql : `${sql.trim()}\nFORMAT JSON`,
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error("[analytics-engine] SQL failed", response.status, text.slice(0, 300));
    return [];
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const json = (await response.json()) as {
      data?: SqlRow[];
      result?: SqlRow[];
      meta?: unknown;
    };
    return json.data ?? json.result ?? [];
  }

  // Default FORMAT JSON often returns { meta, data, rows }
  const json = (await response.json().catch(() => null)) as {
    data?: SqlRow[];
  } | null;
  return json?.data ?? [];
}

function intervalDays(days: number) {
  const safe = Math.min(Math.max(days, 1), 90);
  return `INTERVAL '${safe}' DAY`;
}

function emptyDaily(): CryptoDailyMetrics {
  return {
    views: 0,
    methodCrypto: 0,
    methodCard: 0,
    connectAttempts: 0,
    connectSuccess: 0,
    connectFail: 0,
    signSuccess: 0,
    signFail: 0,
    verifySuccess: 0,
    verifyFail: 0,
    paid: 0,
    revenueUsdc: 0,
    byWallet: {},
    byChain: {},
    byPlan: {},
    uniqueWallets: [],
    uniqueVisitors: [],
  };
}

function rate(num: number, den: number): number | null {
  if (den <= 0) return null;
  return (num / den) * 100;
}

function num(value: string | number | null | undefined) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) return Number(value) || 0;
  return 0;
}

function str(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "";
  return String(value);
}

export async function getTrafficSeriesFromAe(days = 1) {
  // Always look back at least 2 days so yesterday stays available for Today.
  const lookback = Math.max(days, 2);
  const rows = await queryAnalyticsSql(`
    SELECT
      toDate(timestamp) AS date,
      SUM(_sample_interval) AS pageviews,
      uniqExact(index1) AS uniques
    FROM ${AE_DATASET}
    WHERE timestamp >= NOW() - ${intervalDays(lookback)}
      AND blob1 = 'pageview'
    GROUP BY date
    ORDER BY date ASC
  `);

  const byDate = new Map(
    rows.map((row) => [
      str(row.date).slice(0, 10),
      {
        pageviews: num(row.pageviews),
        uniques: num(row.uniques),
      },
    ]),
  );

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
    const date = d.toISOString().slice(0, 10);
    const hit = byDate.get(date);
    fullSeries.push({
      date,
      pageviews: hit?.pageviews ?? 0,
      uniques: hit?.uniques ?? 0,
      byCountry: {},
      byPath: {},
      byChannel: {},
    });
  }

  const series = fullSeries.slice(-days);

  // Enrich selected window with country/path rollups
  const dimRows = await queryAnalyticsSql(`
    SELECT
      blob3 AS country,
      blob2 AS path,
      SUM(_sample_interval) AS pageviews
    FROM ${AE_DATASET}
    WHERE timestamp >= NOW() - ${intervalDays(days)}
      AND blob1 = 'pageview'
    GROUP BY country, path
  `);

  const byCountry: Record<string, number> = {};
  const byPath: Record<string, number> = {};
  for (const row of dimRows) {
    const country = str(row.country) || "XX";
    const path = str(row.path) || "/";
    byCountry[country] = (byCountry[country] ?? 0) + num(row.pageviews);
    byPath[path] = (byPath[path] ?? 0) + num(row.pageviews);
  }
  for (const day of series) {
    day.byCountry = byCountry;
    day.byPath = byPath;
  }

  return {
    series,
    today: fullSeries[fullSeries.length - 1]!,
    yesterday: fullSeries[fullSeries.length - 2]!,
  };
}

export async function getRecentVisitorsFromAe(
  limit = 150,
): Promise<VisitorProfile[]> {
  const rows = await queryAnalyticsSql(`
    SELECT
      index1 AS visitorId,
      argMax(blob9, timestamp) AS ip,
      argMax(blob3, timestamp) AS country,
      argMax(blob15, timestamp) AS region,
      argMax(blob16, timestamp) AS city,
      argMax(blob10, timestamp) AS ua,
      min(timestamp) AS firstSeen,
      max(timestamp) AS lastSeen,
      uniqExact(toDate(timestamp)) AS visitDays,
      SUM(_sample_interval) AS pageviews,
      argMax(blob2, timestamp) AS lastPath,
      argMax(blob11, timestamp) AS lastHost,
      argMax(blob7, timestamp) AS lastWalletAddress,
      argMax(blob6, timestamp) AS lastWalletBrand,
      argMax(blob14, timestamp) AS fingerprint,
      countIf(blob1 = 'crypto_connect_success') AS cryptoConnects,
      countIf(blob1 = 'crypto_paid') AS cryptoPays
    FROM ${AE_DATASET}
    WHERE timestamp >= NOW() - INTERVAL '90' DAY
    GROUP BY visitorId
    ORDER BY lastSeen DESC
    LIMIT ${Math.min(Math.max(limit, 1), 400)}
  `);

  return rows.map((row) => {
    const firstSeen = str(row.firstSeen);
    const lastSeen = str(row.lastSeen);
    return {
      id: str(row.visitorId),
      ip: str(row.ip) || "unknown",
      country: str(row.country) || "XX",
      region: str(row.region),
      city: str(row.city),
      ua: str(row.ua),
      firstSeen: firstSeen.includes("T")
        ? firstSeen
        : new Date(firstSeen).toISOString(),
      lastSeen: lastSeen.includes("T")
        ? lastSeen
        : new Date(lastSeen).toISOString(),
      visitDays: num(row.visitDays) || 1,
      pageviews: num(row.pageviews),
      lastPath: str(row.lastPath) || "/",
      lastHost: str(row.lastHost),
      topPaths: {},
      lastDayKey: (lastSeen || "").slice(0, 10),
      fingerprint: parseFingerprint(str(row.fingerprint)),
      wallets: str(row.lastWalletAddress) ? [str(row.lastWalletAddress)] : [],
      walletBrands: str(row.lastWalletBrand) ? [str(row.lastWalletBrand)] : [],
      cryptoConnects: num(row.cryptoConnects),
      cryptoPays: num(row.cryptoPays),
      lastWalletAddress: str(row.lastWalletAddress) || null,
      lastWalletBrand: str(row.lastWalletBrand) || null,
    } satisfies VisitorProfile;
  });
}

export async function getCryptoFunnelFromAe(
  days = 1,
): Promise<CryptoFunnelStats> {
  const eventRows = await queryAnalyticsSql(`
    SELECT
      toDate(timestamp) AS date,
      blob1 AS event,
      SUM(_sample_interval) AS count,
      SUM(_sample_interval * double1) AS revenueUsdc
    FROM ${AE_DATASET}
    WHERE timestamp >= NOW() - ${intervalDays(days)}
      AND blob1 != 'pageview'
    GROUP BY date, event
    ORDER BY date ASC
  `);

  const dayMap = new Map<string, CryptoDailyMetrics>();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    dayMap.set(d.toISOString().slice(0, 10), emptyDaily());
  }

  for (const row of eventRows) {
    const date = str(row.date).slice(0, 10);
    const metrics = dayMap.get(date) ?? emptyDaily();
    const event = str(row.event) as CryptoEventName | string;
    const count = num(row.count);
    const revenue = num(row.revenueUsdc);
    switch (event) {
      case "crypto_view":
        metrics.views += count;
        break;
      case "pay_method_select":
        // chainId not in this aggregate — counted separately below
        break;
      case "crypto_connect_attempt":
        metrics.connectAttempts += count;
        break;
      case "crypto_connect_success":
        metrics.connectSuccess += count;
        break;
      case "crypto_connect_fail":
        metrics.connectFail += count;
        break;
      case "crypto_sign_success":
        metrics.signSuccess += count;
        break;
      case "crypto_sign_fail":
        metrics.signFail += count;
        break;
      case "crypto_verify_success":
        metrics.verifySuccess += count;
        break;
      case "crypto_verify_fail":
        metrics.verifyFail += count;
        break;
      case "crypto_paid":
        metrics.paid += count;
        metrics.revenueUsdc += revenue;
        break;
      default:
        break;
    }
    dayMap.set(date, metrics);
  }

  const methodRows = await queryAnalyticsSql(`
    SELECT blob5 AS method, SUM(_sample_interval) AS count
    FROM ${AE_DATASET}
    WHERE timestamp >= NOW() - ${intervalDays(days)}
      AND blob1 = 'pay_method_select'
    GROUP BY method
  `);
  const totals = emptyDaily();
  for (const metrics of dayMap.values()) {
    totals.views += metrics.views;
    totals.connectAttempts += metrics.connectAttempts;
    totals.connectSuccess += metrics.connectSuccess;
    totals.connectFail += metrics.connectFail;
    totals.signSuccess += metrics.signSuccess;
    totals.signFail += metrics.signFail;
    totals.verifySuccess += metrics.verifySuccess;
    totals.verifyFail += metrics.verifyFail;
    totals.paid += metrics.paid;
    totals.revenueUsdc += metrics.revenueUsdc;
  }
  for (const row of methodRows) {
    if (str(row.method) === "card") totals.methodCard += num(row.count);
    else totals.methodCrypto += num(row.count);
  }

  const walletRows = await queryAnalyticsSql(`
    SELECT blob6 AS brand, SUM(_sample_interval) AS count
    FROM ${AE_DATASET}
    WHERE timestamp >= NOW() - ${intervalDays(days)}
      AND blob1 IN ('crypto_connect_success', 'crypto_paid')
      AND blob6 != ''
    GROUP BY brand
    ORDER BY count DESC
    LIMIT 20
  `);
  for (const row of walletRows) {
    totals.byWallet[str(row.brand)] = num(row.count);
  }

  const chainRows = await queryAnalyticsSql(`
    SELECT blob5 AS chain, SUM(_sample_interval) AS count
    FROM ${AE_DATASET}
    WHERE timestamp >= NOW() - ${intervalDays(days)}
      AND blob5 != ''
      AND blob1 IN ('crypto_chain_select', 'crypto_paid', 'crypto_sign_success')
    GROUP BY chain
    ORDER BY count DESC
    LIMIT 20
  `);
  for (const row of chainRows) {
    totals.byChain[str(row.chain)] = num(row.count);
  }

  const planRows = await queryAnalyticsSql(`
    SELECT blob4 AS planId, SUM(_sample_interval) AS count
    FROM ${AE_DATASET}
    WHERE timestamp >= NOW() - ${intervalDays(days)}
      AND blob4 != ''
      AND blob1 IN ('crypto_view', 'crypto_paid', 'crypto_connect_attempt')
    GROUP BY planId
    ORDER BY count DESC
    LIMIT 20
  `);
  for (const row of planRows) {
    totals.byPlan[str(row.planId)] = num(row.count);
  }

  const walletsRaw = await queryAnalyticsSql(`
    SELECT
      blob7 AS address,
      argMax(blob6, timestamp) AS brand,
      min(timestamp) AS firstSeen,
      max(timestamp) AS lastSeen,
      countIf(blob1 = 'crypto_connect_success') AS connectCount,
      countIf(blob1 = 'crypto_paid') AS payCount,
      sumIf(double1 * _sample_interval, blob1 = 'crypto_paid') AS totalUsdc,
      argMax(index1, timestamp) AS lastVisitorId,
      argMax(blob3, timestamp) AS lastCountry,
      argMax(blob4, timestamp) AS lastPlanId,
      argMax(blob5, timestamp) AS lastChainId,
      argMax(blob8, timestamp) AS lastTxHash
    FROM ${AE_DATASET}
    WHERE timestamp >= NOW() - INTERVAL '90' DAY
      AND blob7 != ''
    GROUP BY address
    ORDER BY lastSeen DESC
    LIMIT 100
  `);

  const wallets: WalletProfile[] = walletsRaw.map((row) => {
    const brand = str(row.brand);
    return {
      address: str(row.address),
      brands: brand ? [brand] : [],
      firstSeen: str(row.firstSeen),
      lastSeen: str(row.lastSeen),
      connectCount: num(row.connectCount),
      payCount: num(row.payCount),
      totalUsdc: num(row.totalUsdc),
      lastVisitorId: str(row.lastVisitorId) || null,
      lastCountry: str(row.lastCountry) || null,
      lastPlanId: str(row.lastPlanId) || null,
      lastChainId: str(row.lastChainId) || null,
      lastTxHash: str(row.lastTxHash) || null,
      chains: {},
      plans: {},
    };
  });

  const recentRaw = await queryAnalyticsSql(`
    SELECT
      timestamp AS at,
      blob1 AS event,
      index1 AS visitorId,
      blob9 AS ip,
      blob3 AS country,
      blob2 AS path,
      blob4 AS planId,
      blob5 AS chainId,
      blob6 AS walletBrand,
      blob7 AS walletAddress,
      blob8 AS txHash,
      blob12 AS error,
      blob13 AS providers,
      blob14 AS fingerprint
    FROM ${AE_DATASET}
    WHERE timestamp >= NOW() - ${intervalDays(days)}
      AND blob1 != 'pageview'
    ORDER BY timestamp DESC
    LIMIT 120
  `);

  const recentEvents: CryptoEventRecord[] = recentRaw.map((row, index) => ({
    id: `${str(row.at)}-${index}`,
    at: str(row.at),
    event: str(row.event) as CryptoEventName,
    visitorId: str(row.visitorId),
    ip: str(row.ip),
    country: str(row.country) || "XX",
    path: str(row.path) || "/",
    planId: str(row.planId) || null,
    chainId: str(row.chainId) || null,
    walletBrand: str(row.walletBrand) || null,
    walletAddress: str(row.walletAddress) || null,
    txHash: str(row.txHash) || null,
    error: str(row.error) || null,
    providers: str(row.providers)
      ? str(row.providers)
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean)
      : [],
    fingerprint: parseFingerprint(str(row.fingerprint)),
  }));

  const paymentRows = await queryAnalyticsSql(`
    SELECT
      timestamp AS createdAt,
      blob8 AS txHash,
      blob5 AS chainId,
      blob4 AS planId,
      double1 AS amountUsdc,
      blob7 AS walletAddress,
      blob6 AS walletBrand
    FROM ${AE_DATASET}
    WHERE timestamp >= NOW() - INTERVAL '90' DAY
      AND blob1 = 'crypto_paid'
    ORDER BY timestamp DESC
    LIMIT 100
  `);

  const series = [...dayMap.entries()].map(([date, metrics]) => ({
    date,
    metrics,
  }));

  return {
    series,
    totals,
    conversion: {
      viewToConnect: rate(totals.connectSuccess, totals.views),
      connectToSign: rate(totals.signSuccess, totals.connectSuccess),
      signToPaid: rate(totals.paid, totals.signSuccess),
      viewToPaid: rate(totals.paid, totals.views),
    },
    wallets,
    recentEvents,
    payments: paymentRows.map((row) => ({
      txHash: str(row.txHash),
      chainId: str(row.chainId),
      planId: str(row.planId),
      amountUsdc: num(row.amountUsdc),
      walletAddress: str(row.walletAddress) || null,
      walletBrand: str(row.walletBrand) || null,
      telegramUsername: "",
      createdAt: str(row.createdAt),
    })),
  };
}

export async function isAnalyticsEngineConfigured() {
  if (!ANALYTICS_BUDGET.analyticsEngineEnabled) return false;
  const env = await getEnv();
  return Boolean(env?.CIRCLE_EVENTS);
}
