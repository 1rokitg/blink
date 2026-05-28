"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  Plus,
  ShieldCheck,
  Wallet,
  XCircle,
} from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@acme/ui/dialog";
import { Input } from "@acme/ui/input";
import { Switch } from "@acme/ui/switch";

import {
  BUILDER_ADDRESS,
  builderMaxFeeRate,
  isBuilderApproved,
} from "~/lib/blink/builder";
import { createExchangeClient } from "~/lib/blink/hyperliquid";
import { usePersistSizePreference } from "~/lib/blink/order-entry-preferences";

import { BlinkProUpsellCard } from "./blink-pro-upsell-card";
import { ConnectTwitterButton } from "./connect-twitter-button";

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function VerificationRouteLink() {
  return (
    <Link
      href="/profile/verify"
      className="inline-flex text-xs font-medium text-[#9bddff] underline-offset-4 transition hover:text-white hover:underline"
    >
      Open the full verification page
    </Link>
  );
}

type Tab = "Account" | "Connections" | "Security" | "Preferences" | "Settings";

type ApprovalStatus =
  | "idle"
  | "checking"
  | "approved"
  | "pending"
  | "success"
  | "error";

// ── Per-wallet builder approval card ─────────────────────────────────────────
function WalletApprovalCard({
  wallet,
}: { wallet: { address: string; walletClientType: string } }) {
  const [status, setStatus] = useState<ApprovalStatus>("idle");
  const [errMsg, setErrMsg] = useState("");

  useEffect(() => {
    setStatus("checking");
    isBuilderApproved(wallet.address as `0x${string}`)
      .then((ok) => setStatus(ok ? "approved" : "idle"))
      .catch(() => setStatus("idle"));
  }, [wallet.address]);

  const handleApprove = useCallback(async () => {
    setStatus("pending");
    setErrMsg("");
    try {
      const client = await createExchangeClient(wallet as never);
      await client.approveBuilderFee({
        builder: BUILDER_ADDRESS,
        maxFeeRate: builderMaxFeeRate(),
      });
      setStatus("success");
    } catch (err: unknown) {
      setErrMsg(err instanceof Error ? err.message : "Approval failed");
      setStatus("error");
    }
  }, [wallet]);

  const label =
    wallet.walletClientType === "privy"
      ? "Embedded wallet"
      : wallet.walletClientType === "metamask"
        ? "MetaMask"
        : wallet.walletClientType === "coinbase_wallet"
          ? "Coinbase Wallet"
          : wallet.walletClientType;

  return (
    <div className="rounded-[12px] border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-full bg-white/[0.06]">
            <Wallet className="size-4 text-white/60" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">{label}</p>
            <p className="font-mono text-xs text-foreground/45">
              {truncateAddress(wallet.address)}
            </p>
          </div>
        </div>

        {status === "checking" && (
          <Loader2 className="mt-1 size-4 animate-spin text-white/40" />
        )}
        {(status === "approved" || status === "success") && (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs text-emerald-300">
            <CheckCircle2 className="size-3" />
            Approved
          </span>
        )}
        {(status === "idle" || status === "error") && (
          <button
            type="button"
            onClick={() => void handleApprove()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#2c6bff] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#2c6bff]/90"
          >
            <ShieldCheck className="size-3" />
            Approve builder
          </button>
        )}
        {status === "pending" && (
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#2c6bff]/50 px-3 py-1.5 text-xs font-semibold text-white/60"
          >
            <Loader2 className="size-3 animate-spin" />
            Signing…
          </button>
        )}
      </div>
      {status === "error" && errMsg && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-rose-300">
          <XCircle className="size-3 shrink-0" />
          {errMsg}
        </p>
      )}
      <p className="mt-2 text-xs text-foreground/40">
        One-time on-chain approval lets Blink route your orders through
        Hyperliquid builder codes.
      </p>
    </div>
  );
}

// ── Connections tab ───────────────────────────────────────────────────────────
function ConnectionsTab() {
  const { linkWallet, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const [linking, setLinking] = useState(false);

  const handleLinkWallet = useCallback(async () => {
    if (!authenticated) return;
    setLinking(true);
    try {
      await linkWallet();
    } catch {
      // user dismissed
    } finally {
      setLinking(false);
    }
  }, [authenticated, linkWallet]);

  return (
    <div>
      <DialogTitle className="text-2xl font-semibold text-white">
        Connections
      </DialogTitle>
      <p className="mt-1 text-sm text-foreground/50">
        Manage wallets connected to your Blink account.
      </p>

      {/* Import existing HL account card */}
      <div className="mt-5 rounded-[14px] border border-[#2c6bff50] bg-[radial-gradient(ellipse_at_top_left,rgba(44,107,255,0.10),transparent_60%)] p-5">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-[#2c6bff]/20">
            <ExternalLink className="size-5 text-[#6fa8ff]" />
          </div>
          <div>
            <p className="font-semibold text-white">
              Import Hyperliquid Account
            </p>
            <p className="text-sm text-foreground/50">
              Already trading on Hyperliquid? Link your existing wallet to Blink
              in 2 signatures.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void handleLinkWallet()}
          disabled={linking}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#2c6bff] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2c6bff]/90 disabled:opacity-50"
        >
          {linking ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          {linking ? "Connecting…" : "Connect external wallet"}
        </button>
        <p className="mt-3 text-xs text-foreground/35">
          Sig 1: Privy wallet link · Sig 2: Blink builder code approval on
          Hyperliquid L1
        </p>
      </div>

      <div className="mt-5">
        <BlinkProUpsellCard
          ctaHref="/pro"
          ctaLabel="See Pro desk layer"
          description="Free gets you connected. Pro is where Blink starts feeling like a proper desk: sharper routing economics, stronger public profile status, and cleaner multi-wallet ops."
          eyebrow="Desk upgrade"
          perks={[
            "Lower builder fees on active trading",
            "Premium profile polish and status surfaces",
            "Future multi-wallet and workflow upgrades",
          ]}
          title="Going beyond one basic setup?"
        />
      </div>

      {/* Connected wallets */}
      {wallets.length > 0 && (
        <div className="mt-5">
          <p className="mb-3 text-xs uppercase tracking-[0.14em] text-foreground/45">
            Connected wallets ({wallets.length})
          </p>
          <div className="space-y-3">
            {wallets.map((w) => (
              <WalletApprovalCard key={w.address} wallet={w} />
            ))}
          </div>
        </div>
      )}

      {/* Twitter */}
      <div className="mt-5 rounded-[12px] border border-white/10 bg-white/[0.03] p-4">
        <p className="font-medium text-white">X / Twitter</p>
        <p className="mt-1 text-sm text-foreground/58">
          Verify ownership to unlock your verified badge and social proof on
          Blink.
        </p>
        <div className="mt-3">
          <ConnectTwitterButton showSuccessCard={false} />
        </div>
        <div className="mt-2">
          <VerificationRouteLink />
        </div>
      </div>
    </div>
  );
}

function PreferencesTab() {
  const { persistSize, setPersistSize } = usePersistSizePreference();

  return (
    <div>
      <DialogTitle className="text-2xl font-semibold text-white">
        Preferences
      </DialogTitle>
      <p className="mt-1 text-sm text-foreground/50">
        Keep order-entry behavior consistent everywhere in Blink.
      </p>

      <div className="mt-5 rounded-[14px] border border-white/10 bg-white/[0.03] p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-medium text-white">Persist order size</p>
            <p className="mt-1 text-sm text-foreground/58">
              On by default — keeps your size and unit mode across markets,
              refreshes, and after market fills.
            </p>
            <p className="mt-3 text-xs text-foreground/40">
              Click a price in the book to prefill limit price. Click a size to
              prefill size. When this is on, that size draft follows you around
              Blink.
            </p>
          </div>
          <Switch
            checked={persistSize}
            onCheckedChange={setPersistSize}
            aria-label="Persist order size"
          />
        </div>
      </div>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────
export function AccountManagementModal(props: {
  open: boolean;
  onClose: () => void;
  walletAddress: string;
  /** Open directly to a specific tab */
  initialTab?: Tab;
}) {
  const { user } = usePrivy();
  const [activeTab, setActiveTab] = useState<Tab>(
    props.initialTab ?? "Account",
  );
  const proStatusQuery = useQuery({
    queryKey: ["blink-pro-status", props.walletAddress],
    queryFn: async () => {
      const response = await fetch(
        `/api/builder/fee?wallet=${props.walletAddress}`,
      );
      if (!response.ok) throw new Error("Failed to load Pro status");
      return response.json() as Promise<{ feeUnits: number; isPro: boolean }>;
    },
    enabled: Boolean(props.walletAddress),
    staleTime: 60_000,
  });
  const referralLookupQuery = useQuery({
    queryKey: ["blink-account-referral-code", props.walletAddress],
    queryFn: async () => {
      const response = await fetch(
        `/api/referrals/lookup?address=${props.walletAddress}`,
      );
      if (!response.ok) {
        throw new Error("Failed to load Blink handle");
      }

      return response.json() as Promise<{ referralCode: string | null }>;
    },
    enabled: props.open && Boolean(props.walletAddress),
    staleTime: 60_000,
  });
  const short = truncateAddress(props.walletAddress);
  const avatarUrl = `https://avatar.vercel.sh/${props.walletAddress}.png?size=96`;
  const fallbackHandle =
    user?.twitter?.username?.trim() ??
    user?.google?.email?.split("@")[0] ??
    user?.email?.address?.split("@")[0] ??
    short;
  const profileSlug =
    referralLookupQuery.data?.referralCode?.trim() || fallbackHandle;
  const publicProfilePath = `/profile/${encodeURIComponent(profileSlug)}`;
  const publicProfileUrl = `blink.lat${publicProfilePath}`;
  const displayName =
    user?.google?.name?.trim() ??
    user?.twitter?.username?.trim() ??
    profileSlug;

  // Reset tab when modal opens
  useEffect(() => {
    if (props.open) setActiveTab(props.initialTab ?? "Account");
  }, [props.open, props.initialTab]);

  const tabs: Tab[] = [
    "Account",
    "Connections",
    "Security",
    "Preferences",
    "Settings",
  ];

  return (
    <Dialog open={props.open} onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent className="max-h-[86vh] overflow-hidden border-[#8fc4ff54] bg-[#0c1119f2] p-0 sm:max-w-[980px]">
        <div className="grid h-full grid-cols-[220px_1fr]">
          <aside className="border-r border-white/10 p-4">
            <p className="mb-4 text-lg font-semibold text-white">Account</p>
            <div className="space-y-1 text-sm">
              {tabs.map((item) => (
                <button
                  type="button"
                  key={item}
                  onClick={() => setActiveTab(item)}
                  className={`w-full rounded-[10px] px-3 py-2 text-left transition ${
                    activeTab === item
                      ? "bg-white/10 text-white"
                      : "text-foreground/60 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </aside>

          <section className="overflow-y-auto p-6">
            {activeTab === "Connections" ? (
              <ConnectionsTab />
            ) : activeTab === "Preferences" ? (
              <PreferencesTab />
            ) : (
              <>
                <DialogTitle className="text-2xl font-semibold text-white">
                  Account
                </DialogTitle>
                <div className="mt-5 flex items-center gap-4 border-b border-white/10 pb-5">
                  <img
                    src={avatarUrl}
                    alt="User avatar"
                    className="size-16 rounded-full border border-white/20"
                  />
                  <div>
                    <p className="text-2xl font-semibold text-white">
                      {displayName}
                    </p>
                    <p className="text-sm text-foreground/55">Wallet {short}</p>
                  </div>
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="mb-2 text-xs uppercase tracking-[0.14em] text-foreground/45">
                      Public handle
                    </p>
                    <Input
                      value={profileSlug}
                      readOnly
                      className="h-10 border-white/15 bg-white/[0.04]"
                    />
                    <p className="mt-2 text-xs text-foreground/40">
                      {referralLookupQuery.data?.referralCode
                        ? "This is the live Blink handle tied to your wallet."
                        : "You do not have a custom Blink handle yet, so Blink falls back to your connected identity."}
                    </p>
                  </div>
                  <div>
                    <p className="mb-2 text-xs uppercase tracking-[0.14em] text-foreground/45">
                      Public profile
                    </p>
                    <Input
                      value={publicProfileUrl}
                      readOnly
                      className="h-10 border-white/15 bg-white/[0.04]"
                    />
                    <div className="mt-2 flex items-center gap-3">
                      <Link
                        href={publicProfilePath}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#9bddff] underline-offset-4 transition hover:text-white hover:underline"
                      >
                        Open profile
                        <ExternalLink className="size-3" />
                      </Link>
                    </div>
                  </div>
                </div>
                <div className="mt-4 rounded-[12px] border border-[#8fbaff26] bg-[#8fbaff0a] p-4">
                  <p className="font-medium text-white">Identity note</p>
                  <p className="mt-1 text-sm text-foreground/58">
                    Your public Blink profile slug currently comes from your
                    claimed referral code or connected identity. The self-serve
                    rename flow is not live in this modal yet, so we only show
                    the real active handle here.
                  </p>
                </div>
                <div className="mt-6 rounded-[12px] border border-white/10 bg-white/[0.03] p-4">
                  <p className="font-medium text-white">Portfolio Visibility</p>
                  <p className="mt-1 text-sm text-foreground/58">
                    Share your read-only stats with a public profile link.
                  </p>
                  <div className="mt-3 inline-flex items-center gap-2 rounded-[10px] border border-[#38d7a46a] bg-[#18392e] px-3 py-2 text-sm text-[#98f0d2]">
                    Enabled
                  </div>
                </div>
                <div className="mt-4 rounded-[12px] border border-white/10 bg-white/[0.03] p-4">
                  <p className="font-medium text-white">
                    X / Twitter verification
                  </p>
                  <p className="mt-1 text-sm text-foreground/58">
                    Verify account ownership to unlock your verified badge and
                    social proof on Blink.
                  </p>
                  <div className="mt-3">
                    <ConnectTwitterButton showSuccessCard={false} />
                  </div>
                  <div className="mt-2">
                    <VerificationRouteLink />
                  </div>
                </div>
                <div className="mt-4">
                  <BlinkProUpsellCard
                    ctaHref="/pro"
                    ctaLabel={
                      proStatusQuery.data?.isPro
                        ? "View Blink Pro"
                        : "Upgrade to Pro"
                    }
                    description={
                      proStatusQuery.data?.isPro
                        ? "Your account already gets the Pro routing tier. Keep using this profile surface as the social layer around your trading identity."
                        : "Blink Pro sharpens the identity layer around your trading: lower fees, stronger profile status, and more convincing public surfaces when you share your account."
                    }
                    eyebrow="Account status"
                    isPro={proStatusQuery.data?.isPro}
                    perks={
                      proStatusQuery.data?.isPro
                        ? undefined
                        : [
                            "Lower builder fees on eligible volume",
                            "Premium profile polish and status treatments",
                            "Stronger social-proof surfaces across Blink",
                          ]
                    }
                    title={
                      proStatusQuery.data?.isPro
                        ? "Blink Pro is active on this wallet."
                        : "Turn this account into a stronger Blink identity."
                    }
                  />
                </div>
                <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4">
                  <button
                    type="button"
                    className="whop-secondary-btn text-rose-200"
                  >
                    Delete account
                  </button>
                  <button
                    type="button"
                    className="whop-blue-btn"
                    onClick={props.onClose}
                  >
                    Done
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
