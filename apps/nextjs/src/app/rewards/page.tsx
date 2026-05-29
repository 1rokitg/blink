"use client";

import { useState } from "react";

import Link from "next/link";

import { useWallets } from "@privy-io/react-auth";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  Copy,
  Gift,
  Loader2,
  Share2,
  Sparkles,
  Twitter,
  Users,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";

import { BlinkProUpsellCard } from "~/components/blink/blink-pro-upsell-card";
import {
  getGrowthReferralMultiplier,
  isGrowthModeEnabled,
} from "~/lib/blink/growth-mode";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function avatarUrl(seed: string) {
  return `https://avatar.vercel.sh/${encodeURIComponent(seed)}.png?size=80`;
}

function timeAgo(date: string | Date) {
  const ms = Date.now() - new Date(date).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function pct(value: number) {
  return `${value.toFixed(1)}%`;
}

// ─── Copy row ─────────────────────────────────────────────────────────────────

function CopyRow({
  label,
  value,
  display,
}: { label: string; value: string; display?: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    void navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  return (
    <div className="flex items-center justify-between gap-3 rounded-[12px] border border-white/[0.07] bg-white/[0.03] px-4 py-3">
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-[0.13em] text-white/35">
          {label}
        </p>
        <p className="mt-0.5 truncate font-mono text-sm font-semibold text-[#6fa8ff]">
          {display ?? value}
        </p>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className="flex shrink-0 items-center gap-1.5 rounded-[8px] border border-white/[0.08] px-3 py-1.5 text-xs font-medium text-white/50 transition hover:bg-white/[0.07] hover:text-white"
      >
        {copied ? (
          <Check className="size-3.5 text-emerald-400" />
        ) : (
          <Copy className="size-3.5" />
        )}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

// ─── Claim CTA (ROK-24) ───────────────────────────────────────────────────────

function RewardsClaimButton(props: { onClaim: () => void }) {
  const [glowAt, setGlowAt] = useState<number | null>(null);

  const handleClick = () => {
    setGlowAt(Date.now());
    props.onClaim();
    window.setTimeout(() => setGlowAt(null), 2_000);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="group relative mt-4 w-full overflow-hidden rounded-[16px] border border-[#8fbaff52] bg-[linear-gradient(180deg,rgba(60,118,255,0.96),rgba(36,87,219,0.98))] px-4 py-3 text-left shadow-[0_18px_44px_rgba(37,90,224,0.28)] transition hover:scale-[1.01] hover:border-[#b5d2ff88] hover:shadow-[0_22px_56px_rgba(37,90,224,0.38)] active:scale-[0.99]"
    >
      <AnimatePresence>
        {glowAt ? (
          <motion.span
            key={glowAt}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28 }}
            className="pointer-events-none absolute inset-0 rounded-[16px]"
            style={{
              boxShadow:
                "inset 0 0 0 1px rgba(255,255,255,0.45), inset 0 0 52px rgba(255,255,255,0.16), 0 0 40px rgba(126,169,255,0.32)",
            }}
          />
        ) : null}
      </AnimatePresence>
      <span className="pointer-events-none absolute inset-x-8 -top-5 h-12 rounded-full bg-white/20 blur-2xl transition group-hover:bg-white/25" />
      <span className="pointer-events-none absolute inset-px rounded-[15px] border border-white/10" />
      <span className="relative flex items-center justify-between gap-3">
        <span>
          <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
            Early payout access
          </span>
          <span className="mt-1 block text-sm font-semibold text-white">
            Request claim
          </span>
        </span>
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-white/12 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]">
          <ArrowUpRight className="size-4 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </span>
      </span>
    </button>
  );
}

// ─── Referred trader row ──────────────────────────────────────────────────────

function ReferredRow({
  address,
  joinedAt,
}: { address: string; joinedAt: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[12px] border border-white/[0.06] bg-white/[0.02] px-4 py-3">
      <img
        src={avatarUrl(address)}
        alt={address}
        width={36}
        height={36}
        className="size-9 shrink-0 rounded-full ring-1 ring-white/10"
      />
      <div className="min-w-0 flex-1">
        <p className="font-mono text-sm font-semibold text-white">
          {truncateAddress(address)}
        </p>
        <p className="text-[11px] text-white/35">Joined {timeAgo(joinedAt)}</p>
      </div>
      <Link
        href={`/profile/${address}`}
        className="flex items-center gap-1 rounded-[8px] border border-white/[0.08] px-3 py-1.5 text-xs font-medium text-white/45 transition hover:bg-white/[0.07] hover:text-white"
      >
        View <ArrowUpRight className="size-3" />
      </Link>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RewardsPage() {
  const { wallets } = useWallets();
  const address = wallets[0]?.address;
  const growthMode = isGrowthModeEnabled();
  const referralMultiplier = growthMode ? getGrowthReferralMultiplier() : 1;

  function handleClaimRequest() {
    toast.success("Requested Claim");
  }

  // Fetch or create referral code for this wallet
  const codeQuery = useQuery({
    queryKey: ["referral-code", address],
    queryFn: async () => {
      if (!address) return null;
      // Upsert code on load
      const res = await fetch("/api/referrals/code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: address }),
      });
      return res.json() as Promise<{ code: string; created: boolean }>;
    },
    enabled: !!address,
    staleTime: Number.POSITIVE_INFINITY,
  });

  // Fetch referral stats
  const statsQuery = useQuery({
    queryKey: ["referral-stats", address],
    queryFn: async () => {
      if (!address) return null;
      const res = await fetch(`/api/referrals?address=${address}`);
      return res.json() as Promise<{
        code: string | null;
        referrals: { address: string; joinedAt: string }[];
        count: number;
      }>;
    },
    enabled: !!address,
    refetchInterval: 30_000,
  });

  const code = codeQuery.data?.code ?? statsQuery.data?.code;
  const referralLink = code ? `https://blink.lat/r/${code}` : null;
  const referrals = statsQuery.data?.referrals ?? [];
  const count = statsQuery.data?.count ?? 0;

  const affiliateQuery = useQuery({
    queryKey: ["affiliate-rewards", address],
    queryFn: async () => {
      if (!address) return null;
      const res = await fetch(`/api/affiliates/me?address=${address}`);
      if (!res.ok) return null;
      return res.json() as Promise<{
        isAffiliate: true;
        profile: {
          name: string;
          xHandle: string;
          xUrl: string;
          boostedCode: string;
          boostLabel: string;
        };
        code: string;
        metrics: {
          referrals: number;
          builderApproved: number;
          firstTrade: number;
          proStarted: number;
          signupToApprovalPct: number;
          approvalToTradePct: number;
          signupToTradePct: number;
          tradeToProPct: number;
        };
      }>;
    },
    enabled: !!address,
    refetchInterval: 60_000,
  });

  const proStatusQuery = useQuery({
    queryKey: ["blink-pro-status", address],
    queryFn: async () => {
      if (!address) return null;
      const response = await fetch(`/api/builder/fee?wallet=${address}`);
      if (!response.ok) throw new Error("Failed to load Pro status");
      return response.json() as Promise<{ feeUnits: number; isPro: boolean }>;
    },
    enabled: !!address,
    staleTime: 60_000,
  });

  const twitterText = referralLink
    ? `Just started trading on @blink_perps — fastest way to trade perps on Hyperliquid, zero maker fees 🔥\n\nJoin via my link: ${referralLink}`
    : "";

  return (
    <main className="min-h-screen bg-[#060510] px-4 pb-16 pt-6 text-[#f2f4f7]">
      {/* Radial ambient */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(44,107,255,0.10), transparent 65%), radial-gradient(ellipse 50% 35% at 85% 85%, rgba(59,225,186,0.05), transparent 55%)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-[920px]">
        {/* ── Top nav ──────────────────────────────────────────────────────── */}
        <div className="mb-10 flex items-center justify-between">
          <Link
            href="/trade/BTC"
            className="text-3xl font-bold tracking-[-0.04em] text-white"
          >
            blink
          </Link>
          <div className="flex items-center gap-1">
            {[
              { href: "/trade/BTC", label: "Trade" },
              {
                href: code ? `/profile/${code}` : `/profile/${address ?? ""}`,
                label: "Profile",
              },
              { href: "/rewards", label: "Rewards", active: true },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-[10px] px-3 py-2 text-sm font-medium transition ${
                  item.active
                    ? "bg-white/[0.08] text-white"
                    : "text-white/45 hover:text-white/75"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <div className="mb-10 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#2c6bff]/30 bg-[#2c6bff]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#6fa8ff]">
            <Gift className="size-3" />
            Referral program
          </div>
          <h1 className="text-[3.5rem] font-bold leading-none tracking-[-0.04em] text-white">
            Refer traders.
            <br />
            <span className="text-[#6fa8ff]">Build your network.</span>
          </h1>
          <p className="mt-4 text-base text-white/40">
            Every trader you bring to Blink makes the ecosystem stronger. Share
            your link, grow your circle.
          </p>
          {growthMode ? (
            <p className="mt-3 text-sm font-medium text-[#fee38a]">
              Growth mode active: {referralMultiplier}x referral rewards are
              boosted right now.
            </p>
          ) : null}
        </div>

        {/* ── Not connected guard ───────────────────────────────────────────── */}
        {!address ? (
          <div className="flex flex-col items-center gap-4 rounded-[24px] border border-white/[0.08] bg-[#080d1a] px-8 py-14 text-center">
            <Sparkles className="size-10 text-white/20" />
            <p className="text-lg font-semibold text-white">
              Connect your wallet to continue
            </p>
            <p className="text-sm text-white/40">
              Your referral code and stats will appear here.
            </p>
            <Link
              href="/trade/BTC"
              className="mt-2 inline-flex items-center gap-2 rounded-[12px] bg-[#2c6bff] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#2c6bff]/85"
            >
              Go to trading <ChevronRight className="size-4" />
            </Link>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-[1fr_340px]">
            {/* ── Left: referral link + list ──────────────────────────────── */}
            <div className="space-y-4">
              {/* Stats bar */}
              <div className="grid grid-cols-2 gap-3">
                {/* Slots used */}
                <div className="relative overflow-hidden rounded-[16px] border border-white/[0.08] bg-[#080d1a] p-5">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-white/35">
                    Slots used
                  </p>
                  <p className="mt-1.5 text-4xl font-bold tabular-nums text-white">
                    {statsQuery.isLoading ? "—" : `${count}/10`}
                  </p>
                  {/* progress bar */}
                  <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min((count / 10) * 100, 100)}%`,
                        background:
                          count >= 10
                            ? "#f87171"
                            : count >= 7
                              ? "#fbbf24"
                              : "#3be1ba",
                      }}
                    />
                  </div>
                  {count >= 10 && (
                    <p className="mt-1.5 text-[10px] font-semibold text-rose-400">
                      Limit reached
                    </p>
                  )}
                </div>
                <div className="rounded-[16px] border border-white/[0.08] bg-[#080d1a] p-5">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-white/35">
                    Your code
                  </p>
                  <p className="mt-1.5 truncate font-mono text-2xl font-bold text-[#6fa8ff]">
                    {codeQuery.isLoading ? (
                      <Loader2 className="mt-1 size-5 animate-spin text-white/30" />
                    ) : (
                      (code ?? "—")
                    )}
                  </p>
                </div>
              </div>

              {/* Referral link section */}
              <div className="overflow-hidden rounded-[20px] border border-white/[0.08] bg-[#080d1a]">
                <div className="border-b border-white/[0.06] px-5 py-4">
                  <div className="flex items-center gap-2">
                    <Share2 className="size-4 text-white/40" />
                    <h2 className="text-sm font-semibold text-white">
                      Your referral link
                    </h2>
                  </div>
                </div>
                <div className="space-y-2.5 p-5">
                  {referralLink ? (
                    <>
                      <CopyRow label="Full link" value={referralLink} />
                      {code && <CopyRow label="Code only" value={code} />}

                      {/* Share actions */}
                      <div className="flex gap-2 pt-1">
                        <a
                          href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(twitterText)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex flex-1 items-center justify-center gap-2 rounded-[12px] bg-black py-3 text-sm font-semibold text-white transition hover:bg-black/70"
                        >
                          <Twitter className="size-4" />
                          Share on X
                        </a>
                        <button
                          type="button"
                          onClick={() =>
                            void navigator.clipboard.writeText(referralLink)
                          }
                          className="flex flex-1 items-center justify-center gap-2 rounded-[12px] border border-white/[0.08] bg-white/[0.04] py-3 text-sm font-semibold text-white/65 transition hover:bg-white/[0.09] hover:text-white"
                        >
                          <Copy className="size-4" />
                          Copy link
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="size-5 animate-spin text-white/30" />
                    </div>
                  )}
                </div>
              </div>

              {/* Referred traders list */}
              <div className="overflow-hidden rounded-[20px] border border-white/[0.08] bg-[#080d1a]">
                <div className="border-b border-white/[0.06] px-5 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="size-4 text-white/40" />
                      <h2 className="text-sm font-semibold text-white">
                        Traders you referred
                      </h2>
                    </div>
                    {count > 0 && (
                      <span className="rounded-full bg-[#2c6bff]/15 px-2.5 py-0.5 text-xs font-semibold text-[#6fa8ff]">
                        {count}
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-5">
                  {statsQuery.isLoading ? (
                    <div className="flex justify-center py-10">
                      <Loader2 className="size-5 animate-spin text-white/25" />
                    </div>
                  ) : referrals.length === 0 ? (
                    <div className="flex flex-col items-center py-12 text-center">
                      <Users className="mb-3 size-10 text-white/10" />
                      <p className="text-sm font-semibold text-white/40">
                        No referrals yet
                      </p>
                      <p className="mt-1 text-xs text-white/25">
                        Share your link above to get started.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {referrals.map((r) => (
                        <ReferredRow
                          key={r.address}
                          address={r.address}
                          joinedAt={r.joinedAt}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Right: how it works ─────────────────────────────────────── */}
            <div className="space-y-4">
              <BlinkProUpsellCard
                ctaHref="/pro"
                ctaLabel={
                  proStatusQuery.data?.isPro
                    ? "Manage membership"
                    : "Upgrade to Pro"
                }
                description={
                  proStatusQuery.data?.isPro
                    ? "Your account already gets the lower-fee routing path. Use rewards as the social proof layer that turns referrals into stronger conversion."
                    : "Blink Pro makes your public trader surface look sharper and gives your referred flow more gravity with better routing, cleaner status, and future premium analytics."
                }
                eyebrow="Referral edge"
                isPro={proStatusQuery.data?.isPro}
                perks={
                  proStatusQuery.data?.isPro
                    ? undefined
                    : [
                        "Lower builder fees once referred traders become active",
                        "Premium profile polish and status-driven social proof",
                        "Better rewards visibility and future conversion analytics",
                      ]
                }
                title={
                  proStatusQuery.data?.isPro
                    ? "Blink Pro is already working for your account."
                    : "Turn rewards into a stronger Pro conversion loop."
                }
              />

              {affiliateQuery.data?.isAffiliate ? (
                <div className="overflow-hidden rounded-[20px] border border-emerald-400/30 bg-[linear-gradient(180deg,rgba(13,34,25,0.9),rgba(9,24,32,0.9))]">
                  <div className="border-b border-emerald-400/20 px-5 py-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-300/85">
                      Affiliate Performance
                    </p>
                    <p className="mt-1 text-sm text-white/70">
                      Code locked:{" "}
                      <span className="font-mono text-white">
                        {affiliateQuery.data.code}
                      </span>
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 p-4">
                    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
                      <p className="text-[10px] uppercase tracking-[0.13em] text-white/35">
                        Referrals
                      </p>
                      <p className="mt-1 text-2xl font-bold text-white">
                        {affiliateQuery.data.metrics.referrals}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
                      <p className="text-[10px] uppercase tracking-[0.13em] text-white/35">
                        First trades
                      </p>
                      <p className="mt-1 text-2xl font-bold text-white">
                        {affiliateQuery.data.metrics.firstTrade}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
                      <p className="text-[10px] uppercase tracking-[0.13em] text-white/35">
                        Signup → approval
                      </p>
                      <p className="mt-1 text-lg font-semibold text-emerald-300">
                        {pct(affiliateQuery.data.metrics.signupToApprovalPct)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
                      <p className="text-[10px] uppercase tracking-[0.13em] text-white/35">
                        Approval → trade
                      </p>
                      <p className="mt-1 text-lg font-semibold text-emerald-300">
                        {pct(affiliateQuery.data.metrics.approvalToTradePct)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
                      <p className="text-[10px] uppercase tracking-[0.13em] text-white/35">
                        Signup → trade
                      </p>
                      <p className="mt-1 text-lg font-semibold text-white">
                        {pct(affiliateQuery.data.metrics.signupToTradePct)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
                      <p className="text-[10px] uppercase tracking-[0.13em] text-white/35">
                        Trade → Pro
                      </p>
                      <p className="mt-1 text-lg font-semibold text-white">
                        {pct(affiliateQuery.data.metrics.tradeToProPct)}
                      </p>
                    </div>
                  </div>
                  <div className="px-4 pb-4">
                    <p className="text-xs text-white/45">
                      Your affiliate code is managed by Blink and cannot be
                      changed.
                    </p>
                    <Link
                      href="/affiliates/leaderboard"
                      className="mt-3 inline-flex text-xs font-medium text-emerald-300 hover:text-emerald-200"
                    >
                      View KOL leaderboard →
                    </Link>
                  </div>
                </div>
              ) : null}

              {/* How it works */}
              <div className="overflow-hidden rounded-[20px] border border-white/[0.08] bg-[#080d1a]">
                <div className="border-b border-white/[0.06] px-5 py-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-white/40" />
                    <h2 className="text-sm font-semibold text-white">
                      How it works
                    </h2>
                  </div>
                </div>
                <div className="divide-y divide-white/[0.05]">
                  {[
                    {
                      n: "1",
                      title: "Share your link",
                      body: "Send blink.lat/r/yourcode to any trader. Works on X, Telegram, or anywhere.",
                    },
                    {
                      n: "2",
                      title: "They connect",
                      body: "When they visit your link and connect their wallet, they're recorded as your referral.",
                    },
                    {
                      n: "3",
                      title: "Network grows",
                      body: "Every trader you bring strengthens the Blink leaderboard. Rewards are coming.",
                    },
                  ].map((step) => (
                    <div
                      key={step.n}
                      className="flex items-start gap-4 px-5 py-4"
                    >
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-[#2c6bff]/30 bg-[#2c6bff]/10 text-xs font-bold text-[#6fa8ff]">
                        {step.n}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {step.title}
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-white/40">
                          {step.body}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Coming soon card */}
              <div className="relative overflow-hidden rounded-[20px] border border-[#8fbaff33] bg-[linear-gradient(180deg,rgba(18,28,52,0.95),rgba(10,18,34,0.98))] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
                <div className="pointer-events-none absolute inset-x-10 top-0 h-24 rounded-full bg-[#7ea9ff22] blur-3xl" />
                <div className="pointer-events-none absolute -right-6 bottom-0 h-28 w-28 rounded-full bg-[#9bddff14] blur-3xl" />
                <div className="relative">
                  <div className="flex items-start gap-3">
                    <Gift className="mt-0.5 size-5 shrink-0 text-amber-300/60" />
                    <div>
                      <p className="text-sm font-semibold text-white">
                        Rewards coming soon
                      </p>
                      <p className="mt-1.5 text-xs leading-relaxed text-white/40">
                        Fee-sharing and on-chain rewards for top referrers are
                        in development. Every referral you make now counts
                        toward your allocation.
                      </p>
                    </div>
                  </div>

                  <RewardsClaimButton onClaim={handleClaimRequest} />
                </div>
              </div>

              {/* Back to trading */}
              <Link
                href="/trade/BTC"
                className="flex w-full items-center justify-center gap-2 rounded-[16px] bg-[#2c6bff] py-3.5 text-sm font-bold text-white transition hover:bg-[#2c6bff]/85"
              >
                Back to trading <ChevronRight className="size-4" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
