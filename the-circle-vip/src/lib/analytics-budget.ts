/**
 * Early-stage analytics budget knobs.
 *
 * Month-1 expectation: low ingest, stay cheap, stay queryable in Monetise.
 * Analytics Engine is disabled for now (billing / Workers Paid). Traffic +
 * crypto funnel fall back to KV / Cloudflare Zone Analytics.
 * To re-enable later: set `analyticsEngineEnabled: true`, uncomment
 * `analytics_engine_datasets` in wrangler.jsonc, enable AE in the dashboard.
 */
export const ANALYTICS_BUDGET = {
  /** Kill switch — keeps CIRCLE_EVENTS writes/SQL fully offline. */
  analyticsEngineEnabled: false,
  /** Max distinct visitor hashes retained per UTC day in KV. */
  maxDailyUniques: 2_000,
  /** Max path keys kept in daily rollup. */
  maxDailyPaths: 25,
  /** Max country keys kept in daily rollup. */
  maxDailyCountries: 40,
  /** Max sales-channel keys kept in daily rollup. */
  maxDailyChannels: 20,
  /** Max recent visitor ids for People tab. */
  maxRecentVisitors: 200,
  /** Don't rewrite a visitor KV profile more often than this. */
  visitorWriteThrottleMs: 15 * 60 * 1000,
  /** KV TTL for analytics keys (90d matches AE retention). */
  ttlSeconds: 60 * 60 * 24 * 90,
  /** Cap wallet addresses / brands on a visitor row. */
  maxWalletsPerVisitor: 8,
  maxBrandsPerVisitor: 6,
} as const;

export function trimCounterMap(
  map: Record<string, number>,
  limit: number,
): Record<string, number> {
  const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
  if (entries.length <= limit) return map;
  return Object.fromEntries(entries.slice(0, limit));
}
