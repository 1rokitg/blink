import * as hl from "@nktkas/hyperliquid";
import type { ConnectedWallet } from "@privy-io/react-auth";
import { getAddress } from "viem";

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
 * Uses a lightweight EIP-1193 typed-data signer adapter to avoid viem's
 * chain guard conflicts between wallet RPC network (e.g. Arbitrum 42161)
 * and Hyperliquid L1 EIP-712 domain chainId (1337).
 */
export async function createExchangeClient(wallet: ConnectedWallet) {
  const provider = await wallet.getEthereumProvider();

  // Fetch the address directly from the provider — the authoritative source.
  // wallet.address from Privy SDK may differ in casing or may lag behind the
  // provider's internal account state. Both Rabby and Privy's own EIP-1193
  // wrapper validate that params[0] matches the provider's current account,
  // so we must use exactly what eth_accounts returns.
  const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
  const address = getAddress(accounts[0] ?? wallet.address);

  console.info("[exchange] signer address:", address);

  const signer = {
    async signTypedData(params: {
      domain: {
        name: string;
        version: string;
        chainId: number;
        verifyingContract: `0x${string}`;
      };
      types: {
        [key: string]: {
          name: string;
          type: string;
        }[];
      };
      primaryType: string;
      message: Record<string, unknown>;
    }) {
      const payload = JSON.stringify({
        domain: params.domain,
        types: params.types,
        primaryType: params.primaryType,
        message: params.message,
      });

      try {
        const sig = await provider.request({
          method: "eth_signTypedData_v4",
          params: [address, payload],
        });
        return sig as `0x${string}`;
      } catch {
        const sig = await provider.request({
          method: "eth_signTypedData",
          params: [address, payload],
        });
        return sig as `0x${string}`;
      }
    },
    async getAddresses() {
      return [address];
    },
    async getChainId() {
      // Hyperliquid L1 EIP-712 domain chain id.
      return 1337;
    },
  };

  return new hl.ExchangeClient({
    wallet: signer as unknown as hl.ExchangeClientParameters["wallet"],
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
