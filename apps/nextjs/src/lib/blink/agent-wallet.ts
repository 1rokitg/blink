"use client";

import * as hl from "@nktkas/hyperliquid";
import { generatePrivateKey, privateKeyToAddress } from "viem/accounts";

/**
 * localStorage key for a given wallet address.
 * Keyed per-wallet so different connected wallets each get their own agent key.
 * Using localStorage (not sessionStorage) means the key survives tab close/reopen,
 * so approveAgent only ever needs to be called once per wallet.
 */
function storageKey(walletAddress: string) {
  return `blink_agent_pk_${walletAddress.toLowerCase()}`;
}

/**
 * Returns the persistent agent private key for a given wallet address,
 * generating one if it doesn't exist yet.
 *
 * Stored in localStorage — survives tab/browser close. The same key is always
 * returned for the same wallet, so approveAgent only needs to be called once.
 *
 * The agent key signs all L1 trading actions (orders, cancels) locally without
 * going through the external wallet provider. This bypasses chainId validation
 * in wallets like Rabby/MetaMask.
 *
 * The agent must be approved on-chain via approveAgent() before it can trade.
 */
export function getOrCreateAgentKey(walletAddress: string): {
  privateKey: `0x${string}`;
  address: `0x${string}`;
} {
  if (typeof window === "undefined") {
    throw new Error("agent-wallet must be used client-side only");
  }

  const key = storageKey(walletAddress);
  let pk = localStorage.getItem(key) as `0x${string}` | null;
  if (!pk) {
    pk = generatePrivateKey();
    localStorage.setItem(key, pk);
  }

  return { privateKey: pk, address: privateKeyToAddress(pk) };
}

/** Remove the agent key for a wallet — call on logout/disconnect. */
export function clearAgentKey(walletAddress: string) {
  if (typeof window !== "undefined") {
    localStorage.removeItem(storageKey(walletAddress));
  }
}

/**
 * Build an ExchangeClient that signs locally with the persistent agent key
 * for the given wallet address.
 *
 * @param walletAddress - The user's main wallet address. Used both to look up
 *   (or generate) the per-wallet agent key, and as defaultVaultAddress so HL
 *   knows which account to trade on behalf of.
 */
export function createAgentExchangeClient(
  walletAddress: `0x${string}`,
): hl.ExchangeClient {
  const { privateKey } = getOrCreateAgentKey(walletAddress);
  return new hl.ExchangeClient({
    wallet: privateKey,
    transport: new hl.HttpTransport(),
    defaultVaultAddress: walletAddress,
  });
}
