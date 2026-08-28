import {
  ArrowUpRight,
  BarChart3,
  Eye,
  LineChart,
  Rocket,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import {
  formatInvestUsd,
  getInvestTractionMetrics,
} from "~/lib/blink/invest-metrics.server";
import { BLINK_TOKEN_ROUTE } from "~/lib/blink/token";

export const metadata: Metadata = {
  title: "Invest | Blink",
  description:
    "Blink is the social-first terminal — builder-code revenue, consumer distribution, and onchain perps execution.",
  openGraph: {
    title: "Invest in Blink",
    description:
      "Social-first terminal. Live on DeFiLlama. Own the flow. Monetize the audience.",
    url: "https://blink.lat/invest",
  },
};

const revenueStreams = [
  {
    title: "Builder fees",
    detail:
      "Builder codes earn on every routed perp fill — onchain, revocable, no custody.",
    icon: Zap,
  },
  {
    title: "Blink Pro",
    detail:
      "Tiered memberships with lower routed fees, staking boosts, and desk-level tooling.",
    icon: Shield,
  },
  {
    title: "Referrals & affiliates",
    detail:
      "KOL leaderboard, boosted codes, and gamified shill loops that turn attention into signups.",
    icon: Users,
  },
  {
    title: "Community upside",
    detail:
      "Premium rooms, alerts, and social identity layers that compound retention and LTV.",
    icon: Sparkles,
  },
];

const roadmap = [
  {
    phase: "Now",
    items: [
      "Live terminal on L1",
      "DeFiLlama-listed as Blink Perps",
      "Screen-based onboarding + builder routing",
      "Affiliate leaderboard + public KOL stats",
    ],
  },
  {
    phase: "Next",
    items: [
      "Embedded wallet + Google onboarding (ROK-9)",
      "Mobile companion + push alerts",
      "Copy-trading and follow-feed discovery",
    ],
  },
  {
    phase: "Scale",
    items: [
      "Gasless funding rails (Apple Pay / Stripe)",
      "Cross-device continuity like fomo.family",
      "Partner integrations (tax, analytics, wallets)",
      "Token-aligned community growth engine",
    ],
  },
];

export default async function InvestPage() {
  const metrics = await getInvestTractionMetrics();

  return (
    <main className="min-h-screen bg-[#060510] px-4 py-10 text-[#f4f7fb] sm:px-6 lg:px-8">
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(circle at 16% 18%, rgba(58,102,255,0.22), transparent 44%), radial-gradient(circle at 78% 14%, rgba(39,198,181,0.16), transparent 42%), radial-gradient(circle at 50% 78%, rgba(35,73,168,0.14), transparent 48%)",
        }}
      />

      <div className="relative mx-auto max-w-6xl space-y-8">
        {/* Slide 01 — Cover */}
        <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,14,24,0.96),rgba(6,9,18,0.98))] p-7 shadow-[0_28px_100px_rgba(0,0,0,0.45)] sm:p-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link
              href="/"
              className="text-3xl font-bold tracking-[-0.04em] text-white"
            >
              blink
            </Link>
            <span className="rounded-full border border-[#38bdf8]/25 bg-[#38bdf8]/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#9bddff]">
              Investor brief
            </span>
          </div>

          <p className="mt-10 text-[11px] font-medium uppercase tracking-[0.22em] text-[#7fa8ff]/80">
            01 — Cover
          </p>
          <h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-[-0.05em] text-white sm:text-6xl">
              The social-first terminal.
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-white/68 sm:text-xl">
            Crypto moves in the blink of an eye. Blink turns creator attention,
            KOL distribution, and consumer-grade UX into{" "}
            <span className="text-[#8ad9ff]">onchain perp revenue</span> via
            builder codes — without custody, without reinventing the
            exchange.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              href="/trade/BTC"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-[#8fbaff80] bg-[linear-gradient(180deg,#3c76ff,#2457db)] px-6 text-sm font-semibold text-white shadow-[0_18px_50px_rgba(37,90,224,0.35)] transition hover:brightness-110"
            >
              Try the live terminal
              <ArrowUpRight className="size-3.5" />
            </Link>
            <a
              href={metrics.defillamaUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-6 text-sm font-semibold text-white/85 transition hover:bg-white/[0.08]"
            >
              DeFiLlama · Blink Perps
              <BarChart3 className="size-3.5" />
            </a>
          </div>
        </section>

        {/* Slide 02 — Problem */}
        <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,17,28,0.98),rgba(7,11,20,0.98))] p-7 sm:p-8">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#7fa8ff]/80">
            02 — Problem
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
            Hyperliquid is fast. The experience is still cold.
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              {
                icon: Eye,
                title: "Traders miss moves",
                body: "Perps velocity is brutal. Retail churns when execution, funding, and social context live in disconnected tabs.",
              },
              {
                icon: Users,
                title: "Creators lack product",
                body: "KOLs and communities have attention but no owned trading surface — they rent distribution to generic frontends.",
              },
              {
                icon: LineChart,
                title: "Revenue leaks away",
                body: "Without builder routing and membership layers, the value of curated flow accrues to venues — not to the brand that sourced it.",
              },
            ].map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"
              >
                <Icon className="size-5 text-[#8ad9ff]" />
                <h3 className="mt-4 text-lg font-semibold text-white">
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-white/58">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Slide 03 — Solution */}
        <section className="rounded-[28px] border border-[#6cc6ff33] bg-[linear-gradient(180deg,rgba(10,23,42,0.92),rgba(6,16,30,0.96))] p-7 sm:p-8">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#7fa8ff]/80">
            03 — Solution
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
            Blink — where traders become legends.
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-7 text-white/62">
            A consumer-grade Hyperliquid terminal with social discovery,
            verified profiles, referrals, Pro memberships, and one-click
            onboarding. North star:{" "}
            <a
              href="https://fomo.family"
              target="_blank"
              rel="noreferrer"
              className="text-[#8ad9ff] underline-offset-4 hover:underline"
            >
              fomo.family
            </a>{" "}
            energy — applied to onchain perps.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              "Draggable terminal + intent trade flows",
              "Public profiles, X verification, leaderboards",
              "Builder-code routing on L1",
              "Affiliate KOL gamification + live stats",
            ].map((item) => (
              <div
                key={item}
                className="rounded-xl border border-white/10 bg-[#0f1422]/80 px-4 py-3 text-sm leading-6 text-white/70"
              >
                <Sparkles className="mb-2 size-4 text-emerald-300" />
                {item}
              </div>
            ))}
          </div>
        </section>

        {/* Slide 04 — Traction */}
        <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,17,28,0.98),rgba(7,11,20,0.98))] p-7 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#7fa8ff]/80">
                04 — Traction
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
                Live on DeFiLlama as{" "}
                <span className="text-[#8ad9ff]">{metrics.protocolName}</span>
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/58">
                {metrics.description} Builder fees and perp volume are tracked
                on-chain via builder codes.
              </p>
            </div>
            <a
              href={metrics.defillamaUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-[#8fb9ff] underline-offset-4 hover:underline"
            >
              View full dashboard →
            </a>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { label: "Fees (24h)", value: formatInvestUsd(metrics.fees24h) },
              { label: "Fees (7d)", value: formatInvestUsd(metrics.fees7d) },
              { label: "Fees (30d)", value: formatInvestUsd(metrics.fees30d) },
              {
                label: "Fees (annualized)*",
                value: formatInvestUsd(metrics.feesAnnualized),
              },
              {
                label: "Cumulative fees",
                value: formatInvestUsd(metrics.feesAllTime),
              },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
              >
                <p className="text-[10px] uppercase tracking-[0.14em] text-white/40">
                  {label}
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {value}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-white/38">
            *Annualized from 30d builder fees. Perp volume charts on{" "}
            <a
              href={metrics.defillamaUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[#8fb9ff] hover:underline"
            >
              DeFiLlama
            </a>
            . Metrics refresh hourly.
          </p>
        </section>

        {/* Slide 05 — Business model */}
        <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,17,28,0.98),rgba(7,11,20,0.98))] p-7 sm:p-8">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#7fa8ff]/80">
            05 — Business model
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
            Four rails. One distribution engine.
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {revenueStreams.map(({ title, detail, icon: Icon }) => (
              <article
                key={title}
                className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"
              >
                <div className="flex size-10 items-center justify-center rounded-2xl bg-[#3c76ff]/15 text-[#8ad9ff]">
                  <Icon className="size-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-white">
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-white/58">
                  {detail}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* Slide 06 — Moat */}
        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,17,28,0.98),rgba(7,11,20,0.98))] p-7 sm:p-8">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#7fa8ff]/80">
              06 — Moat
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">
              Distribution × product velocity
            </h2>
            <ul className="mt-6 space-y-4 text-sm leading-7 text-white/62">
              <li>
                <strong className="text-white">Personality-led GTM</strong> —
                founder audience, KOL affiliates, and referral loops built into
                the product — not bolted on.
              </li>
              <li>
                <strong className="text-white">Onchain revenue rail</strong> —
                builder codes mean fees settle on L1 without Blink
                custodying user funds.
              </li>
              <li>
                <strong className="text-white">Shipping cadence</strong> —
                monorepo terminal, internal ops, transparency feeds, and growth
                surfaces shipping in parallel.
              </li>
              <li>
                <strong className="text-white">Social identity layer</strong> —
                verified X profiles, public PnL surfaces, and leaderboard
                mechanics increase retention and shareability.
              </li>
            </ul>
          </div>

          <div className="rounded-[28px] border border-[#38bdf8]/20 bg-[linear-gradient(180deg,rgba(12,28,50,0.96),rgba(7,20,36,0.98))] p-7 sm:p-8">
            <Target className="size-5 text-[#8ad9ff]" />
            <h3 className="mt-4 text-xl font-semibold text-white">
              Why now
            </h3>
            <p className="mt-3 text-sm leading-6 text-white/58">
              Builder codes let
              frontends capture flow without launching a new chain or matching
              engine — the strategic bet is owning UX and distribution, not
              reinventing clearing.
            </p>
            <div className="mt-6 space-y-3">
              {[
                "Category: Builder (DeFiLlama)",
                "Chain: L1",
                "Product: Perpetuals via builder code",
                "Site: blinkperps.xyz",
              ].map((line) => (
                <div
                  key={line}
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/65"
                >
                  {line}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Slide 07 — Roadmap */}
        <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,17,28,0.98),rgba(7,11,20,0.98))] p-7 sm:p-8">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#7fa8ff]/80">
            07 — Roadmap
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
            Early — with real momentum
          </h2>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {roadmap.map(({ phase, items }) => (
              <div
                key={phase}
                className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"
              >
                <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300">
                  {phase}
                </span>
                <ul className="mt-4 space-y-3 text-sm leading-6 text-white/62">
                  {items.map((item) => (
                    <li key={item} className="flex gap-2">
                      <TrendingUp className="mt-0.5 size-4 shrink-0 text-[#7fa8ff]" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Slide 08 — Token + Ask */}
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-[28px] border border-[#8fbaff44] bg-[linear-gradient(180deg,rgba(14,25,44,0.94),rgba(7,14,28,0.98))] p-7 sm:p-8">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#7fa8ff]/80">
              08 — Alignment
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">
              BLINK token & community
            </h2>
            <p className="mt-3 text-sm leading-6 text-white/58">
              The BLINK token gives the community a permanent home inside the
              app and supports bootstrap budget for product velocity — not a
              detached memecoin page.
            </p>
            <Link
              href={BLINK_TOKEN_ROUTE}
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-[#8ad9ff] hover:text-[#b8d3ff]"
            >
              BLINK token surface
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>

          <div className="rounded-[28px] border border-[#38bdf8]/15 bg-[linear-gradient(180deg,rgba(10,17,28,0.98),rgba(7,11,20,0.98))] p-7 sm:p-8">
            <Rocket className="size-5 text-[#8ad9ff]" />
            <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.22em] text-white/42">
              The ask
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">
              Strategic partners & angels
            </h2>
            <p className="mt-3 text-sm leading-6 text-white/58">
              We are raising conversation with investors who understand
              consumer crypto, trading infrastructure, and creator-led
              distribution. If that is you, reach out directly — we move fast
              and share metrics openly.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a
                href="https://x.com/rokitdotgg"
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-[#8fbaff80] bg-[linear-gradient(180deg,#3c76ff,#2457db)] px-5 text-sm font-semibold text-white transition hover:brightness-110"
              >
                DM on X
                <ArrowUpRight className="size-3.5" />
              </a>
              <a
                href="https://discord.gg/Myu962DMMA"
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-5 text-sm font-semibold text-white/85 transition hover:bg-white/[0.08]"
              >
                Discord
                <ArrowUpRight className="size-3.5" />
              </a>
            </div>
          </div>
        </section>

        <footer className="rounded-2xl border border-white/8 bg-white/[0.02] px-5 py-4 text-center text-xs leading-6 text-white/38">
          Blink is the last crypto terminal you'll ever use. Metrics from{" "}
          <a
            href={metrics.defillamaUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[#8fb9ff] hover:underline"
          >
            DeFiLlama · Blink
          </a>
              .{" "}
          <Link href="/" className="text-[#8fb9ff] hover:underline">
            blinkperps.xyz
          </Link>
        </footer>
      </div>
    </main>
  );
}
