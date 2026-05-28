import { createAgentExchangeClient } from "./agent-wallet";
import { BUILDER_ADDRESS } from "./builder";
import { resolvePerpMarket } from "./hyperliquid";
import {
  getHyperliquidPerpPriceDecimals,
  roundWithMode,
} from "./perp-order-utils";

async function withNonceRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.toLowerCase().includes("duplicate nonce")) throw err;
    return fn();
  }
}

export async function placePerpMarketOrder(params: {
  walletAddress: `0x${string}`;
  market: string;
  side: "buy" | "sell";
  sizeCoin: number;
  builderFeeUnits: number;
}) {
  const [exchClient, market] = await Promise.all([
    Promise.resolve(createAgentExchangeClient(params.walletAddress)),
    resolvePerpMarket(params.market),
  ]);
  const universeEntry = market.meta.universe[market.localIndex];
  const sizeDecimals = Math.max(0, universeEntry?.szDecimals ?? 6);
  const priceDecimals = getHyperliquidPerpPriceDecimals(
    market.midPrice,
    sizeDecimals,
  );
  const sizeStr = roundWithMode(params.sizeCoin, sizeDecimals, "down");
  const mid = market.midPrice;
  if (!mid) throw new Error("Could not fetch mark price");
  const slippage = params.side === "buy" ? mid * 1.05 : mid * 0.95;
  const marketPxStr =
    params.side === "buy"
      ? roundWithMode(slippage, priceDecimals, "up")
      : roundWithMode(slippage, priceDecimals, "down");

  await withNonceRetry(() =>
    exchClient.order({
      orders: [
        {
          a: market.assetId,
          b: params.side === "buy",
          p: marketPxStr,
          s: sizeStr,
          r: false,
          t: { limit: { tif: "Ioc" } },
        },
      ],
      grouping: "na",
      builder: { b: BUILDER_ADDRESS, f: params.builderFeeUnits },
    }),
  );

  return { sizeStr, priceStr: marketPxStr };
}

export async function placePerpLimitOrder(params: {
  walletAddress: `0x${string}`;
  market: string;
  side: "buy" | "sell";
  sizeCoin: number;
  limitPrice: number;
  builderFeeUnits: number;
}) {
  const [exchClient, market] = await Promise.all([
    Promise.resolve(createAgentExchangeClient(params.walletAddress)),
    resolvePerpMarket(params.market),
  ]);
  const universeEntry = market.meta.universe[market.localIndex];
  const sizeDecimals = Math.max(0, universeEntry?.szDecimals ?? 6);
  const priceDecimals = getHyperliquidPerpPriceDecimals(
    params.limitPrice,
    sizeDecimals,
  );
  const sizeStr = roundWithMode(params.sizeCoin, sizeDecimals, "down");
  const limitPxStr = roundWithMode(params.limitPrice, priceDecimals, "nearest");

  await withNonceRetry(() =>
    exchClient.order({
      orders: [
        {
          a: market.assetId,
          b: params.side === "buy",
          p: limitPxStr,
          s: sizeStr,
          r: false,
          t: { limit: { tif: "Gtc" } },
        },
      ],
      grouping: "na",
      builder: { b: BUILDER_ADDRESS, f: params.builderFeeUnits },
    }),
  );

  return { sizeStr, priceStr: limitPxStr };
}
