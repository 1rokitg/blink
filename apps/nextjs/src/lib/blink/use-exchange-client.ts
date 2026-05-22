"use client";

import { useCallback } from "react";

import { useWallets } from "@privy-io/react-auth";

import { createExchangeClient } from "./hyperliquid";

/**
 * Returns a factory function that creates a fresh ExchangeClient using
 * the first connected Privy wallet. Call the returned fn inside event
 * handlers or mutations — do NOT store the client in state (it holds
 * a WebSocket transport that should be short-lived).
 */
export function useExchangeClientFactory() {
  const { wallets } = useWallets();

  return useCallback(async () => {
    const wallet = wallets[0];
    if (!wallet) throw new Error("No wallet connected");
    return createExchangeClient(wallet);
  }, [wallets]);
}
