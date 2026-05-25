"use client";

import { useCallback, useEffect, useState } from "react";

import { useSearchParams } from "next/navigation";

import { type ConnectedWallet, useWallets } from "@privy-io/react-auth";
import { Check, ExternalLink, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";

import { getTwitterConnection } from "~/app/actions/get-twitter-connection";
import { createTwitterOwnershipMessage } from "~/lib/blink/twitter-ownership";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TwitterConnectionData {
  twitterUsername: string;
  twitterName: string | null;
}

function formatTwitterError(errorCode?: string | null) {
  switch (errorCode) {
    case "claim_session_expired":
    case "session_expired":
      return "Your X claim session expired. Please try again.";
    case "invalid_signature":
    case "wallet_verification_failed":
      return "Wallet verification failed. Please sign the Blink claim message again.";
    case "signature_failed":
      return "Wallet signature was canceled or could not be completed.";
    case "twitter_account_already_claimed":
      return "That X account is already claimed by another wallet.";
    case "twitter_client_not_configured":
      return "X app credentials are not configured yet.";
    case "claim_wallet_mismatch":
      return "The signed wallet does not match the wallet you are trying to verify.";
    case "invalid_state":
      return "The X callback could not be verified. Please try again.";
    case "access_denied":
      return "The X authorization request was denied.";
    case "token_exchange_failed":
    case "user_fetch_failed":
      return "Blink could not complete the X verification handshake.";
    default:
      return errorCode
        ? `X connection failed: ${errorCode}`
        : "X connection failed.";
  }
}

async function signTwitterOwnershipClaim(params: {
  wallet: ConnectedWallet;
  walletAddress: string;
  nonce: string;
}) {
  const provider = await params.wallet.getEthereumProvider();
  const accounts = (await provider.request({
    method: "eth_accounts",
  })) as string[];
  const fromCandidates = Array.from(
    new Set([params.wallet.address, accounts[0]].filter(Boolean)),
  );
  const message = createTwitterOwnershipMessage({
    walletAddress: params.walletAddress,
    nonce: params.nonce,
  });

  for (const from of fromCandidates) {
    try {
      const signature = await provider.request({
        method: "personal_sign",
        params: [message, from],
      });
      return signature as string;
    } catch {
      // Try the next candidate address if the wallet is case-sensitive.
    }
  }

  throw new Error("signature_failed");
}

// ── Verified badge (standalone, exportable) ───────────────────────────────────

export function TwitterVerifiedBadge({ username }: { username?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#1d9bf0]/30 bg-[#1d9bf0]/10 px-2.5 py-0.5 text-xs font-medium text-[#7ecfff]">
      {/* Twitter/X bird-ish checkmark mark */}
      <svg
        className="size-3.5 shrink-0"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.736l7.73-8.835L1.254 2.25H8.08l4.263 5.634 5.9-5.634Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
      {username ? `@${username}` : "Verified"}
      <Check className="size-3 text-[#7ecfff]" />
    </span>
  );
}

// ── Verified tweet share card ─────────────────────────────────────────────────

export function VerifiedTweetCard({ username }: { username: string }) {
  const shareText = `Just got verified on Blink — the fastest way to trade Hyperliquid perps. @${username} is locked in. 👁️`;
  const shareUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent("https://blink.lat")}`;

  return (
    <motion.a
      href={shareUrl}
      target="_blank"
      rel="noreferrer"
      whileHover={{ rotateX: 6, rotateY: -6, y: -3 }}
      transition={{ type: "spring", stiffness: 280, damping: 20 }}
      className="group block w-full [transform-style:preserve-3d]"
    >
      <div className="rounded-2xl border border-[#1d9bf030] bg-[linear-gradient(145deg,#061525,#091e35)] p-4 text-left shadow-[0_16px_40px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* X / Twitter logo */}
            <svg
              className="size-4 shrink-0 text-[#1d9bf0]"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.736l7.73-8.835L1.254 2.25H8.08l4.263 5.634 5.9-5.634Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            <p className="text-xs uppercase tracking-[0.16em] text-[#7ecfff]">
              Share verification
            </p>
          </div>
          <ExternalLink className="size-4 text-foreground/60 transition group-hover:text-white" />
        </div>
        <p className="mt-2 text-sm font-medium text-white">
          Just got verified on Blink.
        </p>
        <p className="mt-1 text-xs text-foreground/55">
          Post to X and let your crew know you're in.
        </p>
      </div>
    </motion.a>
  );
}

// ── ConnectTwitterButton ──────────────────────────────────────────────────────

interface ConnectTwitterButtonProps {
  /** Show full success card (with tweet share) inline after connecting. */
  showSuccessCard?: boolean;
  /** Extra class on the button itself. */
  className?: string;
}

export function ConnectTwitterButton({
  showSuccessCard = true,
  className,
}: ConnectTwitterButtonProps) {
  const { wallets } = useWallets();
  const wallet = wallets[0];
  const walletAddress = wallet?.address ?? "";
  const searchParams = useSearchParams();

  const [connection, setConnection] = useState<TwitterConnectionData | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [justConnected, setJustConnected] = useState(false);

  // Check DB for existing connection
  const checkConnection = useCallback(async () => {
    if (!walletAddress) {
      setConnection(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await getTwitterConnection(walletAddress);
      setConnection(data);
    } catch {
      // Non-fatal
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    void checkConnection();
  }, [checkConnection]);

  // Detect post-OAuth redirect
  useEffect(() => {
    if (searchParams.get("twitter_connected") === "1") {
      setJustConnected(true);
      toast.success("X connected! Ownership verified on Blink.");
      void checkConnection();
    }
    if (searchParams.get("twitter_error")) {
      toast.error(formatTwitterError(searchParams.get("twitter_error")));
    }
  }, [searchParams, checkConnection]);

  const handleConnect = async () => {
    if (!walletAddress) {
      toast.error("Connect your wallet first.");
      return;
    }
    if (!wallet) {
      toast.error("Wallet provider unavailable.");
      return;
    }

    setClaiming(true);

    try {
      const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      const challengeResponse = await fetch("/api/twitter/connect/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnTo, walletAddress }),
      });
      const challengeData = (await challengeResponse
        .json()
        .catch(() => null)) as { nonce?: string; error?: string } | null;

      if (!challengeResponse.ok || !challengeData?.nonce) {
        throw new Error(challengeData?.error ?? "claim_session_expired");
      }

      const signature = await signTwitterOwnershipClaim({
        wallet,
        walletAddress,
        nonce: challengeData.nonce,
      });

      const connectResponse = await fetch("/api/twitter/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature, walletAddress }),
      });
      const connectData = (await connectResponse.json().catch(() => null)) as {
        authorizeUrl?: string;
        error?: string;
      } | null;

      if (!connectResponse.ok || !connectData?.authorizeUrl) {
        throw new Error(connectData?.error ?? "token_exchange_failed");
      }

      window.location.href = connectData.authorizeUrl;
    } catch (error) {
      const message = error instanceof Error ? error.message : undefined;
      toast.error(formatTwitterError(message));
    } finally {
      setClaiming(false);
    }
  };

  if (loading || claiming) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Loader2 className="size-4 animate-spin text-foreground/40" />
        {claiming ? (
          <span className="text-sm text-foreground/55">Verifying wallet…</span>
        ) : null}
      </div>
    );
  }

  // Already connected
  if (connection) {
    return (
      <div className={`flex flex-col gap-3 ${className}`}>
        <TwitterVerifiedBadge username={connection.twitterUsername} />
        {(justConnected || showSuccessCard) && (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              <VerifiedTweetCard username={connection.twitterUsername} />
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    );
  }

  // Not connected
  return (
    <button
      type="button"
      onClick={() => void handleConnect()}
      className={`inline-flex items-center gap-2 rounded-xl border border-[#1d9bf0]/30 bg-[#1d9bf0]/10 px-4 py-2 text-sm font-medium text-[#7ecfff] transition hover:border-[#1d9bf0]/60 hover:bg-[#1d9bf0]/20 ${className}`}
    >
      <svg
        className="size-4 shrink-0"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.736l7.73-8.835L1.254 2.25H8.08l4.263 5.634 5.9-5.634Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
      Claim Ownership
    </button>
  );
}
