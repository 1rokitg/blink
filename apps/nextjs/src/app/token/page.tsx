import { Disc, Rocket, Sparkles, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { TokenProgressPanel } from "~/components/blink/token-progress-panel";
import { getBlinkTokenProgress } from "~/lib/blink/clanker.server";
import {
  BLINK_TOKEN_CLANKER_URL,
  BLINK_TOKEN_FOMO_URL,
  BLINK_TOKEN_HEADLINE,
  BLINK_TOKEN_SUBHEAD,
} from "~/lib/blink/token";

export const metadata: Metadata = {
  title: "BLINK Token | Blink",
  description:
    "Learn why the BLINK token matters to Blink's bootstrap budget, product velocity, and long-term community alignment.",
};

const tokenReasons = [
  {
    icon: Wallet,
    title: "Bootstrap the budget",
    description:
      "A strong token CTA gives Blink a clean surface to turn attention into budget, runway, and sharper execution.",
  },
  {
    icon: Rocket,
    title: "Fund product velocity",
    description:
      "The goal is simple: ship faster, strengthen liquidity, and keep the terminal improving without losing momentum.",
  },
  {
    icon: Sparkles,
    title: "Align the community",
    description:
      "The BLINK token should feel like a community growth engine, not a detached finance page hidden outside the app.",
  },
];

export default async function TokenPage() {
  const progressSnapshot = await getBlinkTokenProgress();

  return (
    <main className="min-h-screen bg-[#060510] px-4 py-10 text-[#f4f7fb] sm:px-6 lg:px-8">
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(circle at 18% 18%, rgba(56,189,248,0.14), transparent 28%), radial-gradient(circle at 82% 16%, rgba(96,165,250,0.12), transparent 24%), radial-gradient(circle at 50% 75%, rgba(14,165,233,0.08), transparent 30%)",
        }}
      />

      <div className="relative mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.08fr_0.92fr]">
        <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,14,24,0.96),rgba(6,9,18,0.98))] p-7 shadow-[0_28px_100px_rgba(0,0,0,0.45)] sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#38bdf8]/20 bg-[#38bdf8]/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[#9bddff]">
            <Disc className="size-3.5" />
            Token Surface
          </div>

          <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl">
            {BLINK_TOKEN_HEADLINE}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/68 sm:text-lg">
            {BLINK_TOKEN_SUBHEAD} This page gives the app a permanent
            destination for that story instead of burying the token behind
            offsite links and fragmented mentions.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {tokenReasons.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
              >
                <div className="flex size-10 items-center justify-center rounded-2xl bg-[#38bdf8]/12 text-[#8ad9ff]">
                  <Icon className="size-5" />
                </div>
                <h2 className="mt-4 text-sm font-semibold text-white">
                  {title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-white/55">
                  {description}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-[24px] border border-white/10 bg-white/[0.035] p-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#9bddff]">
              Why it matters in-product
            </p>
            <div className="mt-4 space-y-3 text-sm leading-7 text-white/65">
              <p>
                A token CTA that lives throughout Blink keeps monetization
                visible to power users, curious traders, and community members
                without making them hunt for it.
              </p>
              <p>
                This route is now the stable home for future token details, live
                links, listing information, or launch mechanics whenever you
                want to wire them in.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-[32px] border border-[#38bdf8]/15 bg-[linear-gradient(180deg,rgba(10,17,28,0.98),rgba(7,11,20,0.98))] p-7 shadow-[0_28px_100px_rgba(0,0,0,0.4)] sm:p-8">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/42">
            Blink token
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">
            Give Blink a permanent token destination.
          </h2>
          <p className="mt-3 text-sm leading-6 text-white/62">
            This page now ties Blink&apos;s token story to real Clanker creator
            fees. The 100 ETH target gives the community a live scoreboard for
            the budget behind Blink shipping faster.
          </p>

          <div className="mt-6">
            <TokenProgressPanel initialSnapshot={progressSnapshot} />
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <a
              href={BLINK_TOKEN_CLANKER_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-12 items-center justify-center rounded-2xl border border-[#8fbaff80] bg-[linear-gradient(180deg,#3c76ff,#2457db)] px-5 text-sm font-semibold text-white shadow-[0_18px_50px_rgba(37,90,224,0.35)] transition hover:brightness-110"
            >
              Open token on Clanker
            </a>
            <a
              href={BLINK_TOKEN_FOMO_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-12 items-center justify-center rounded-2xl border border-[#f5d06d55] bg-[linear-gradient(180deg,rgba(245,208,109,0.16),rgba(245,208,109,0.08))] px-5 text-sm font-semibold text-[#ffe8a3] transition hover:border-[#f5d06d88] hover:bg-[linear-gradient(180deg,rgba(245,208,109,0.24),rgba(245,208,109,0.12))] hover:text-white"
            >
              $blink listed on $fomo using our ref link
            </a>
            <Link
              href="/trade/BTC"
              className="inline-flex h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 text-sm font-semibold text-white/80 transition hover:bg-white/[0.08] hover:text-white"
            >
              Open the terminal
            </Link>
          </div>

          <p className="mt-3 text-xs leading-6 text-white/45">
            Drive signups through Blink&apos;s lane by sending users to the Fomo
            listing through our referral link.
          </p>

          <div className="mt-6 rounded-[24px] border border-white/10 bg-white/[0.04] p-5 text-sm leading-6 text-white/58">
            <p className="font-semibold text-white">How this is measured</p>
            <p className="mt-2">
              Blink reads live WETH fees from Clanker&apos;s fee locker and adds
              already-claimed creator fee events to show total rewarded progress
              toward the 100 ETH target.
            </p>
          </div>

          <Link
            href="/"
            className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[#9bddff] transition hover:text-white"
          >
            Back to Blink
          </Link>
        </section>
      </div>
    </main>
  );
}
