import { BadgeCheck, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ConnectTwitterButton } from "~/components/blink/connect-twitter-button";

export const metadata: Metadata = {
  title: "Verify your X profile | Blink",
  description:
    "Connect your wallet and verify your X profile to unlock a verified Blink badge and stronger social proof.",
};

const verificationSteps = [
  {
    icon: Wallet,
    title: "Connect your wallet",
    description:
      "Start with the wallet you want attached to your Blink identity. No username is required.",
  },
  {
    icon: ShieldCheck,
    title: "Sign the ownership message",
    description:
      "Blink checks wallet ownership with a signature only. No blockchain transaction and no gas.",
  },
  {
    icon: BadgeCheck,
    title: "Authorize X",
    description:
      "Complete the X handshake and Blink will add a verified badge to your public profile.",
  },
];

const verificationPerks = [
  "Unlock an X-verified badge on your Blink profile",
  "Make your public profile feel more legit and shareable",
  "Feed curated Blink sightings when verification goes live in Discord",
];

export default function ProfileVerifyPage() {
  return (
    <main className="min-h-screen bg-[#060510] px-4 py-10 text-[#f4f7fb] sm:px-6 lg:px-8">
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(circle at 18% 18%, rgba(56,189,248,0.14), transparent 28%), radial-gradient(circle at 82% 16%, rgba(96,165,250,0.12), transparent 24%), radial-gradient(circle at 50% 75%, rgba(14,165,233,0.08), transparent 30%)",
        }}
      />

      <div className="relative mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,14,24,0.96),rgba(6,9,18,0.98))] p-7 shadow-[0_28px_100px_rgba(0,0,0,0.45)] sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#38bdf8]/20 bg-[#38bdf8]/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[#9bddff]">
            <Sparkles className="size-3.5" />
            Profile Verification
          </div>

          <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl">
            Verify your X profile and make your Blink identity feel real.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/68 sm:text-lg">
            This page is built for wallet-first users who do not have a custom
            username yet. Connect the wallet you trade with, verify your X
            account, and Blink will turn that wallet into a stronger public
            profile.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {verificationSteps.map(({ icon: Icon, title, description }) => (
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
              Why do this
            </p>
            <div className="mt-4 space-y-3">
              {verificationPerks.map((perk) => (
                <div
                  key={perk}
                  className="flex items-start gap-3 rounded-2xl border border-white/8 bg-[#020817]/45 px-4 py-3 text-sm text-white/72"
                >
                  <BadgeCheck className="mt-0.5 size-4 shrink-0 text-[#7dd3fc]" />
                  <span>{perk}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-[32px] border border-[#38bdf8]/15 bg-[linear-gradient(180deg,rgba(10,17,28,0.98),rgba(7,11,20,0.98))] p-7 shadow-[0_28px_100px_rgba(0,0,0,0.4)] sm:p-8">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/42">
            Start verification
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">
            Connect wallet, then connect X.
          </h2>
          <p className="mt-3 text-sm leading-6 text-white/62">
            The first click connects your wallet if needed. Once your wallet is
            ready, Blink will ask for a signature and then send you to X to
            finish the verification handshake.
          </p>

          <div className="mt-6 rounded-[24px] border border-white/10 bg-white/[0.04] p-4 sm:p-5">
            <ConnectTwitterButton
              className="w-full justify-center"
              connectWalletLabel="Connect wallet to start"
              claimLabel="Verify with X"
            />
            <p className="mt-3 text-center text-xs leading-5 text-white/40">
              No gas. No onchain transaction. Just wallet proof plus X OAuth.
            </p>
          </div>

          <div className="mt-6 rounded-[24px] border border-white/10 bg-[#020817]/50 p-5">
            <p className="text-sm font-semibold text-white">
              What happens next
            </p>
            <ol className="mt-4 space-y-3 text-sm text-white/62">
              <li>
                1. Blink stores the verified X connection for your wallet.
              </li>
              <li>2. Your public Blink profile gets stronger social proof.</li>
              <li>
                3. You can share that profile even before claiming a custom
                slug.
              </li>
            </ol>
          </div>

          <div className="mt-6 text-sm text-white/50">
            Already trading on Blink? Your profile can still live at a wallet
            address first and upgrade to a cleaner slug later.
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
