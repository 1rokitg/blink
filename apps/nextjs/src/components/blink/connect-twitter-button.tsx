"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useSearchParams } from "next/navigation";

import {
  type ConnectedWallet,
  usePrivy,
  useWallets,
} from "@privy-io/react-auth";
import { ArrowUpRight, Check, Loader2, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";

import { getTwitterConnection } from "~/app/actions/get-twitter-connection";
import {
  getIssueErrorCode,
  isLikelyDismissedWalletFlow,
  reportIssueEvent,
} from "~/lib/blink/issue-reporting";
import { createTwitterOwnershipMessage } from "~/lib/blink/twitter-ownership";
import { IssueReportButton } from "./issue-report-button";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TwitterConnectionData {
  twitterUsername: string;
  twitterName: string | null;
}

async function launchVerificationConfetti() {
  const { default: confetti } = await import("canvas-confetti");

  const defaults = {
    gravity: 0.95,
    scalar: 0.95,
    ticks: 220,
    zIndex: 2000,
  } as const;

  confetti({
    ...defaults,
    particleCount: 90,
    spread: 78,
    origin: { x: 0.25, y: 0.35 },
    colors: ["#38bdf8", "#60a5fa", "#22d3ee", "#ffffff"],
  });
  confetti({
    ...defaults,
    particleCount: 90,
    spread: 78,
    origin: { x: 0.75, y: 0.35 },
    colors: ["#38bdf8", "#60a5fa", "#22d3ee", "#ffffff"],
  });
}

function getCanonicalBrowserOrigin() {
  if (typeof window === "undefined") return "";

  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!configuredUrl) return window.location.origin;

  try {
    return new URL(configuredUrl).origin;
  } catch {
    return window.location.origin;
  }
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
    <span className="inline-flex items-center gap-2 rounded-full border border-[#38bdf8]/30 bg-[linear-gradient(180deg,rgba(14,28,51,0.96),rgba(9,18,34,0.96))] px-3 py-1 text-xs font-semibold text-[#a5e3ff] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <span className="flex size-5 items-center justify-center rounded-full bg-[#38bdf8]/16 text-[#7dd3fc]">
        <Check className="size-3" />
      </span>
      <svg
        className="size-3.5 shrink-0 text-[#7dd3fc]"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.736l7.73-8.835L1.254 2.25H8.08l4.263 5.634 5.9-5.634Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
      <span>{username ? `@${username}` : "Verified on X"}</span>
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
      <div className="overflow-hidden rounded-2xl border border-[#38bdf8]/25 bg-[linear-gradient(145deg,#071427,#0a1c32_58%,#0d2642)] p-4 text-left shadow-[0_18px_48px_rgba(0,0,0,0.42)]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl border border-[#38bdf8]/18 bg-[#38bdf8]/10 text-[#7dd3fc]">
              <Sparkles className="size-4" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#8ad9ff]">
                X verified
              </p>
              <p className="mt-1 text-sm font-semibold text-white">
                @{username} is now verified on Blink
              </p>
            </div>
          </div>
          <div className="flex size-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-foreground/65 transition group-hover:border-[#38bdf8]/35 group-hover:text-white">
            <ArrowUpRight className="size-4" />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-[#020817]/45 px-3 py-2 text-xs text-foreground/68">
          <svg
            className="size-3.5 shrink-0 text-[#7dd3fc]"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.736l7.73-8.835L1.254 2.25H8.08l4.263 5.634 5.9-5.634Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          Social proof unlocked for your profile and share cards.
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-white">Share verification</p>
            <p className="mt-1 text-xs text-foreground/55">
              Post it on X and let your crew know you&apos;re in.
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[#38bdf8]/30 bg-[#38bdf8]/12 px-3 py-1 text-xs font-medium text-[#9bddff]">
            <svg
              className="size-3.5 shrink-0"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.736l7.73-8.835L1.254 2.25H8.08l4.263 5.634 5.9-5.634Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            Share
          </div>
        </div>
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
  /** Wallet whose verification state should be displayed on the page. */
  targetWalletAddress?: string;
  /** Optional label when a wallet must be connected before verification can start. */
  connectWalletLabel?: string;
  /** Optional label for the verification CTA once a wallet is connected. */
  claimLabel?: string;
}

export function ConnectTwitterButton({
  showSuccessCard = true,
  className,
  targetWalletAddress,
  connectWalletLabel,
  claimLabel = "Claim Ownership",
}: ConnectTwitterButtonProps) {
  const { login, authenticated, linkWallet } = usePrivy();
  const { wallets } = useWallets();
  const wallet = wallets[0];
  const connectedWalletAddress = wallet?.address ?? "";
  const searchParams = useSearchParams();
  const connectWallet = authenticated ? linkWallet : login;
  const normalizedTargetWalletAddress =
    targetWalletAddress?.toLowerCase() ?? "";
  const normalizedConnectedWalletAddress = connectedWalletAddress.toLowerCase();
  const displayedWalletAddress =
    normalizedTargetWalletAddress || normalizedConnectedWalletAddress;
  const isClaimingOwnProfile =
    !normalizedTargetWalletAddress ||
    normalizedTargetWalletAddress === normalizedConnectedWalletAddress;

  const [connection, setConnection] = useState<TwitterConnectionData | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [justConnected, setJustConnected] = useState(false);
  const [lastIssueCode, setLastIssueCode] = useState<string | null>(null);
  const hasCelebratedRef = useRef(false);
  const reportedSearchErrorRef = useRef<string | null>(null);

  // Check DB for existing connection
  const checkConnection = useCallback(async () => {
    if (!displayedWalletAddress) {
      setConnection(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await getTwitterConnection(displayedWalletAddress);
      setConnection(data);
    } catch {
      // Non-fatal
    } finally {
      setLoading(false);
    }
  }, [displayedWalletAddress]);

  useEffect(() => {
    void checkConnection();
  }, [checkConnection]);

  // Detect post-OAuth redirect
  useEffect(() => {
    if (
      searchParams.get("twitter_connected") === "1" &&
      !hasCelebratedRef.current
    ) {
      hasCelebratedRef.current = true;
      setJustConnected(true);
      toast.success("X connected! Ownership verified on Blink.");
      void launchVerificationConfetti();
      void checkConnection();
    }
    const twitterError = searchParams.get("twitter_error");
    if (twitterError) {
      setLastIssueCode(twitterError);
      toast.error(formatTwitterError(twitterError));
      if (reportedSearchErrorRef.current !== twitterError) {
        reportedSearchErrorRef.current = twitterError;
        void reportIssueEvent({
          eventType: "issue_auto",
          category: "x-verification",
          source: "twitter-callback",
          summary: "X verification returned with an error.",
          walletAddress: displayedWalletAddress || null,
          code: twitterError,
          metadata: {
            step: "callback",
            displayedWalletAddress,
          },
        });
      }
    }
  }, [searchParams, checkConnection, displayedWalletAddress]);

  const issueMetadata = useMemo(
    () => ({
      connectedWalletAddress: normalizedConnectedWalletAddress || null,
      displayedWalletAddress: displayedWalletAddress || null,
      targetWalletAddress: normalizedTargetWalletAddress || null,
      isClaimingOwnProfile,
      ...(lastIssueCode ? { lastIssueCode } : {}),
    }),
    [
      displayedWalletAddress,
      isClaimingOwnProfile,
      lastIssueCode,
      normalizedConnectedWalletAddress,
      normalizedTargetWalletAddress,
    ],
  );

  const handleWalletConnectAction = useCallback(async () => {
    try {
      await connectWallet();
    } catch (error) {
      if (isLikelyDismissedWalletFlow(error)) {
        return;
      }

      const code = getIssueErrorCode(error);
      setLastIssueCode(code);
      toast.error("Could not log in with wallet. Please try connecting again.");
      void reportIssueEvent({
        eventType: "issue_auto",
        category: "wallet-connect",
        source: authenticated ? "link-wallet" : "privy-login",
        summary: authenticated
          ? "Wallet link failed during X verification."
          : "Wallet login failed during X verification.",
        walletAddress: displayedWalletAddress || null,
        code,
        metadata: issueMetadata,
      });
    }
  }, [authenticated, connectWallet, displayedWalletAddress, issueMetadata]);

  const handleConnect = async () => {
    if (!normalizedConnectedWalletAddress) {
      toast.error("Connect the wallet for this profile first.");
      return;
    }
    if (!wallet) {
      toast.error("Wallet provider unavailable.");
      return;
    }
    if (!isClaimingOwnProfile) {
      toast.error("Connect the matching profile wallet to claim ownership.");
      return;
    }

    const currentUrl = new URL(window.location.href);
    const canonicalOrigin = getCanonicalBrowserOrigin();

    if (canonicalOrigin && currentUrl.origin !== canonicalOrigin) {
      window.location.replace(
        `${canonicalOrigin}${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`,
      );
      return;
    }

    setClaiming(true);

    try {
      const returnTo = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
      const challengeResponse = await fetch("/api/twitter/connect/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          returnTo,
          walletAddress: normalizedConnectedWalletAddress,
        }),
      });
      const challengeData = (await challengeResponse
        .json()
        .catch(() => null)) as { nonce?: string; error?: string } | null;

      if (!challengeResponse.ok || !challengeData?.nonce) {
        throw new Error(challengeData?.error ?? "claim_session_expired");
      }

      const signature = await signTwitterOwnershipClaim({
        wallet,
        walletAddress: normalizedConnectedWalletAddress,
        nonce: challengeData.nonce,
      });

      const connectResponse = await fetch("/api/twitter/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signature,
          walletAddress: normalizedConnectedWalletAddress,
        }),
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
      const code = getIssueErrorCode(error);
      setLastIssueCode(code);
      toast.error(formatTwitterError(code));
      void reportIssueEvent({
        eventType: "issue_auto",
        category: "x-verification",
        source: "connect-twitter-button",
        summary: "X verification failed before the OAuth redirect completed.",
        walletAddress: displayedWalletAddress || null,
        code,
        metadata: {
          ...issueMetadata,
          step: "connect",
        },
      });
    } finally {
      setClaiming(false);
    }
  };

  if (loading || claiming) {
    return (
      <div
        className={`flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 ${className}`}
      >
        <Loader2 className="size-4 animate-spin text-[#7dd3fc]" />
        <span className="text-sm text-foreground/55">
          {claiming ? "Verifying wallet..." : "Checking X verification..."}
        </span>
      </div>
    );
  }

  // Already connected
  if (connection) {
    return (
      <div className={`flex flex-col gap-3 ${className}`}>
        <motion.div
          initial={justConnected ? { opacity: 0, y: 8 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28 }}
          className="overflow-hidden rounded-2xl border border-[#38bdf8]/22 bg-[linear-gradient(135deg,rgba(6,18,35,0.96),rgba(8,25,45,0.98)_65%,rgba(11,36,58,0.95))] p-4 shadow-[0_18px_44px_rgba(0,0,0,0.35)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <TwitterVerifiedBadge username={connection.twitterUsername} />
                {justConnected ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-200">
                    <Sparkles className="size-3" />
                    Just verified
                  </span>
                ) : null}
              </div>
              <p className="mt-3 text-base font-semibold text-white">
                {connection.twitterName ?? `@${connection.twitterUsername}`}
              </p>
              <p className="mt-1 text-sm text-foreground/58">
                Your Blink profile now shows verified X ownership and stronger
                social proof.
              </p>
            </div>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-[#38bdf8]/15 bg-[#38bdf8]/10 text-[#8ad9ff]">
              <Sparkles className="size-4" />
            </div>
          </div>
        </motion.div>
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
  if (!normalizedConnectedWalletAddress) {
    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => void handleWalletConnectAction()}
          className={`inline-flex items-center gap-2 rounded-xl border border-[#38bdf8]/25 bg-[#38bdf8]/8 px-4 py-2 text-sm font-medium text-[#9bddff] transition hover:border-[#38bdf8]/55 hover:bg-[#38bdf8]/14 ${className}`}
        >
          <svg
            className="size-4 shrink-0"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.736l7.73-8.835L1.254 2.25H8.08l4.263 5.634 5.9-5.634Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          {connectWalletLabel ??
            (normalizedTargetWalletAddress
              ? "Connect Wallet to Claim"
              : "Connect Wallet to Start")}
        </button>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-foreground/45">
            If the wallet modal fails, send the issue straight to internal
            tools.
          </p>
          <IssueReportButton
            category="wallet-connect"
            source="connect-twitter-button"
            walletAddress={displayedWalletAddress || null}
            defaultSummary="Wallet login failed while trying to verify with X"
            defaultDescription={
              lastIssueCode
                ? `Latest captured code: ${lastIssueCode}`
                : undefined
            }
            metadata={issueMetadata}
          />
        </div>
      </div>
    );
  }

  if (normalizedTargetWalletAddress && !isClaimingOwnProfile) {
    return (
      <div className={`flex flex-col gap-2 ${className}`}>
        <button
          type="button"
          disabled
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white/45"
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
        <p className="text-xs text-foreground/45">
          Connect the wallet that owns this profile to verify its X account.
        </p>
        <div className="flex justify-end">
          <IssueReportButton
            category="x-verification"
            source="connect-twitter-button"
            walletAddress={displayedWalletAddress || null}
            defaultSummary="Profile verification is blocked by a wallet mismatch"
            metadata={issueMetadata}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => void handleConnect()}
        className={`inline-flex items-center gap-2 rounded-xl border border-[#38bdf8]/30 bg-[linear-gradient(180deg,rgba(17,64,108,0.28),rgba(11,31,52,0.28))] px-4 py-2 text-sm font-medium text-[#a5e3ff] transition hover:border-[#38bdf8]/60 hover:bg-[linear-gradient(180deg,rgba(24,92,153,0.32),rgba(13,42,69,0.32))] ${className}`}
      >
        <svg
          className="size-4 shrink-0"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.736l7.73-8.835L1.254 2.25H8.08l4.263 5.634 5.9-5.634Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
        <Sparkles className="size-3.5 text-[#7dd3fc]" />
        {claimLabel}
      </button>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-foreground/45">
          Trouble with the verification flow? Send a report with context.
        </p>
        <IssueReportButton
          category="x-verification"
          source="connect-twitter-button"
          walletAddress={displayedWalletAddress || null}
          defaultSummary="X verification flow is failing"
          defaultDescription={
            lastIssueCode ? `Latest captured code: ${lastIssueCode}` : undefined
          }
          metadata={issueMetadata}
        />
      </div>
    </div>
  );
}
