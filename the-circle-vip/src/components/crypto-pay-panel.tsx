"use client";

import { useEffect, useState, useTransition } from "react";

import { useI18n } from "@/components/i18n-provider";
import {
  CRYPTO_CHAIN_ORDER,
  CRYPTO_CHAINS,
  shortenAddress,
  type CryptoChainId,
} from "@/lib/crypto-payments";
import {
  discoverWalletProviders,
  hasBrowserEvmWallet,
  sendUsdcWithBrowserWallet,
} from "@/lib/crypto-evm-client";
import { trackCryptoEvent } from "@/lib/client-fingerprint";
import { ensureStoredAttribution } from "@/lib/attribution";
import type { Plan } from "@/lib/plans";

type Props = {
  plan: Plan;
  telegramUsername?: string;
  referralCode?: string;
  onError: (message: string | null) => void;
};

export function CryptoPayPanel({
  plan,
  telegramUsername,
  referralCode,
  onError,
}: Props) {
  const { dictionary, t } = useI18n();
  const copy = dictionary.crypto;
  const [chainId, setChainId] = useState<CryptoChainId>("base");
  const [txHash, setTxHash] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [copied, setCopied] = useState<"recipient" | "amount" | null>(null);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);
  const [walletBrand, setWalletBrand] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [providers, setProviders] = useState<string[]>([]);

  const chain = CRYPTO_CHAINS[chainId];

  useEffect(() => {
    trackCryptoEvent({
      event: "crypto_view",
      planId: plan.id,
      chainId,
    });
    void discoverWalletProviders().then((discovery) => {
      setProviders(discovery.brands);
      if (discovery.brands.length > 0) {
        trackCryptoEvent({
          event: "wallet_detected",
          planId: plan.id,
          chainId,
          walletBrand: discovery.selectedBrand,
          providers: discovery.brands,
        });
      }
    });
    // Fire once per mount / plan change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.id]);

  async function copyValue(value: string, key: "recipient" | "amount") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      onError(copy.copyFailed);
    }
  }

  function handleSendFromWallet() {
    onError(null);
    setStatus(null);
    if (chain.kind !== "evm") {
      setShowManual(true);
      onError(null);
      setStatus(copy.sendSolanaThenPaste);
      trackCryptoEvent({
        event: "crypto_manual_open",
        planId: plan.id,
        chainId,
      });
      return;
    }
    if (!hasBrowserEvmWallet()) {
      setShowManual(true);
      onError(copy.noWallet);
      trackCryptoEvent({
        event: "crypto_connect_fail",
        planId: plan.id,
        chainId,
        error: "no_wallet",
      });
      return;
    }

    startTransition(async () => {
      trackCryptoEvent({
        event: "crypto_connect_attempt",
        planId: plan.id,
        chainId,
        providers,
      });
      try {
        setStatus(copy.confirmInWallet);
        const result = await sendUsdcWithBrowserWallet({
          chainId,
          amountUsdc: plan.amountUsd,
          onConnected: (info) => {
            setWalletAddress(info.address);
            setWalletBrand(info.walletBrand);
            setProviders(info.providers);
            trackCryptoEvent({
              event: "crypto_connect_success",
              planId: plan.id,
              chainId,
              walletAddress: info.address,
              walletBrand: info.walletBrand,
              providers: info.providers,
            });
          },
          onSignPrompt: (info) => {
            trackCryptoEvent({
              event: "crypto_sign_prompt",
              planId: plan.id,
              chainId,
              walletAddress: info.address,
              walletBrand: info.walletBrand,
            });
          },
        });
        setTxHash(result.txHash);
        setWalletAddress(result.from);
        setWalletBrand(result.walletBrand);
        trackCryptoEvent({
          event: "crypto_sign_success",
          planId: plan.id,
          chainId,
          walletAddress: result.from,
          walletBrand: result.walletBrand,
          txHash: result.txHash,
          providers: result.providers,
        });
        setStatus(copy.submittedVerifying);
        await verify(result.txHash, {
          address: result.from,
          brand: result.walletBrand,
        });
      } catch (error) {
        setStatus(null);
        setShowManual(true);
        const message =
          error instanceof Error ? error.message : copy.walletFailed;
        onError(message);
        trackCryptoEvent({
          event: "crypto_sign_fail",
          planId: plan.id,
          chainId,
          walletAddress,
          walletBrand,
          error: message,
          providers,
        });
      }
    });
  }

  function handleVerifyClick() {
    onError(null);
    if (!txHash.trim()) {
      onError(copy.pasteHashFirst);
      return;
    }
    startTransition(async () => {
      setStatus(copy.verifyingOnChain);
      await verify(txHash.trim(), {
        address: walletAddress,
        brand: walletBrand,
      });
    });
  }

  async function verify(
    hash: string,
    wallet?: { address: string | null; brand: string | null },
  ) {
    trackCryptoEvent({
      event: "crypto_verify_start",
      planId: plan.id,
      chainId,
      txHash: hash,
      walletAddress: wallet?.address,
      walletBrand: wallet?.brand,
    });
    try {
      const response = await fetch("/api/crypto/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan.id,
          chainId,
          txHash: hash,
          telegramUsername: telegramUsername?.trim() || undefined,
          referralCode: referralCode?.trim() || undefined,
          walletAddress: wallet?.address || undefined,
          walletBrand: wallet?.brand || undefined,
          attribution: ensureStoredAttribution(),
        }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        redirectTo?: string;
        error?: string;
      };
      if (!response.ok || !data.redirectTo) {
        setStatus(null);
        onError(data.error ?? copy.couldNotVerify);
        trackCryptoEvent({
          event: "crypto_verify_fail",
          planId: plan.id,
          chainId,
          txHash: hash,
          walletAddress: wallet?.address,
          walletBrand: wallet?.brand,
          error: data.error ?? "verify_failed",
        });
        return;
      }
      trackCryptoEvent({
        event: "crypto_verify_success",
        planId: plan.id,
        chainId,
        txHash: hash,
        walletAddress: wallet?.address,
        walletBrand: wallet?.brand,
        amountUsdc: plan.amountUsd,
      });
      setStatus(copy.confirmedRedirecting);
      window.location.href = data.redirectTo;
    } catch {
      setStatus(null);
      onError(copy.networkVerifyError);
      trackCryptoEvent({
        event: "crypto_verify_fail",
        planId: plan.id,
        chainId,
        txHash: hash,
        walletAddress: wallet?.address,
        walletBrand: wallet?.brand,
        error: "network",
      });
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {CRYPTO_CHAIN_ORDER.map((id) => {
          const item = CRYPTO_CHAINS[id];
          const selected = chainId === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                setChainId(id);
                setShowManual(id === "solana");
                onError(null);
                trackCryptoEvent({
                  event: "crypto_chain_select",
                  planId: plan.id,
                  chainId: id,
                  walletBrand,
                  walletAddress,
                  providers,
                });
              }}
              className={`rounded-xl border px-2 py-2 text-center text-xs font-semibold transition sm:text-sm ${
                selected
                  ? "border-[#2ea3ff] bg-[#2ea3ff]/20 text-white"
                  : "border-white/10 bg-white/5 text-white/75 hover:border-white/25"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {providers.length > 0 ? (
        <p className="text-[11px] text-white/40">
          Detected: {providers.join(" · ")}
          {walletAddress
            ? ` · ${shortenAddress(walletAddress, 6, 4)}`
            : null}
        </p>
      ) : null}

      <button
        type="button"
        onClick={handleSendFromWallet}
        disabled={isPending}
        className="flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-[#0b7cff] to-[#0550c8] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_12px_40px_rgba(11,124,255,0.35)] transition hover:brightness-110 disabled:opacity-60"
      >
        {isPending
          ? copy.working
          : t(copy.payUsdcOn, {
              amount: plan.amountUsd,
              chain: chain.kind === "evm" ? chain.label : "Solana",
            })}
      </button>

      <div className="rounded-2xl border border-white/10 bg-black/25 p-3 text-xs text-white/55">
        <div className="flex items-center justify-between gap-2">
          <span>{copy.amount}</span>
          <button
            type="button"
            onClick={() => copyValue(String(plan.amountUsd), "amount")}
            className="font-semibold text-white"
          >
            {plan.amountUsd} USDC
            <span className="ml-2 font-normal text-white/40">
              {copied === "amount" ? copy.copied : copy.copy}
            </span>
          </button>
        </div>
        <div className="mt-2 flex items-start justify-between gap-2">
          <span>{copy.treasury}</span>
          <button
            type="button"
            onClick={() => copyValue(chain.recipient, "recipient")}
            className="text-right font-mono text-[11px] text-white"
          >
            {shortenAddress(chain.recipient, 8, 6)}
            <span className="ml-2 font-sans text-white/40">
              {copied === "recipient" ? copy.copied : copy.copy}
            </span>
          </button>
        </div>
        <p className="mt-2 text-[11px] text-white/35">
          {t(copy.nativeOnly, { chain: chain.label })}
        </p>
      </div>

      {!showManual ? (
        <button
          type="button"
          onClick={() => {
            setShowManual(true);
            trackCryptoEvent({
              event: "crypto_manual_open",
              planId: plan.id,
              chainId,
            });
          }}
          className="w-full text-center text-xs text-white/45 underline-offset-2 hover:text-white/70 hover:underline"
        >
          {copy.alreadyPaid}
        </button>
      ) : (
        <div className="space-y-2">
          <input
            value={txHash}
            onChange={(event) => setTxHash(event.target.value)}
            placeholder={
              chain.kind === "solana"
                ? copy.solanaPlaceholder
                : copy.evmPlaceholder
            }
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 font-mono text-xs text-white outline-none placeholder:text-white/35 focus:border-[#2ea3ff]/60"
          />
          <button
            type="button"
            onClick={handleVerifyClick}
            disabled={isPending}
            className="flex w-full items-center justify-center rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15 disabled:opacity-60"
          >
            {isPending ? copy.verifying : copy.verifyPayment}
          </button>
        </div>
      )}

      {status ? (
        <p className="text-center text-xs text-[#ffc48a]">{status}</p>
      ) : null}
    </div>
  );
}
