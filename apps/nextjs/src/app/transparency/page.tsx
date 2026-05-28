import Link from "next/link";

import { ArrowUpRight, Radio, Shield, Sparkles } from "lucide-react";

import { Badge } from "@acme/ui/badge";

import { TransparencyLiveActivityResource } from "~/components/blink/transparency-live-activity-resource";

const TRANSPARENCY_RESOURCES = [
  { id: "live-activity", label: "Live Activity", status: "live" as const },
  { id: "routing-quality", label: "Routing Quality", status: "planned" as const },
  { id: "fees-revenue", label: "Fees & Revenue", status: "planned" as const },
  { id: "uptime-incidents", label: "Uptime & Incidents", status: "planned" as const },
];

export default function TransparencyPage() {
  return (
    <main className="min-h-screen bg-[#06070b] px-4 py-5 text-foreground md:px-6">
      <div className="mx-auto flex w-full max-w-[1500px] gap-4">
        <aside className="sticky top-4 hidden h-fit w-[260px] shrink-0 rounded-2xl border border-white/10 bg-[#0b0d13] p-4 lg:block">
          <Badge className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-white/70">
            Transparency
          </Badge>
          <h1 className="mt-3 text-xl font-semibold text-white">Blink public resources</h1>
          <p className="mt-1 text-xs leading-5 text-foreground/45">
            Open metrics and operational signals for the community.
          </p>

          <nav className="mt-4 space-y-1.5">
            {TRANSPARENCY_RESOURCES.map((resource) => (
              <a
                key={resource.id}
                href={`#${resource.id}`}
                className="flex items-center justify-between rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2 text-sm text-foreground/75 transition hover:border-white/20 hover:text-white"
              >
                <span>{resource.label}</span>
                {resource.status === "live" ? (
                  <span className="text-[10px] uppercase tracking-[0.14em] text-emerald-300">
                    Live
                  </span>
                ) : (
                  <span className="text-[10px] uppercase tracking-[0.14em] text-foreground/45">
                    Planned
                  </span>
                )}
              </a>
            ))}
          </nav>

          <div className="mt-4 rounded-xl border border-white/10 bg-[#101523] p-3 text-xs text-foreground/55">
            Inspired by modern transparency dashboards; designed for Blink data and brand system.
          </div>
        </aside>

        <section className="min-w-0 flex-1 space-y-4">
          <div className="rounded-2xl border border-white/10 bg-[#0b0d13] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Shield className="size-4 text-[#9ec0ff]" />
                  <p className="text-xs uppercase tracking-[0.15em] text-[#9ec0ff]/90">
                    Public transparency
                  </p>
                </div>
                <h2 className="mt-2 text-[34px] font-semibold tracking-[-0.02em] text-white">
                  How Blink runs, in public
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-foreground/58">
                  This page is a living resource hub for growth, reliability, and routing trust metrics.
                  Live Activity is the first module, with more resources shipping incrementally.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href="/leaderboard"
                  className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/80 transition hover:bg-white/[0.08]"
                >
                  Leaderboard
                  <ArrowUpRight className="size-3.5" />
                </Link>
                <Link
                  href="/trade/BTC"
                  className="inline-flex items-center gap-1 rounded-lg border border-[#8fbaff80] bg-[linear-gradient(180deg,#3c76ff,#2457db)] px-3 py-2 text-sm text-white shadow-[0_12px_30px_rgba(37,90,224,0.28)] transition hover:brightness-110"
                >
                  Trade on Blink
                  <Sparkles className="size-3.5" />
                </Link>
              </div>
            </div>
          </div>

          <TransparencyLiveActivityResource />

          <section
            id="routing-quality"
            className="rounded-2xl border border-dashed border-white/15 bg-[#0b0d13] p-5"
          >
            <div className="flex items-center gap-2">
              <Radio className="size-4 text-foreground/50" />
              <h3 className="text-base font-semibold text-white">Routing Quality</h3>
            </div>
            <p className="mt-2 text-sm text-foreground/50">
              Planned next: fill latency bands, slippage buckets, and market-level execution quality.
            </p>
          </section>
        </section>
      </div>
    </main>
  );
}

