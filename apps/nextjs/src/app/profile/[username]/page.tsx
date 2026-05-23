import Link from "next/link";

import {
  CalendarDays,
  Clock3,
  ChevronRight,
  Dot,
  Gift,
  Info,
  Pencil,
  Search,
  ShieldCheck,
  Trophy,
} from "lucide-react";

import { BlinkAvatar } from "~/components/blink/blink-avatar";
import { ProfileEquityChart } from "~/components/blink/profile-equity-chart";
import { Button } from "@acme/ui/button";

function traderAvatarUrl(id: string, size = 80) {
  return `https://avatar.vercel.sh/${encodeURIComponent(id)}.png?size=${size}`;
}

export default async function ProfilePage(props: {
  params: Promise<{ username: string }>;
}) {
  const { username: rawUsername } = await props.params;
  const username = decodeURIComponent(rawUsername);

  return (
    <main className="min-h-screen bg-background px-3 pb-8 pt-3 text-[#f2f4f7]">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-[1780px] grid-cols-[360px_1fr_320px] gap-4">

        {/* ── Left sidebar ────────────────────────────────── */}
        <aside className="flex min-h-[calc(100vh-7rem)] flex-col gap-2 self-start">
          <div className="flex h-[68px] items-end px-1 py-1">
            <h1 className="text-5xl font-bold tracking-[-0.04em] text-white">
              blink
            </h1>
          </div>
        </aside>

        {/* ── Main content ────────────────────────────────── */}
        <section className="min-w-0">
          {/* Search bar */}
          <div className="mb-2 flex h-[68px] items-center justify-center">
            <div className="relative w-full max-w-lg">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/45" />
              <input
                className="h-12 w-full rounded-[14px] border border-white/10 bg-[#0c101c] pl-9 pr-3 text-base outline-none placeholder:text-white/35"
                placeholder="Search profile assets..."
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
                  <BlinkAvatar username={username} />
                  <div className="pb-1">
                    <p className="text-4xl font-semibold text-white">{username}</p>
                    <p className="text-lg text-white/55">@{username.toLowerCase()}</p>
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
              <div className="mt-3 flex flex-wrap items-center gap-5 text-sm text-white/55">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="size-4 text-[#7fa8ff]" />
                  Verified trader
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 className="size-4" />
                  14h avg. hold
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="size-4" />
                  Joined Jan 2026
                </span>
                <span className="text-white/35">|</span>
                <span className="text-white/90">
                  <strong className="font-semibold">108</strong> Followers
                </span>
                <span className="text-white/90">
                  <strong className="font-semibold">21</strong> Following
                </span>
              </div>
            </div>

            {/* Equity + balances */}
            <div className="border-t border-white/10 px-5 pb-3 pt-5">
              <section>
                <p className="text-xl text-white/70">Total Equity</p>
                <h2 className="mt-1 text-6xl font-semibold">$114.30 USD</h2>
                <p className="mt-1 text-2xl text-rose-300">-$0.64 · 24h</p>

                <div className="mt-4">
                  {/* Time period selector */}
                  <div className="inline-flex h-11 w-full items-center justify-end gap-1 rounded-[12px] bg-white/[0.02] p-1">
                    <span className="mr-auto flex items-center gap-2 px-2 text-base text-white/65">
                      <Wallet className="size-4 opacity-54" />
                      {username}
                    </span>
                    {["24H", "7D", "30D", "ALL"].map((period, i) => (
                      <button
                        key={period}
                        type="button"
                        className={`rounded-[8px] px-2.5 py-1 text-base ${i === 0 ? "bg-white/[0.09] text-white" : "text-white/55"}`}
                      >
                        {period}
                      </button>
                    ))}
                  </div>
                  <ProfileEquityChart className="mt-3 h-[340px] rounded-[12px]" />
                </div>

                <div className="mt-4 flex flex-row justify-between gap-3">
                  <Button className="h-11 w-full rounded-xl bg-[#2c6bff] px-5 text-sm font-semibold hover:bg-[#2c6bff]/90">
                    Deposit
                  </Button>
                  <Button className="h-11 w-full rounded-xl bg-[#2c6bff] px-5 text-sm font-semibold hover:bg-[#2c6bff]/90">
                    Send
                  </Button>
                  <Button variant="destructive" className="h-11 w-full rounded-xl px-5 text-sm font-semibold">
                    Withdraw
                  </Button>
                </div>

                {/* Allocation bar */}
                <div className="mt-5 h-4 overflow-hidden rounded bg-[#2b8dcc]">
                  <div className="flex h-full w-full">
                    <div className="w-[26%] bg-[#41d38f]" />
                    <div className="w-[34%] bg-[#2c6bff]" />
                  </div>
                </div>

                <div className="mt-4 space-y-2.5 text-2xl">
                  {[
                    ["Perps", "$29.72", "#41d38f"],
                    ["Spot", "$38.86", "#2c6bff"],
                    ["Staking", "$25.15", "#2b8dcc"],
                  ].map(([label, value, color]) => (
                    <div key={label} className="flex items-center justify-between">
                      <p className="inline-flex items-center gap-2 text-white/85">
                        <span className="size-3 rounded-sm" style={{ backgroundColor: color }} />
                        {label}
                      </p>
                      <p className="font-medium text-white">{value}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Tabs */}
              <div className="mt-8 border-b border-white/10">
                <div className="flex items-center gap-8 text-2xl">
                  <button type="button" className="border-b-2 border-[#276cff] pb-3 text-white">
                    Balances
                  </button>
                  <button type="button" className="pb-3 text-white/45">
                    All activity
                  </button>
                  <button type="button" className="pb-3 text-white/45">
                    Withdrawals
                  </button>
                </div>
              </div>

              {/* Balance rows */}
              <div className="mt-5 space-y-3">
                {[
                  ["Cash", "USDC", "$13.10"],
                  ["Positions", "Exposure", "$1.74"],
                  ["Spot", "USDT · Bitcoin · Gold", "$99.46"],
                ].map(([title, sub, value]) => (
                  <div key={title} className="rounded-[10px] bg-white/[0.02] p-4">
                    <p className="text-4xl font-semibold">{title}</p>
                    <div className="mt-4 flex items-center justify-between">
                      <p className="text-2xl text-white/80">{sub}</p>
                      <div className="flex items-center gap-3">
                        <p className="text-2xl font-medium">{value}</p>
                        <ChevronRight className="size-4 text-white/45" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <p className="mt-7 text-center text-sm text-white/35">Powered by Hyperliquid</p>
              <div className="mt-4 flex justify-center">
                <Link href="/trade/BTC" className="inline-flex items-center text-sm text-white/55 hover:text-white">
                  <Dot className="size-4" />
                  Back to trading
                </Link>
              </div>
            </div>
          </section>
        </section>

        {/* ── Right sidebar ────────────────────────────────── */}
        <aside className="flex min-h-[calc(100vh-7rem)] flex-col gap-2 self-start">
          <div className="flex h-[68px] items-end px-1 py-1" />
          <section className="glass-panel p-3.5">
            <div className="mb-3 flex items-center gap-2">
              <Trophy className="size-4 text-white/70" />
              <h2 className="text-lg font-semibold text-white">Follow top traders</h2>
            </div>
            <div className="space-y-2">
              {["RUNE", "Marcell", "X Ventures", "the red room", "allheart"].map((name) => (
                <div
                  key={name}
                  className="flex items-center justify-between rounded-[10px] border border-white/8 bg-white/[0.02] px-2.5 py-2"
                >
                  <div className="flex items-center gap-2">
                    <img
                      src={traderAvatarUrl(name, 48)}
                      alt={name}
                      className="size-8 rounded-full border border-white/20"
                    />
                    <span className="text-sm text-white/85">{name}</span>
                  </div>
                  <button
                    type="button"
                    className="rounded-lg bg-[#2c6bff] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#2c6bff]/90"
                  >
                    Follow
                  </button>
                </div>
              ))}
            </div>
          </section>
          <section className="glass-panel p-3.5">
            <div className="mb-2 flex items-center gap-2">
              <Info className="size-4 text-white/70" />
              <h3 className="text-sm font-medium text-white/90">Status</h3>
            </div>
            <p className="text-sm text-emerald-300">Online</p>
            <p className="mt-1 text-xs text-white/45">All trading services operational.</p>
          </section>
        </aside>
      </div>
    </main>
  );
}

// Inline icon to avoid adding another import just for the wallet icon
function Wallet({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3" />
    </svg>
  );
}
