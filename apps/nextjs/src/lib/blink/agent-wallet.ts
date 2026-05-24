"use client";

import * as hl from "@nktkas/hyperliquid";
import { generatePrivateKey, privateKeyToAddress } from "viem/accounts";

const SESSION_KEY = "blink_agent_pk";

/**
 * Returns the session agent private key, generating one if it doesn't exist.
 * Stored in sessionStorage — cleared when the tab/browser is closed.
 *
 * The agent key is an ephemeral keypair used to sign all L1 trading actions
 * (orders, cancels) locally without going through the external wallet provider.
 * This bypasses chainId validation in wallets like Rabby/MetaMask.
 *
 * The agent must be approved on-chain via approveAgent() before it can trade.
 */
export function getOrCreateAgentKey(): {
  privateKey: `0x${string}`;
  address: `0x${string}`;
} {
  if (typeof window === "undefined") {
    // SSR guard — should never be called server-side
    throw new Error("agent-wallet must be used client-side only");
  }

  let pk = sessionStorage.getItem(SESSION_KEY) as `0x${string}` | null;
  if (!pk) {
    pk = generatePrivateKey();
    sessionStorage.setItem(SESSION_KEY, pk);
  }

  return { privateKey: pk, address: privateKeyToAddress(pk) };
}

/** Remove the session agent key — call on logout. */
export function clearAgentKey() {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(SESSION_KEY);
  }
}

/**
 * Build an ExchangeClient that signs locally with the session agent key.
 * No provider, no chainId validation, no wallet popups — instant signing.
 *
 * @param vaultAddress - The main wallet address the agent is approved to trade
 *   on behalf of. Required: without it HL rejects with "wallet does not exist"
 *   because it would try to trade as the agent's own address (which has no funds).
 */
export function createAgentExchangeClient(
  vaultAddress: `0x${string}`,
): hl.ExchangeClient {
  const { privateKey } = getOrCreateAgentKey();
  return new hl.ExchangeClient({
    wallet: privateKey,
    transport: new hl.HttpTransport(),
    defaultVaultAddress: vaultAddress,
  });
}
