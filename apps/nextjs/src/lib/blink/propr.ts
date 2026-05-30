/** rokit founding affiliate link — Propr funded trading accounts */
export const PROPR_AFFILIATE_URL = "https://app.propr.xyz/r/ROKIT";

export const PROPR_FOUNDER_TWEET_URL =
  "https://x.com/rokitdotgg/status/2060043893672915066";

export const PROPR_TAGLINE = "Trade our capital, keep the upside";

export const PROPR_HEADLINE = "Get a funded account";

export const PROPR_SUBCOPY =
  "Pass the trading challenge. Trade with more capital. Keep 80% of profits.";

export const PROPR_BADGE = "Founding affiliate · rokit";

export function proprAffiliateUrl(source?: string) {
  if (!source) return PROPR_AFFILIATE_URL;
  const url = new URL(PROPR_AFFILIATE_URL);
  url.searchParams.set("utm_source", "blink");
  url.searchParams.set("utm_medium", source);
  return url.toString();
}
