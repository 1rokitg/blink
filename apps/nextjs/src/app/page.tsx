import Link from "next/link";

import { ArrowUpRight, Shield, Sparkles, TerminalSquare } from "lucide-react";

import { Badge } from "@acme/ui/badge";
import { Button } from "@acme/ui/button";

import { LandingMarketTeaser } from "~/components/blink/landing-market-teaser";

const valueProps = [
  {
    title: "Execution-first workspace",
    copy: "Clean chart, order book, order entry, and live position context built for Hyperliquid traders.",
  },
  {
    title: "Builder-code routing",
    copy: "Blink is designed to monetize routed volume transparently through a dedicated first-trade setup flow.",
  },
  {
    title: "Calm pro interface",
    copy: "Glassy, restrained, and modern enough for newer users without losing the density power users expect.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col px-6 pb-12 pt-6 sm:px-10">
        <header className="flex items-center justify-between rounded-full border border-white/10 bg-white/5 px-4 py-3 shadow-[0_24px_80px_rgba(4,8,20,0.32)] backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white">
              B
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-foreground/45">
                Blink
              </p>
              <p className="text-sm text-foreground/80">
                Hyperliquid terminal by Rokit
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <Badge className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[11px] font-medium text-foreground/70">
              Public app, wallet-gated terminal
            </Badge>
            <Button
              asChild
              className="rounded-full bg-white px-5 text-sm font-semibold text-black hover:bg-white/90"
            >
              <Link href="/trade/BTC">Enter Blink</Link>
            </Button>
          </div>
        </header>

        <section className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <div className="max-w-3xl">
            <Badge className="mb-6 rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-foreground/65">
              All-in-one Hyperliquid terminal
            </Badge>

            <h1 className="max-w-4xl text-5xl font-semibold leading-[0.95] tracking-[-0.05em] text-white md:text-7xl">
              Calm enough for beginners. Fast enough for power users.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-foreground/62">
              Blink turns the Rokit funnel into a polished execution surface:
              market context, live order flow, and builder-code-enabled trading
              inside a cleaner Hyperliquid workspace.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button
                asChild
                size="lg"
                className="rounded-full bg-white px-6 text-sm font-semibold text-black hover:bg-white/90"
              >
                <Link href="/trade/BTC">
                  Launch Terminal
                  <ArrowUpRight className="ml-2 size-4" />
                </Link>
              </Button>

              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-full border-white/12 bg-white/6 px-6 text-sm text-white hover:bg-white/10"
              >
                <a href="https://rokitg.fun" target="_blank" rel="noreferrer">
                  View Funnel DNA
                </a>
              </Button>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              <div className="glass-card px-4 py-4">
                <TerminalSquare className="size-5 text-foreground/85" />
                <p className="mt-3 text-sm font-medium text-white">
                  Fixed execution layout
                </p>
                <p className="mt-2 text-sm leading-6 text-foreground/55">
                  Chart, book, order entry, watchlist, and active risk in one
                  calm workspace.
                </p>
              </div>
              <div className="glass-card px-4 py-4">
                <Shield className="size-5 text-foreground/85" />
                <p className="mt-3 text-sm font-medium text-white">
                  Privy-powered wallet security
                </p>
                <p className="mt-2 text-sm leading-6 text-foreground/55">
                  External EVM wallets first, with a cleaner connect gate and
                  builder setup path.
                </p>
              </div>
              <div className="glass-card px-4 py-4">
                <Sparkles className="size-5 text-foreground/85" />
                <p className="mt-3 text-sm font-medium text-white">
                  Clean glassy product system
                </p>
                <p className="mt-2 text-sm leading-6 text-foreground/55">
                  Inspired by Fomo polish and Propr clarity, adapted for
                  Hyperliquid-native traders.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <LandingMarketTeaser />

            <div className="grid gap-4 md:grid-cols-3">
              {valueProps.map((item) => (
                <div key={item.title} className="glass-card px-5 py-5">
                  <p className="text-sm font-medium text-white">{item.title}</p>
                  <p className="mt-3 text-sm leading-6 text-foreground/55">
                    {item.copy}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
