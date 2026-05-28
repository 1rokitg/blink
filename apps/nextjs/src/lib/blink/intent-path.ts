import { marketToSlug } from "./markets";

/** Shareable `/i/...` path segment (lowercase core tickers, encoded HIP-3). */
export function intentMarketPath(coin: string) {
  const slug = marketToSlug(coin);
  if (slug.includes(":")) {
    return encodeURIComponent(slug);
  }
  return slug.toLowerCase();
}

export function intentMarketUrl(
  coin: string,
  mode: "market" | "limit",
  query?: Record<string, string>,
) {
  const base = `https://blink.lat/i/${intentMarketPath(coin)}/${mode}`;
  if (!query || Object.keys(query).length === 0) return base;
  const params = new URLSearchParams(query);
  return `${base}?${params.toString()}`;
}
