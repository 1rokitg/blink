import { infoClient } from "~/lib/blink/hyperliquid";

export type CoinMarketCtx = {
  fundingHourly: number;
  markPx: number;
};

/** Hourly funding rate from meta (e.g. 0.0001 = 0.01%/hr). */
export function formatHourlyFunding(hourly: number) {
  const sign = hourly >= 0 ? "+" : "";
  return `${sign}${(hourly * 100).toFixed(4)}%/hr`;
}

export function formatFundingApr(hourly: number) {
  const annualized = hourly * 24 * 365 * 100;
  const sign = annualized >= 0 ? "+" : "";
  return `${sign}${annualized.toFixed(2)}% APR`;
}

/** Distance from mark to liquidation as % of mark (always positive when valid). */
export function liquidationDistancePct(
  mark: number,
  liq: number,
  isLong: boolean,
): number | null {
  if (!(mark > 0) || !(liq > 0)) return null;
  if (isLong) {
    if (liq >= mark) return 0;
    return ((mark - liq) / mark) * 100;
  }
  if (liq <= mark) return 0;
  return ((liq - mark) / mark) * 100;
}

export async function fetchCoinMarketCtxMap(): Promise<
  Map<string, CoinMarketCtx>
> {
  const [[meta, assetCtxs], mids] = await Promise.all([
    infoClient.metaAndAssetCtxs(),
    infoClient.allMids(),
  ]);

  const map = new Map<string, CoinMarketCtx>();
  for (const [index, asset] of meta.universe.entries()) {
    const ctx = assetCtxs[index];
    const mid = Number(mids[asset.name] ?? 0);
    const markPx = Number(ctx?.markPx ?? mid) || mid;
    map.set(asset.name, {
      fundingHourly: Number(ctx?.funding ?? 0),
      markPx,
    });
  }
  return map;
}
