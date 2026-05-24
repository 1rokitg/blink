"use client";

import { useState } from "react";

import Link from "next/link";

import { useWallets } from "@privy-io/react-auth";
import {
  Check,
  ChevronRight,
  Copy,
  Gift,
  Layers,
  Share2,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";

// ─── Tier config ─────────────────────────────────────────────────────────────

const TIERS = [
  {
    name: "Starter",
    volumeReq: "$0",
    cashback: "5%",
    referral: "10%",
    color: "#788395",
    glow: "rgba(120,131,149,0.15)",
  },
  {
    name: "Trader",
    volumeReq: "$10K",
    cashback: "10%",
    referral: "15%",
    color: "#6fa8ff",
    glow: "rgba(111,168,255,0.15)",
  },
  {
    name: "Pro",
    volumeReq: "$100K",
    cashback: "15%",
    referral: "20%",
    color: "#3be1ba",
    glow: "rgba(59,225,186,0.15)",
  },
  {
    name: "Legend",
    volumeReq: "$1M",
    cashback: "25%",
    referral: "30%",
    color: "#fbbf24",
    glow: "rgba(251,191,36,0.18)",
  },
];

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-[18px] border border-white/[0.08] bg-[#080d1a] p-5">
      <div
        className="absolute inset-0 opacity-40"
        style={{
          background: accent
            ? `radial-gradient(circle at 0% 0%, ${accent}, transparent 60%)`
            : undefined,
        }}
      />
      <div className="relative">
        <div className="mb-3 flex items-center gap-2">
          <Icon className="size-4 text-white/40" />
          <span className="text-[11px] uppercase tracking-[0.14em] text-white/40">
            {label}
          </span>
        </div>
        <p className="text-3xl font-semibold tracking-tight text-white">
          {value}
        </p>
        {sub && <p className="mt-1 text-sm text-white/40">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-xs font-medium text-white/50 transition hover:bg-white/[0.08] hover:text-white ${className}`}
    >
      {copied ? (
        <Check className="size-3.5 text-emerald-400" />
      ) : (
        <Copy className="size-3.5" />
      )}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

// ─── Cashback row ─────────────────────────────────────────────────────────────

function EarningsRow({
  label,
  sublabel,
  amount,
  claimed,
}: {
  label: string;
  sublabel: string;
  amount: string;
  claimed: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-[12px] border border-white/[0.06] bg-white/[0.02] px-4 py-3">
      <div>
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="text-xs text-white/40">{sublabel}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-mono text-sm font-semibold text-emerald-300">
          {amount}
        </span>
        {claimed ? (
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[10px] text-white/35">
            Claimed
          </span>
        ) : (
          <button
            type="button"
            className="rounded-lg bg-[#2c6bff] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#2c6bff]/85"
          >
            Claim
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RewardsPage() {
  const { wallets } = useWallets();
  const address = wallets[0]?.address;
  const alias = "rokitg"; // TODO: pull from user profile

  const referralLink = `blink.lat/r/${alias}`;

  return (
    <main className="min-h-screen bg-background px-4 pb-12 pt-6 text-[#f2f4f7]">
      {/* ── Top nav ──────────────────────────────────────────────────────────── */}
      <div className="mx-auto mb-8 flex max-w-[1100px] items-center justify-between">
        <Link
          href="/trade/BTC"
          className="text-3xl font-bold tracking-[-0.04em] text-white"
        >
          blink
        </Link>
        <nav className="flex items-center gap-1">
          {[
            { href: "/trade/BTC", label: "Trade" },
            { href: "/profile/rokitg", label: "Profile" },
            { href: "/rewards", label: "Rewards", active: true },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-[10px] px-4 py-2 text-sm font-medium transition ${
                item.active
                  ? "bg-white/[0.08] text-white"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="mx-auto max-w-[1100px]">
        {/* ── Hero ───────────────────────────────────────────────────────────── */}
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#fbbf2440] bg-[#fbbf2412] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-300">
            <Sparkles className="size-3" />
            Legend tier
          </div>
          <h1 className="text-5xl font-bold tracking-[-0.04em] text-white">
            Your Rewards
          </h1>
          <p className="mt-2 text-white/45">
            Earn cashback on every trade and commission on referrals.
          </p>
        </div>

        {/* ── Stats grid ─────────────────────────────────────────────────────── */}
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard
            icon={Gift}
            label="Total Unclaimed"
            value="$0.00"
            sub="Ready to claim"
            accent="rgba(59,225,186,0.2)"
          />
          <StatCard
            icon={Zap}
            label="Cashback Rate"
            value="25%"
            sub="Legend tier"
            accent="rgba(251,191,36,0.18)"
          />
          <StatCard
            icon={TrendingUp}
            label="Trading Volume"
            value="$0"
            sub="All time"
            accent="rgba(111,168,255,0.15)"
          />
          <StatCard
            icon={Users}
            label="Referrals"
            value="0"
            sub="30% commission"
            accent="rgba(167,139,250,0.15)"
          />
        </div>

        <div className="grid gap-6 md:grid-cols-[1fr_360px]">
          {/* ── Left column ──────────────────────────────────────────────────── */}
          <div className="space-y-5">
            {/* Referral link */}
            <section className="overflow-hidden rounded-[20px] border border-white/[0.08] bg-[#080d1a]">
              <div className="border-b border-white/[0.06] px-5 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Share2 className="size-4 text-white/50" />
                    <h2 className="text-sm font-semibold text-white">
                      Referral Link
                    </h2>
                  </div>
                  <span className="text-[11px] text-white/35">
                    30% commission
                  </span>
                </div>
              </div>

              <div className="p-5">
                {/* Referral code */}
                <div className="mb-3 flex items-center justify-between rounded-[12px] border border-white/[0.07] bg-white/[0.03] px-4 py-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.12em] text-white/35">
                      Referral code
                    </p>
                    <p className="mt-0.5 font-mono text-base font-semibold text-[#6fa8ff]">
                      {alias}
                    </p>
                  </div>
                  <CopyButton text={alias} />
                </div>

                {/* Web link */}
                <div className="flex items-center justify-between rounded-[12px] border border-white/[0.07] bg-white/[0.03] px-4 py-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.12em] text-white/35">
                      Web app
                    </p>
                    <p className="mt-0.5 text-sm font-medium text-white/70">
                      {referralLink}
                    </p>
                  </div>
                  <CopyButton text={`https://${referralLink}`} />
                </div>
              </div>
            </section>

            {/* Cashback earnings */}
            <section className="overflow-hidden rounded-[20px] border border-white/[0.08] bg-[#080d1a]">
              <div className="border-b border-white/[0.06] px-5 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="size-4 text-white/50" />
                    <h2 className="text-sm font-semibold text-white">
                      Cashback
                    </h2>
                  </div>
                  <span className="font-mono text-sm font-semibold text-emerald-300">
                    $0.00
                  </span>
                </div>
              </div>
              <div className="space-y-2 p-5">
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Zap className="mb-3 size-8 text-white/15" />
                  <p className="text-sm font-medium text-white/40">
                    No cashback yet
                  </p>
                  <p className="mt-1 text-xs text-white/25">
                    Start trading to earn builder fee rebates.
                  </p>
                  <Link
                    href="/trade/BTC"
                    className="mt-4 inline-flex items-center gap-1.5 rounded-[10px] bg-[#2c6bff] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#2c6bff]/85"
                  >
                    Start trading
                    <ChevronRight className="size-4" />
                  </Link>
                </div>
              </div>
            </section>

            {/* Referral earnings */}
            <section className="overflow-hidden rounded-[20px] border border-white/[0.08] bg-[#080d1a]">
              <div className="border-b border-white/[0.06] px-5 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="size-4 text-white/50" />
                    <h2 className="text-sm font-semibold text-white">
                      Referral Earnings
                    </h2>
                  </div>
                  <span className="font-mono text-sm font-semibold text-emerald-300">
                    $0.00
                  </span>
                </div>
              </div>
              <div className="p-5">
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Users className="mb-3 size-8 text-white/15" />
                  <p className="text-sm font-medium text-white/40">
                    No referrals yet
                  </p>
                  <p className="mt-1 text-xs text-white/25">
                    Share your link to start earning 30% of their builder fees.
                  </p>
                  <CopyButton
                    text={`https://${referralLink}`}
                    className="mt-4 rounded-[10px] border border-white/10 bg-white/[0.04] px-4 py-2 text-sm"
                  />
                </div>
              </div>
            </section>
          </div>

          {/* ── Right column — Tiers ─────────────────────────────────────────── */}
          <div className="space-y-5">
            <section className="overflow-hidden rounded-[20px] border border-white/[0.08] bg-[#080d1a]">
              <div className="border-b border-white/[0.06] px-5 py-4">
                <div className="flex items-center gap-2">
                  <Layers className="size-4 text-white/50" />
                  <h2 className="text-sm font-semibold text-white">Tiers</h2>
                </div>
              </div>

              <div className="divide-y divide-white/[0.05]">
                {TIERS.map((tier, i) => {
                  const isActive = tier.name === "Legend"; // TODO: derive from volume
                  return (
                    <div
                      key={tier.name}
                      className="relative px-5 py-4"
                      style={
                        isActive
                          ? {
                              background: `radial-gradient(ellipse at left, ${tier.glow}, transparent 70%)`,
                            }
                          : undefined
                      }
                    >
                      {isActive && (
                        <span
                          className="absolute right-4 top-4 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                          style={{
                            background: `${tier.color}22`,
                            color: tier.color,
                            border: `1px solid ${tier.color}44`,
                          }}
                        >
                          Current
                        </span>
                      )}
                      <div className="flex items-center gap-3">
                        <div
                          className="size-2 rounded-full"
                          style={{ background: tier.color, boxShadow: `0 0 6px ${tier.color}` }}
                        />
                        <span
                          className="text-sm font-bold"
                          style={{ color: isActive ? tier.color : "rgba(255,255,255,0.6)" }}
                        >
                          {tier.name}
                        </span>
                        <span className="ml-auto text-[11px] text-white/30">
                          {tier.volumeReq} vol
                        </span>
                      </div>
                      <div className="mt-2.5 grid grid-cols-2 gap-2">
                        <div className="rounded-[8px] border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                          <p className="text-[9px] uppercase tracking-[0.12em] text-white/30">
                            Cashback
                          </p>
                          <p
                            className="mt-0.5 text-sm font-semibold"
                            style={{ color: isActive ? tier.color : "rgba(255,255,255,0.7)" }}
                          >
                            {tier.cashback}
                          </p>
                        </div>
                        <div className="rounded-[8px] border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                          <p className="text-[9px] uppercase tracking-[0.12em] text-white/30">
                            Referral
                          </p>
                          <p
                            className="mt-0.5 text-sm font-semibold"
                            style={{ color: isActive ? tier.color : "rgba(255,255,255,0.7)" }}
                          >
                            {tier.referral}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Info card */}
            <section className="rounded-[20px] border border-[#2c6bff]/20 bg-[#2c6bff]/[0.06] p-5">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 size-5 shrink-0 text-[#6fa8ff]" />
                <div>
                  <p className="text-sm font-semibold text-white">
                    How it works
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-white/50">
                    Blink uses Hyperliquid builder codes to route your trades.
                    We rebate a portion of the builder fee back to you as
                    cashback, and share referral earnings when your friends sign
                    up via your link.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
