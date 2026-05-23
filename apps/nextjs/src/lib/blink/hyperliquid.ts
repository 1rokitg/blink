import * as hl from "@nktkas/hyperliquid";
import type { ConnectedWallet } from "@privy-io/react-auth";
import { createWalletClient, custom } from "viem";

export const infoClient = new hl.InfoClient({
  transport: new hl.HttpTransport(),
});

export function createSubscriptionClient() {
  return new hl.SubscriptionClient({
    transport: new hl.WebSocketTransport(),
  });
}

/**
 * Build an ExchangeClient from a Privy connected wallet.
 * The viem WalletClient is used as the signer — it satisfies
 * AbstractViemJsonRpcAccount (signTypedData + getAddresses + getChainId).
 */
export async function createExchangeClient(wallet: ConnectedWallet) {
  const provider = await wallet.getEthereumProvider();
  const viemClient = createWalletClient({
    account: wallet.address as `0x${string}`,
    transport: custom(provider),
  });

  return new hl.ExchangeClient({
    wallet: viemClient as unknown as hl.ExchangeClientParameters["wallet"],
    transport: new hl.HttpTransport(),
  });
}

/**
 * Return the numeric asset index for a coin (e.g. "BTC" → 0).
 * Needed for order placement — Hyperliquid identifies markets by index, not name.
 */
export async function getAssetIndex(coin: string): Promise<number> {
  const [meta] = await infoClient.metaAndAssetCtxs();
  const idx = meta.universe.findIndex((m) => m.name === coin);
  if (idx === -1) throw new Error(`Unknown market: ${coin}`);
  return idx;
}
