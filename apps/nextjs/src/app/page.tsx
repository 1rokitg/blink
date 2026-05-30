"use client";

import { BadgeCheck, Disc } from "lucide-react";
import Link from "next/link";

import { motion } from "motion/react";

import { BLINK_TOKEN_ROUTE } from "~/lib/blink/token";

export default function HomePage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6 text-foreground">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(58,102,255,0.28),transparent_44%),radial-gradient(circle_at_78%_14%,rgba(39,198,181,0.23),transparent_42%),radial-gradient(circle_at_50%_78%,rgba(35,73,168,0.18),transparent_48%)] blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,8,24,0.12)_0%,rgba(2,8,24,0.42)_100%)]" />
      </div>

      <section className="relative z-10 flex w-full max-w-xl flex-col items-center text-center">
        <motion.div
          aria-hidden="true"
          className="text-7xl"
          initial={{ opacity: 1 }}
          animate={{ opacity: [1, 1, 0.3, 0, 0.3, 1, 1] }}
          transition={{
            duration: 1,
            times: [0, 0.35, 0.45, 0.525, 0.61, 0.7, 1],
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
          }}
        >
          👀
        </motion.div>

        <h1 className="mt-6 text-5xl font-semibold tracking-[-0.06em] text-white md:text-6xl">
          Blink
        </h1>
        <p className="mt-4 max-w-md text-base leading-7 text-foreground/65">
          Crypto moves can be missed in the blink of an eye. <br /> Meet your
          brand new Hyperliquid terminal.
        </p>

        <Link
          href="/pro"
          className="mt-9 inline-flex h-14 w-full items-center justify-center rounded-2xl border border-[#8fbaff80] bg-[linear-gradient(180deg,#3c76ff,#2457db)] px-8 text-base font-semibold text-white shadow-[0_22px_70px_rgba(37,90,224,0.5)] transition hover:scale-[1.01] hover:brightness-110"
        >
          Unlock Access
        </Link>
        <Link
          href="/trade/BTC"
          className="mt-3 text-sm text-foreground/55 underline-offset-4 transition hover:text-foreground/85 hover:underline"
        >
          Continue with free terminal
        </Link>
        <Link
          href="/profile/verify"
          className="mt-5 flex w-full items-start gap-3 rounded-2xl border border-[#6cc6ff33] bg-[linear-gradient(180deg,rgba(10,23,42,0.92),rgba(6,16,30,0.96))] px-4 py-4 text-left shadow-[0_18px_50px_rgba(0,0,0,0.25)] transition hover:border-[#6cc6ff66] hover:bg-[linear-gradient(180deg,rgba(12,28,50,0.96),rgba(7,20,36,0.98))]"
        >
          <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#38bdf8]/12 text-[#8ad9ff]">
            <BadgeCheck className="size-5" />
          </span>
          <span className="block">
            <span className="block text-sm font-semibold text-white">
              Verify your X profile
            </span>
            <span className="mt-1 block text-sm leading-6 text-foreground/60">
              Build a public Blink identity, unlock the verified badge, and make
              your profile easier to share.
            </span>
          </span>
        </Link>
        <Link
          href={BLINK_TOKEN_ROUTE}
          className="mt-4 flex w-full items-start gap-3 rounded-2xl border border-[#8fbaff44] bg-[linear-gradient(180deg,rgba(14,25,44,0.94),rgba(7,14,28,0.98))] px-4 py-4 text-left shadow-[0_18px_50px_rgba(0,0,0,0.28)] transition hover:border-[#8fbaff80] hover:bg-[linear-gradient(180deg,rgba(16,29,51,0.98),rgba(8,17,33,1))]"
        >
          <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#3b82f6]/12 text-[#9bddff]">
            <Disc className="size-5" />
          </span>
          <span className="block">
            <span className="block text-sm font-semibold text-white">
              BLINK token
            </span>
            <span className="mt-1 block text-sm leading-6 text-foreground/60">
              Support Blink&apos;s bootstrap budget and give the token a
              permanent home inside the app.
            </span>
          </span>
        </Link>
        <Link
          href="/invest"
          className="mt-2 text-sm text-[#8fb9ff] underline-offset-4 transition hover:text-[#b8d3ff] hover:underline"
        >
          Investor brief
        </Link>
        <a
          href="https://rokitg.fun"
          target="_blank"
          rel="noreferrer"
          className="mt-2 text-sm text-[#8fb9ff] underline-offset-4 transition hover:text-[#b8d3ff] hover:underline"
        >
          rokitg.fun
        </a>
        <p className="mt-6 text-xs text-foreground/45">
          Blink is not available to U.S. persons. U.S. will be dropped off.
          <a
            href="https://blink.us"
            target="_blank"
            rel="noreferrer"
            className="text-[#8fb9ff] underline-offset-4 hover:underline"
          >
            blink.us
          </a>
          .
        </p>
      </section>
    </main>
  );
}
