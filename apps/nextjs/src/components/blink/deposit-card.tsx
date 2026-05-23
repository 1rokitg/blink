"use client";

import { useCallback, useState } from "react";

import Link from "next/link";

import { usePrivy, useWallets } from "@privy-io/react-auth";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  ShieldCheck,
  Zap,
} from "lucide-react";

import { Button } from "@acme/ui/button";

// ─── helpers ────────────────────────────────────────────────────────────────

function qrUrl(data: string, size = 220) {
  return `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(data)}&size=${size}x${size}&bgcolor=060e20&color=ffffff&margin=14&format=png&qzone=1`;
}

function truncate(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// ─── component ──────────────────────────────────────────────────────────────

export function DepositCard() {
  const { login, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const walletAddress = wallets[0]?.address ?? "";

  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!walletAddress) return;
    await navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [walletAddress]);

  return (
    <div className="relative w-full max-w-[460px]">
      {/* Back link */}
      <Link
        href="/trade/BTC"
        className="mb-5 inline-flex items-center gap-2 text-sm text-foreground/45 transition hover:text-foreground/75"
      >
        <ArrowLeft className="size-4" />
        Back to terminal
      </Link>

      {/* Card */}
      <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#080e1e] shadow-[0_40px_120px_rgba(0,0,0,0.7)]">
        {/* ── Header band ─────────────────────────────────────── */}
        <div className="relative overflow-hidden px-6 pb-6 pt-6">
          {/* gradient background */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(ellipse_at_0%_0%,rgba(44,107,255,0.22),transparent_60%),radial-gradient(ellipse_at_100%_100%,rgba(26,204,188,0.16),transparent_55%)]"
          />
          <div className="relative z-10">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-foreground/45">
              Fund your account
            </p>
            <h1 className="mt-1.5 text-3xl font-semibold tracking-[-0.03em] text-white">
              Deposit USDC
            </h1>
            <p className="mt-1 text-sm text-foreground/55">
              on Arbitrum One · bridges instantly to Hyperliquid
            </p>
          </div>
        </div>

        {/* ── QR + address ────────────────────────────────────── */}
        {authenticated && walletAddress ? (
          <>
            {/* QR + gradient hero */}
            <div className="mx-5 overflow-hidden rounded-[20px] border border-white/8">
              <div className="flex items-stretch">
                {/* Left gradient panel */}
                <div className="flex flex-1 flex-col justify-between bg-[linear-gradient(145deg,#0e2154,#0a1530)] p-5">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#7fa8ff]/70">
                      USDC · ARB
                    </p>
                    <p className="mt-2 text-2xl font-semibold leading-tight tracking-[-0.03em] text-white">
                      Send only USDC on Arbitrum
                    </p>
                  </div>
                  {/* USDC logo — inline SVG, no external fetch.
                      Ring: stroke-dasharray on a circle gives the 4-arc broken ring.
                      Circumference at r=310 ≈ 1948. Arc≈422, gap≈65 → 4×(422+65)=1948 */}
                  <svg
                    className="mt-6 size-10"
                    viewBox="0 0 1000 1000"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-label="USDC"
                  >
                    <title>USDC</title>
                    <circle cx="500" cy="500" r="500" fill="#2775CA" />
                    <circle
                      cx="500"
                      cy="500"
                      r="310"
                      fill="none"
                      stroke="white"
                      strokeWidth="75"
                      strokeLinecap="round"
                      strokeDasharray="422 65"
                      transform="rotate(-124 500 500)"
                    />
                    <text
                      x="500"
                      y="568"
                      textAnchor="middle"
                      fontSize="390"
                      fontWeight="700"
                      fill="white"
                      fontFamily="Arial, Helvetica, sans-serif"
                    >
                      $
                    </text>
                  </svg>
                </div>

                {/* QR panel */}
                <div className="flex items-center justify-center border-l border-white/8 bg-[#060e20] p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrUrl(walletAddress)}
                    alt="Deposit address QR code"
                    width={140}
                    height={140}
                    className="rounded-[10px]"
                  />
                </div>
              </div>
            </div>

            {/* Address row */}
            <div className="mx-5 mt-3">
              <div className="flex items-center justify-between rounded-[14px] border border-white/8 bg-white/[0.03] px-4 py-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-foreground/38">
                    Your address
                  </p>
                  <p className="mt-1 font-mono text-sm text-white/80">
                    {truncate(walletAddress)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="flex size-9 items-center justify-center rounded-[10px] border border-white/10 bg-white/[0.05] transition hover:bg-white/[0.10]"
                  aria-label="Copy address"
                >
                  {copied ? (
                    <CheckCircle2 className="size-4 text-emerald-300" />
                  ) : (
                    <Copy className="size-4 text-foreground/55" />
                  )}
                </button>
              </div>

              {/* Full address (dimmed) */}
              <p className="mt-2 break-all px-1 font-mono text-[11px] text-foreground/28">
                {walletAddress}
              </p>
            </div>
          </>
        ) : (
          /* Not connected state */
          <div className="mx-5 flex flex-col items-center rounded-[20px] border border-white/8 bg-white/[0.02] px-6 py-10 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-white/[0.06]">
              <ShieldCheck className="size-6 text-foreground/50" />
            </div>
            <p className="mt-4 text-base font-medium text-white">
              Sign in to get your deposit address
            </p>
            <p className="mt-2 text-sm text-foreground/50">
              Your non-custodial wallet is created automatically on first login.
            </p>
            <Button
              className="mt-6 h-11 w-full rounded-full bg-white text-sm font-semibold text-black hover:bg-white/90"
              onClick={() => login()}
            >
              Continue with Google
            </Button>
          </div>
        )}

        {/* ── Info bullets ────────────────────────────────────── */}
        <div className="mx-5 mb-5 mt-4 space-y-2.5">
          {[
            {
              icon: AlertCircle,
              color: "text-amber-300/80",
              text: "Only send USDC to this address on Arbitrum One. Assets sent on any other network will be lost.",
            },
            {
              icon: Clock,
              color: "text-foreground/50",
              text: "Deposits typically confirm in under 30 seconds on Arbitrum.",
            },
            {
              icon: Zap,
              color: "text-[#7fa8ff]",
              text: "Funds bridge automatically from Arbitrum to your Hyperliquid account — no extra steps.",
            },
            {
              icon: ShieldCheck,
              color: "text-emerald-300/70",
              text: "This is a non-custodial embedded wallet. Blink never controls your funds.",
            },
          ].map(({ icon: Icon, color, text }) => (
            <div key={text} className="flex items-start gap-3">
              <Icon
                className={`mt-0.5 size-4 shrink-0 ${color}`}
                aria-hidden="true"
              />
              <p className="text-[13px] leading-[1.6] text-foreground/55">
                {text}
              </p>
            </div>
          ))}
        </div>

        {/* ── Footer ──────────────────────────────────────────── */}
        <div className="border-t border-white/8 px-5 py-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-foreground/30">
              Powered by Hyperliquid
            </p>
            <a
              href="https://hyperliquid.gitbook.io/hyperliquid-docs/onboarding/how-to-use-the-bridge"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-foreground/35 transition hover:text-foreground/65"
            >
              Bridge docs
              <ExternalLink className="size-3" />
            </a>
          </div>
        </div>
      </div>

      {/* Protected by Privy banner */}
      <div className="mt-5 flex items-center justify-center gap-2">
        <span className="text-sm text-white/55">Protected by</span>

        {/*
          Privy wordmark + logomark reproduced from privy.io brand assets.
          The mark: large filled circle (head) + smaller filled oval below (body nub).
        */}
        <span className="inline-flex items-center gap-1.5">
          {/* Logomark */}
          <svg
            width="16"
            height="20"
            viewBox="0 0 40 52"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            {/* Head circle */}
            <circle cx="20" cy="18" r="18" fill="white" />
            {/* Body nub — oval that peeks below */}
            <ellipse cx="20" cy="44" rx="12" ry="8" fill="white" />
          </svg>

          {/* Wordmark */}
          <span
            className="text-sm font-bold tracking-[-0.02em] text-white"
            style={{ fontFamily: "inherit" }}
          >
            privy
          </span>
        </span>
      </div>
    </div>
  );
}
