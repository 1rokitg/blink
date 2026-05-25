import type { Metadata } from "next";
import Link from "next/link";

export async function generateMetadata(props: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await props.params;
  const handle = decodeURIComponent(username);
  return {
    title: `${handle} · Blink`,
    description: `View ${handle}'s trading activity and performance on Blink — the social trading terminal for Hyperliquid.`,
    openGraph: {
      title: `${handle} on Blink`,
      description: `Check out ${handle}'s trades and performance on Hyperliquid.`,
      url: `https://blink.lat/profile/${handle}`,
    },
    twitter: {
      card: "summary_large_image",
      title: `${handle} on Blink`,
      description: `Check out ${handle}'s trades and performance on Hyperliquid.`,
    },
  };
}

import { CalendarDays, Gift, Pencil, Search, Verified } from "lucide-react";

import { BlinkAvatar } from "~/components/blink/blink-avatar";
import { BlinkUsername } from "~/components/blink/blink-username";
import { ConnectTwitterButton } from "~/components/blink/connect-twitter-button";
import { ProfileEquitySection } from "~/components/blink/profile-equity-section";
import { ProfileTopTraders } from "~/components/blink/profile-top-traders";
import { resolveProfileAddress } from "~/lib/blink/resolve-address";

export default async function ProfilePage(props: {
  params: Promise<{ username: string }>;
}) {
  const { username: rawUsername } = await props.params;
  const slug = decodeURIComponent(rawUsername);

  const resolvedAddress = await resolveProfileAddress(slug);

  // For the leaderboard mock (#1 slot), hardcode rokitg address
  const isRokitg = slug === "rokitg" || slug === "rokitg.eth";

  return (
    <main className="min-h-screen bg-background px-3 pb-8 pt-3 text-[#f2f4f7]">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-[1780px] grid-cols-[360px_1fr_320px] gap-4">
        {/* ── Left sidebar ────────────────────────────────── */}
        <aside className="flex min-h-[calc(100vh-7rem)] flex-col gap-2 self-start">
          <Link href={"/trade"}>
            <h1 className="text-5xl font-bold tracking-[-0.04em] text-white">
              blink
            </h1>
          </Link>
        </aside>

        {/* ── Main content ────────────────────────────────── */}
        <section className="min-w-0">
          {/* Search bar */}
          <div className="mb-2 flex h-[68px] items-center justify-center">
            <div className="relative w-full max-w-lg">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/45" />
              <input
                className="h-12 w-full rounded-[14px] border border-white/10 bg-[#0c101c] pl-9 pr-3 text-base outline-none placeholder:text-white/35"
                placeholder="Search wallets..."
              />
            </div>
          </div>

          {/* Profile card */}
          <section className="mx-auto w-full max-w-[980px] overflow-hidden rounded-[18px] bg-[radial-gradient(circle_at_20%_15%,rgba(43,128,255,0.06),transparent_45%),radial-gradient(circle_at_80%_30%,rgba(23,189,174,0.06),transparent_42%)] p-0">
            {/* Cover */}
            <div className="relative h-52 border-b border-white/10 bg-[radial-gradient(circle_at_20%_15%,rgba(43,128,255,0.3),transparent_45%),radial-gradient(circle_at_80%_30%,rgba(23,189,174,0.24),transparent_42%),linear-gradient(180deg,#0c1326,#0a1020)]" />

            {/* Avatar + name row */}
            <div className="relative z-10 -mt-14 px-3 pb-4">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex items-end gap-4">
                  <BlinkAvatar />
                  <div>
                    <BlinkUsername />
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-gradient-to-r from-amber-300/15 to-yellow-300/10 px-2.5 py-1 text-[10px] font-medium text-amber-200">
                      <Verified className="size-3" />
                      Blink Pro
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 pb-1">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/[0.10]"
                  >
                    <Pencil className="size-4" />
                    Edit profile
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#2c6bff] px-4 py-2 text-sm font-medium text-white hover:bg-[#2c6bff]/90"
                  >
                    <Gift className="size-4" />
                    Rewards
                  </button>
                </div>
              </div>

              <p className="mt-2 text-lg text-white/88">here to win.</p>

              {/* Twitter connect / verified badge */}
              <div className="mt-3">
                <ConnectTwitterButton
                  showSuccessCard={false}
                  targetWalletAddress={resolvedAddress ?? undefined}
                />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-5 text-sm text-white/55">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="size-4" />
                  {isRokitg ? "Joined Jan 2026" : "Joined recently"}
                </span>
                {resolvedAddress && (
                  <span className="font-mono text-xs text-white/35">
                    {resolvedAddress.slice(0, 6)}…{resolvedAddress.slice(-4)}
                  </span>
                )}
              </div>
            </div>

            {/* Equity + balances — live from HL + Neon */}
            <div className="border-t border-white/10 px-5 pb-3 pt-5">
              <ProfileEquitySection
                targetAddress={resolvedAddress ?? undefined}
              />

              <p className="mt-7 text-center text-sm text-white/35">
                Powered by Hyperliquid
              </p>
              <div className="mt-4 flex justify-center">
                <Link
                  href="/trade/BTC"
                  className="inline-flex items-center text-sm text-white/55 hover:text-white"
                >
                  Back to trading
                </Link>
              </div>
            </div>
          </section>
        </section>

        {/* ── Right sidebar ────────────────────────────────── */}
        <aside className="flex min-h-[calc(100vh-7rem)] flex-col gap-3 self-start">
          {/* Spacer to align with the search bar header */}
          <div className="h-[68px]" />
          <ProfileTopTraders />
        </aside>
      </div>
    </main>
  );
}
