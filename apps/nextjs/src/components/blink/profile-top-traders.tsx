"use client";

import { useState } from "react";

import Link from "next/link";

import { useWallets } from "@privy-io/react-auth";
import { useQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";

import { formatUsd } from "~/lib/blink/markets";

// ─── Mock data (10 traders) — replace with live leaderboard endpoint ─────────

const TOP_TRADERS = [
  {
    rank: 1,
    name: "rokitg",
    handle: "rokitg.eth",
    address: "0xc7BcB2EeE9BbFbf875499960746Bc52B2E1A75C6",
    pnl24h: 284_197.43,
    winRate: 74,
    href: "/profile/rokitg",
  },
  {
    rank: 2,
    name: "RUNE",
    handle: "@rune_trades",
    address: "0x1234000000000000000000000000000000000002",
    pnl24h: 192_440.0,
    winRate: 69,
    href: "/profile/RUNE",
  },
  {
    rank: 3,
    name: "Marcell",
    handle: "@marcell_hl",
    address: "0x1234000000000000000000000000000000000003",
    pnl24h: 147_882.5,
    winRate: 66,
    href: "/profile/Marcell",
  },
  {
    rank: 4,
    name: "X Ventures",
    handle: "@xventures",
    address: "0x1234000000000000000000000000000000000004",
    pnl24h: 88_301.2,
    winRate: 62,
    href: "/profile/X Ventures",
  },
  {
    rank: 5,
    name: "allheart",
    handle: "@allheart_eth",
    address: "0x1234000000000000000000000000000000000005",
    pnl24h: 71_456.0,
    winRate: 61,
    href: "/profile/allheart",
  },
  {
    rank: 6,
    name: "hyperbird",
    handle: "@hyperbird",
    address: "0x1234000000000000000000000000000000000006",
    pnl24h: 53_220.75,
    winRate: 59,
    href: "/profile/hyperbird",
  },
  {
    rank: 7,
    name: "the red room",
    handle: "@redroom",
    address: "0x1234000000000000000000000000000000000007",
    pnl24h: 41_188.3,
    winRate: 57,
    href: "/profile/the red room",
  },
  {
    rank: 8,
    name: "velodrome",
    handle: "@velo_hl",
    address: "0x1234000000000000000000000000000000000008",
    pnl24h: 29_944.8,
    winRate: 55,
    href: "/profile/velodrome",
  },
  {
    rank: 9,
    name: "solstice",
    handle: "@solstice_x",
    address: "0x1234000000000000000000000000000000000009",
    pnl24h: 18_720.15,
    winRate: 53,
    href: "/profile/solstice",
  },
  {
    rank: 10,
    name: "nightowl",
    handle: "@nightowl",
    address: "0x1234000000000000000000000000000000000010",
    pnl24h: 11_050.0,
    winRate: 51,
    href: "/profile/nightowl",
  },
];

const RANK_MEDAL: Record<number, { emoji: string; glow: string }> = {
  1: { emoji: "🥇", glow: "rgba(255,215,0,0.25)" },
  2: { emoji: "🥈", glow: "rgba(192,192,192,0.18)" },
  3: { emoji: "🥉", glow: "rgba(205,127,50,0.18)" },
};

function avatarUrl(id: string) {
  return `https://avatar.vercel.sh/${encodeURIComponent(id)}.png?size=48`;
}

// ─── Single trader row ────────────────────────────────────────────────────────

function TraderRow({
  trader,
  viewerAddress,
}: {
  trader: (typeof TOP_TRADERS)[number];
  viewerAddress?: string;
}) {
  const medal = RANK_MEDAL[trader.rank];
  const isTop3 = trader.rank <= 3;

  // Per-trader follow state (local optimistic)
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(false);

  const followQuery = useQuery({
    queryKey: ["follow-status", trader.address, viewerAddress],
    queryFn: async () => {
      if (!viewerAddress) return { isFollowing: false };
      const params = new URLSearchParams({
        address: trader.address,
        viewer: viewerAddress,
      });
      const res = await fetch(`/api/follow?${params.toString()}`);
      return res.json() as Promise<{ isFollowing: boolean }>;
    },
    enabled: !!viewerAddress,
    staleTime: 60_000,
  });

  const isFollowing = followQuery.data?.isFollowing ?? following;

  async function handleFollow(e: React.MouseEvent) {
    e.preventDefault();
    if (!viewerAddress || loading) return;
    setLoading(true);
    setFollowing(!isFollowing);
    try {
      await fetch("/api/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          followerAddress: viewerAddress,
          followingAddress: trader.address,
        }),
      });
      void followQuery.refetch();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Link
      href={trader.href}
      className="group flex items-center gap-2.5 rounded-[10px] px-2 py-2 transition hover:bg-white/[0.04]"
      style={
        medal
          ? {
              background: `radial-gradient(ellipse at left, ${medal.glow}, transparent 60%)`,
            }
          : undefined
      }
    >
      {/* Rank */}
      <div className="w-5 shrink-0 text-center">
        {medal ? (
          <span className="text-sm leading-none">{medal.emoji}</span>
        ) : (
          <span className="text-[11px] text-white/30">{trader.rank}</span>
        )}
      </div>

      {/* Avatar */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={avatarUrl(trader.handle)}
        alt={trader.name}
        width={32}
        height={32}
        className="size-8 shrink-0 rounded-full ring-1 ring-white/10"
      />

      {/* Name + winrate */}
      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-sm font-semibold leading-tight ${isTop3 ? "text-white" : "text-white/80"}`}
        >
          {trader.name}
          {trader.rank === 1 && (
            <span className="ml-1.5 inline-flex items-center rounded-full border border-[#ffd70040] bg-[#ffd70018] px-1.5 py-px text-[8px] font-bold uppercase tracking-wide text-[#ffe566]">
              #1
            </span>
          )}
        </p>
        <p className="mt-0.5 text-[10px] text-white/35">
          {trader.winRate}% win rate
        </p>
      </div>

      {/* 24h PnL */}
      <div className="mr-1 shrink-0 text-right">
        <p className="font-mono text-xs font-semibold tabular-nums text-emerald-300">
          +{formatUsd(trader.pnl24h)}
        </p>
        <p className="text-[9px] text-white/25">24h</p>
      </div>

      {/* Follow button */}
      <button
        type="button"
        onClick={handleFollow}
        disabled={!viewerAddress || loading}
        className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition ${
          isFollowing
            ? "border border-white/10 bg-white/[0.05] text-white/55 hover:bg-white/[0.09]"
            : "bg-[#2c6bff] text-white hover:bg-[#2c6bff]/85"
        } disabled:opacity-40`}
      >
        {isFollowing ? "Following" : "Follow"}
      </button>
    </Link>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ProfileTopTraders() {
  const { wallets } = useWallets();
  const viewerAddress = wallets[0]?.address;

  return (
    <section className="rounded-[16px] border border-white/[0.08] bg-[#080d1a] p-3">
      {/* Header */}
      <div className="mb-2 flex items-center gap-2 px-1">
        <Trophy className="size-4 text-amber-300/70" />
        <h2 className="text-sm font-semibold text-white">Top Traders</h2>
        <span className="ml-auto text-[10px] text-white/30">24h PnL</span>
      </div>

      {/* Divider */}
      <div className="mb-1.5 h-px bg-white/[0.06]" />

      {/* Trader rows */}
      <div className="space-y-0.5">
        {TOP_TRADERS.map((trader) => (
          <TraderRow
            key={trader.rank}
            trader={trader}
            viewerAddress={viewerAddress}
          />
        ))}
      </div>

      <p className="mt-2 px-1 text-center text-[10px] text-white/20">
        Mock data · Live leaderboard coming soon
      </p>
    </section>
  );
}
