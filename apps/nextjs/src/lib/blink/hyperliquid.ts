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
  const chainIdHex = (await provider.request({ method: "eth_chainId" })) as string;
  const chainId = Number.parseInt(chainIdHex, 16);

  // Fetch the address directly from the provider — the authoritative source.
  // wallet.address from Privy SDK may differ in casing or may lag behind the
  // provider's internal account state. Both Rabby and Privy's own EIP-1193
  // wrapper validate that params[0] matches the provider's current account,
  // so we must use exactly what eth_accounts returns.
  const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
  const providerAddress = accounts[0];
  // EIP-55 checksum every candidate — Rabby and Privy's EIP-1193 wrapper both
  // compare params[0] against the current account case-sensitively. The SDK also
  // recovers the signer from the returned signature and compares it (checksummed)
  // against getAddresses()[0] — if that's lowercase the comparison fails.
  const fromCandidates = Array.from(
    new Set(
      [wallet.address, providerAddress]
        .filter(Boolean)
        .map((a) => getAddress(a as string)),
    ),
  );
  const address = fromCandidates[0] ?? getAddress(wallet.address);

  console.info("[exchange] signer context", {
    walletAddress: wallet.address,
    providerChainIdHex: chainIdHex,
    providerChainId: chainId,
    providerAccounts: accounts,
    fromCandidates,
    selectedSigner: address,
  });

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

      for (const from of fromCandidates) {
        try {
          console.info("[exchange] signTypedData_v4 attempt", {
            from,
            chainId: params.domain.chainId,
            primaryType: params.primaryType,
          });
          const sig = await provider.request({
            method: "eth_signTypedData_v4",
            params: [from, payload],
          });
          return sig as `0x${string}`;
        } catch (err) {
          console.warn("[exchange] signTypedData_v4 attempt failed", {
            from,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      for (const from of fromCandidates) {
        try {
          console.info("[exchange] eth_signTypedData attempt", {
            from,
            chainId: params.domain.chainId,
            primaryType: params.primaryType,
          });
          const sig = await provider.request({
            method: "eth_signTypedData",
            params: [from, payload],
          });
          return sig as `0x${string}`;
        } catch (err) {
          console.warn("[exchange] eth_signTypedData attempt failed", {
            from,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      throw new Error(
        "All typed-data signing attempts failed for current wallet account",
      );
    },
    async getAddresses() {
      return [address];
    },
    async getChainId() {
      // For user-signed admin actions (approveBuilderFee / approveAgent),
      // wallet providers typically require the domain chain id to match
      // the currently connected chain.
      return chainId;
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
  const idx = getAssetIndexSync(coin, meta);
  return idx;
}

export function getAssetIndexSync(
  coin: string,
  meta: Awaited<ReturnType<typeof infoClient.metaAndAssetCtxs>>[0],
): number {
  const idx = meta.universe.findIndex((m) => m.name === coin);
  if (idx === -1) throw new Error(`Unknown market: ${coin}`);
  return idx;
}
