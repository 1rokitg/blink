"use client";

import { useEffect } from "react";

import Link from "next/link";

import { ArrowRight, Crown, Sparkles } from "lucide-react";

const TARGET_PROFILE = "/profile/rokitg";

export default function CeoProfileRedirectPage() {
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      window.location.replace(TARGET_PROFILE);
    }, 2600);

    return () => {
      window.clearTimeout(timeout);
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#060510] px-4 py-10 text-[#f2f4f7]">
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 20%, rgba(251,191,36,0.18), transparent 30%), radial-gradient(circle at 30% 30%, rgba(59,130,246,0.14), transparent 32%), radial-gradient(circle at 70% 35%, rgba(16,185,129,0.1), transparent 28%)",
        }}
      />

      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] max-w-3xl items-center justify-center">
        <div className="w-full rounded-[28px] border border-amber-300/20 bg-[linear-gradient(180deg,rgba(20,16,10,0.94),rgba(10,12,20,0.96))] p-8 shadow-[0_30px_120px_rgba(0,0,0,0.45)] backdrop-blur">
          <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-amber-100">
              <Crown className="size-4" />
              Executive Access
            </div>

            <div className="mt-6 inline-flex size-24 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 via-yellow-300 to-orange-400 text-[#2a1600] shadow-[0_20px_60px_rgba(245,158,11,0.35)]">
              <Sparkles className="size-10" />
            </div>

            <h1 className="mt-8 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
              You have requested an audience with the CEO.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-white/68 sm:text-lg">
              Routing your packet to the official Blink founder profile. Brace
              yourself for elite perps aura, builder-code energy, and
              dangerously high conviction.
            </p>

            <div className="mt-8 w-full max-w-xl rounded-[22px] border border-white/10 bg-white/[0.04] p-5 text-left">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-200">
                Crazy CTA
              </p>
              <p className="mt-3 text-2xl font-semibold text-white">
                Meet the man shipping your terminal in real time.
              </p>
              <p className="mt-2 text-sm leading-6 text-white/58">
                Proceed to the official founder profile to inspect the bags, the
                badges, and the source of truth.
              </p>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href={TARGET_PROFILE}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-300 via-yellow-300 to-orange-400 px-5 py-3 text-sm font-semibold text-[#2a1600] shadow-[0_14px_40px_rgba(245,158,11,0.3)] transition hover:brightness-105"
              >
                Take me to the CEO
                <ArrowRight className="size-4" />
              </Link>
              <p className="text-sm text-white/45">
                Auto-redirecting in a moment...
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
