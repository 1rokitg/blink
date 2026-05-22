import Link from "next/link";

import { ArrowUpRight, Shield, Zap } from "lucide-react";

import { Badge } from "@acme/ui/badge";
import { Button } from "@acme/ui/button";

import { LandingMarketTeaser } from "~/components/blink/landing-market-teaser";
import { LandingStatsTicker } from "~/components/blink/landing-stats-ticker";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col gap-0 px-5 pb-12 pt-5 sm:px-8">

        {/* ── Top stats bar ─────────────────────────────────────── */}
        <div className="mb-3 rounded-full border border-white/[0.07] bg-white/[0.03] px-5 py-2.5 backdrop-blur-xl">
          <LandingStatsTicker />
        </div>

        {/* ── Nav ───────────────────────────────────────────────── */}
        <header className="flex items-center justify-between rounded-full border border-white/10 bg-white/[0.05] px-4 py-3 shadow-[0_24px_80px_rgba(4,8,20,0.32)] backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white">
              B
            </div>
            <span className="text-sm font-semibold text-white">Blink</span>
            <Badge className="rounded-full border border-white/10 bg-white/8 px-2.5 py-0.5 text-[10px] font-medium text-foreground/55">
              Hyperliquid terminal
            </Badge>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <a
              href="https://x.com/rokitdotgg"
              target="_blank"
              rel="noreferrer"
              className="text-sm text-foreground/52 transition hover:text-foreground/80"
            >
              @rokitdotgg
            </a>
            <Button
              asChild
              className="rounded-full bg-white px-5 text-sm font-semibold text-black hover:bg-white/90"
            >
              <Link href="/app/btc">
                Open Terminal
                <ArrowUpRight className="ml-1.5 size-3.5" />
              </Link>
            </Button>
          </div>
        </header>

        {/* ── Hero ──────────────────────────────────────────────── */}
        <section className="grid flex-1 items-center gap-12 py-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20">
          <div>
            <Badge className="mb-5 rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-foreground/60">
              Powered by Hyperliquid builder codes
            </Badge>

            <h1 className="text-[clamp(3rem,6vw,5.5rem)] font-semibold leading-[0.92] tracking-[-0.05em] text-white">
              Trade Hyperliquid.{" "}
              <span className="text-foreground/45">Own your edge.</span>
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-[1.7] text-foreground/58">
              Blink is a clean execution terminal for Hyperliquid perps — live
              order book, limit and market orders, real-time account context.
              Built for traders who move fast and think in size.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button
                asChild
                size="lg"
                className="rounded-full bg-white px-7 text-sm font-semibold text-black hover:bg-white/90"
              >
                <Link href="/app/btc">
                  Launch Terminal
                  <ArrowUpRight className="ml-2 size-4" />
                </Link>
              </Button>

              <a
                href="https://x.com/rokitdotgg"
                target="_blank"
                rel="noreferrer"
                className="text-sm text-foreground/45 transition hover:text-foreground/75"
              >
                Follow for alpha →
              </a>
            </div>

            {/* ── Trust strip ────────────────────────────────────── */}
            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              <div className="glass-panel px-4 py-4">
                <Zap className="size-4 text-foreground/80" />
                <p className="mt-3 text-sm font-medium text-white">
                  Limit &amp; market orders
                </p>
                <p className="mt-1.5 text-sm leading-6 text-foreground/50">
                  IOC market orders, GTC limits — routed on-chain through your
                  wallet.
                </p>
              </div>
              <div className="glass-panel px-4 py-4">
                <Shield className="size-4 text-foreground/80" />
                <p className="mt-3 text-sm font-medium text-white">
                  Builder-code transparent
                </p>
                <p className="mt-1.5 text-sm leading-6 text-foreground/50">
                  ≤0.01% builder fee, one-time approval, disclosed up front
                  before your first trade.
                </p>
              </div>
              <div className="glass-panel px-4 py-4">
                <ArrowUpRight className="size-4 text-foreground/80" />
                <p className="mt-3 text-sm font-medium text-white">
                  External wallets only
                </p>
                <p className="mt-1.5 text-sm leading-6 text-foreground/50">
                  MetaMask, Rabby, Coinbase — connect the wallet you already
                  use. No custodial layer.
                </p>
              </div>
            </div>
          </div>

          {/* ── Market teaser ──────────────────────────────────── */}
          <div>
            <LandingMarketTeaser />
          </div>
        </section>
      </div>
    </main>
  );
}
