"use client";

import { toast } from "sonner";

import {
  getIssueErrorCode,
  getWalletConnectErrorMessage,
  isLikelyDismissedWalletFlow,
  reportIssueEvent,
} from "./issue-reporting";

type WalletConnectFns = {
  authenticated: boolean;
  login: () => Promise<unknown> | unknown;
  linkWallet: () => Promise<unknown> | unknown;
};

export async function runWalletConnect(
  fns: WalletConnectFns,
  options?: {
    source?: string;
    walletAddress?: string | null;
    reportToMetrics?: boolean;
  },
) {
  const action = fns.authenticated ? fns.linkWallet : fns.login;

  try {
    await action();
  } catch (error) {
    if (isLikelyDismissedWalletFlow(error)) return;

    const message = getWalletConnectErrorMessage(error, {
      authenticated: fns.authenticated,
    });
    toast.error(message);

    if (options?.reportToMetrics !== false) {
      void reportIssueEvent({
        eventType: "issue_auto",
        category: "wallet-connect",
        source: options?.source ?? "wallet-connect",
        summary: fns.authenticated
          ? "Wallet link failed during connect flow."
          : "Wallet login failed during connect flow.",
        walletAddress: options?.walletAddress ?? null,
        code: getIssueErrorCode(error),
        metadata: {
          authenticated: fns.authenticated,
        },
      });
    }
  }
}
