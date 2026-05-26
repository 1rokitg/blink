import {
  fetchPerpDexs,
  fetchPerpMetaAndAssetCtxs,
  infoClient,
} from "./hyperliquid";

export type MarketSummary = {
  coin: string;
  changePct: number;
  dailyVolume: number;
  dex: string | null;
  isHip3: boolean;
  markPx: number;
  slug: string;
};

export const DEFAULT_MARKET = "BTC";
export const PRIORITY_TRADFI_MARKETS = ["xyz:GOLD", "cash:WTI"] as const;

export function marketToSlug(coin: string) {
  return slugToMarketSymbol(coin);
}

export function slugToMarketSymbol(slug: string) {
  const decoded = decodeURIComponent(slug).replace(/\s+/g, "");
  if (!decoded.includes(":")) {
    return decoded.toUpperCase();
  }
  const [dex, market] = decoded.split(/:(.+)/);
  return `${dex?.toLowerCase() ?? ""}:${market?.toUpperCase() ?? ""}`;
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

type PerpMetaAndAssetCtxsResponse = [
  {
    universe: Array<{
      name: string;
    }>;
  },
  Array<{
    dayNtlVlm?: string;
    markPx?: string;
    prevDayPx?: string;
  }>,
];

type NormalizedPerpMeta = PerpMetaAndAssetCtxsResponse[0];
type NormalizedPerpAssetCtxs = PerpMetaAndAssetCtxsResponse[1];

function normalizeMarketSummaries(
  meta: NormalizedPerpMeta,
  assetCtxs: NormalizedPerpAssetCtxs,
  dex: string | null,
) {
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
        changePct,
        dailyVolume,
        dex,
        isHip3: Boolean(dex),
        markPx,
        slug: marketToSlug(market.name),
      } satisfies MarketSummary;
    })
    .filter((market) => Number.isFinite(market.markPx) && market.markPx > 0);
}

async function fetchHip3MarketSummaries() {
  const dexes = await fetchPerpDexs();
  const hip3DexNames = dexes.flatMap((dex) => (dex?.name ? [dex.name] : []));
  const settled = await Promise.allSettled(
    hip3DexNames.map(async (dex) => {
      const [meta, assetCtxs] = (await fetchPerpMetaAndAssetCtxs(
        dex,
      )) as PerpMetaAndAssetCtxsResponse;
      return normalizeMarketSummaries(meta, assetCtxs, dex);
    }),
  );

  return settled.flatMap((result) =>
    result.status === "fulfilled" ? result.value : [],
  );
}

function prioritizeMarkets(
  markets: MarketSummary[],
  limit: number,
  priorityCoins: readonly string[] = [],
) {
  if (priorityCoins.length === 0) {
    return markets.slice(0, limit);
  }

  const marketByCoin = new Map(markets.map((market) => [market.coin, market]));
  const priorityRows = priorityCoins.flatMap((coin) => {
    const market = marketByCoin.get(coin);
    return market ? [market] : [];
  });
  const remainingRows = markets.filter(
    (market) => !priorityCoins.includes(market.coin),
  );

  return [...priorityRows, ...remainingRows].slice(0, limit);
}

export async function fetchTopMarketsByVolume(
  limit = 25,
  options?: {
    includeHip3Offers?: boolean;
    priorityCoins?: readonly string[];
  },
) {
  const [meta, assetCtxs] = await infoClient.metaAndAssetCtxs();
  const coreMarkets = normalizeMarketSummaries(meta, assetCtxs, null).sort(
    (left, right) => right.dailyVolume - left.dailyVolume,
  );

  if (!options?.includeHip3Offers) {
    return prioritizeMarkets(coreMarkets, limit, options?.priorityCoins);
  }

  try {
    const seen = new Set(coreMarkets.map((market) => market.coin));
    const hip3Markets = (await fetchHip3MarketSummaries())
      .filter((market) => !seen.has(market.coin))
      .sort((left, right) => right.dailyVolume - left.dailyVolume);

    const combinedMarkets = [...coreMarkets, ...hip3Markets].sort(
      (left, right) => right.dailyVolume - left.dailyVolume,
    );

    return prioritizeMarkets(combinedMarkets, limit, options?.priorityCoins);
  } catch {
    return prioritizeMarkets(coreMarkets, limit, options?.priorityCoins);
  }
}
