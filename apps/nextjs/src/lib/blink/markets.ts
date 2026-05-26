import { infoClient } from "./hyperliquid";

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
const HYPERLIQUID_INFO_URL = "https://api.hyperliquid.xyz/info";

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

type PerpDex = { name: string } | null;
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

async function fetchPerpDexs() {
  const response = await fetch(HYPERLIQUID_INFO_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ type: "perpDexs" }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch perpDexs (${response.status})`);
  }

  return (await response.json()) as PerpDex[];
}

async function fetchPerpMetaAndAssetCtxs(dex = "") {
  const response = await fetch(HYPERLIQUID_INFO_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(
      dex ? { type: "metaAndAssetCtxs", dex } : { type: "metaAndAssetCtxs" },
    ),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch metaAndAssetCtxs (${response.status})`);
  }

  return (await response.json()) as PerpMetaAndAssetCtxsResponse;
}

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
      const [meta, assetCtxs] = await fetchPerpMetaAndAssetCtxs(dex);
      return normalizeMarketSummaries(meta, assetCtxs, dex);
    }),
  );

  return settled.flatMap((result) =>
    result.status === "fulfilled" ? result.value : [],
  );
}

export async function fetchTopMarketsByVolume(
  limit = 25,
  options?: { includeHip3Offers?: boolean },
) {
  const [meta, assetCtxs] = await infoClient.metaAndAssetCtxs();
  const coreMarkets = normalizeMarketSummaries(meta, assetCtxs, null)
    .sort((left, right) => right.dailyVolume - left.dailyVolume)
    .slice(0, limit);

  if (!options?.includeHip3Offers) {
    return coreMarkets;
  }

  try {
    const seen = new Set(coreMarkets.map((market) => market.coin));
    const hip3Markets = (await fetchHip3MarketSummaries())
      .filter((market) => !seen.has(market.coin))
      .sort((left, right) => right.dailyVolume - left.dailyVolume);

    return [...coreMarkets, ...hip3Markets];
  } catch {
    return coreMarkets;
  }
}
