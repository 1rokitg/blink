/* Generated shape for Cloudflare bindings — refresh with `pnpm cf-typegen`. */

interface CloudflareEnv {
  ASSETS: Fetcher;
  CRYPTO_PAYMENTS: KVNamespace;
  /** High-volume analytics — Workers Analytics Engine dataset `circle_events`. */
  CIRCLE_EVENTS?: AnalyticsEngineDataset;
  /** @deprecated Use CIRCLE_EVENTS */
  PAGEVIEWS?: AnalyticsEngineDataset;
  CF_ACCOUNT_ID?: string;
}
