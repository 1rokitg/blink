import { infoClient } from "./hyperliquid";

export type MarketSummary = {
  coin: string;
  slug: string;
  markPx: number;
  changePct: number;
  dailyVolume: number;
};

export const DEFAULT_MARKET = "BTC";

export function marketToSlug(coin: string) {
  return coin.toUpperCase();
}

export function slugToMarketSymbol(slug: string) {
  return decodeURIComponent(slug).replace(/\s+/g, "").toUpperCase();
}

export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: value >= 1_000 ? 1 : 2,
  }).format(value);
}

export function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

export async function fetchTopMarketsByVolume(limit = 25) {
  const [meta, assetCtxs] = await infoClient.metaAndAssetCtxs();

  return meta.universe
    .map((market, index) => {
      const ctx = assetCtxs[index];
      const markPx = Number(ctx?.markPx ?? 0);
      const prevDayPx = Number(ctx?.prevDayPx ?? 0);
      const dailyVolume = Number(ctx?.dayNtlVlm ?? 0);
      const changePct =
        prevDayPx > 0 ? ((markPx - prevDayPx) / prevDayPx) * 100 : 0;

      return {
        coin: market.name,
        slug: marketToSlug(market.name),
        markPx,
        changePct,
        dailyVolume,
      } satisfies MarketSummary;
    })
    .filter((market) => Number.isFinite(market.markPx) && market.markPx > 0)
    .sort((left, right) => right.dailyVolume - left.dailyVolume)
    .slice(0, limit);
}
