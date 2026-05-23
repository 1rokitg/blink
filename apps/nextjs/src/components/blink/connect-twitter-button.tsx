"use client";

import { useCallback, useEffect, useState } from "react";

import { useSearchParams } from "next/navigation";

import { useWallets } from "@privy-io/react-auth";
import { AnimatePresence, motion } from "motion/react";
import { Check, ExternalLink, Loader2, Twitter } from "lucide-react";
import { toast } from "sonner";

import { getTwitterConnection } from "~/app/actions/get-twitter-connection";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TwitterConnectionData {
  twitterUsername: string;
  twitterName: string | null;
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
  const walletAddress = wallets[0]?.address ?? "";
  const searchParams = useSearchParams();

  const [connection, setConnection] = useState<TwitterConnectionData | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [justConnected, setJustConnected] = useState(false);

  // Check DB for existing connection
  const checkConnection = useCallback(async () => {
    if (!walletAddress) {
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
      toast.success("Twitter connected! You're verified on Blink.");
      void checkConnection();
    }
    if (searchParams.get("twitter_error")) {
      toast.error(
        `Twitter connection failed: ${searchParams.get("twitter_error")}`,
      );
    }
  }, [searchParams, checkConnection]);

  const handleConnect = () => {
    if (!walletAddress) {
      toast.error("Connect your wallet first.");
      return;
    }
    window.location.href = `/api/twitter/connect?wallet=${walletAddress}`;
  };

  if (loading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Loader2 className="size-4 animate-spin text-foreground/40" />
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
      onClick={handleConnect}
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
