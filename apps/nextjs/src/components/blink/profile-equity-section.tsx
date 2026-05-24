"use client";

import { useCallback, useState } from "react";

import Link from "next/link";

import { useWallets } from "@privy-io/react-auth";
import { useQuery } from "@tanstack/react-query";
import { Share2, Users } from "lucide-react";

import { Button } from "@acme/ui/button";

import { infoClient } from "~/lib/blink/hyperliquid";
import { formatUsd } from "~/lib/blink/markets";

import { PnlShareModal } from "./pnl-share-modal";
import { ProfileEquityChart } from "./profile-equity-chart";

type Period = "24H" | "7D" | "30D" | "ALL";

function SkeletonLine({ w }: { w: string }) {
  return <div className={`animate-pulse rounded-md bg-white/[0.07] ${w} h-7`} />;
}

function StatRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <p className="inline-flex items-center gap-2 text-2xl text-white/85">
        <span className="size-3 rounded-sm" style={{ backgroundColor: color }} />
        {label}
      </p>
      <p className="font-medium text-2xl text-white">{value}</p>
    </div>
  );
}

export function ProfileEquitySection({
  /** If provided, show this wallet's data (public profile). Falls back to Privy wallet. */
  targetAddress,
}: {
  targetAddress?: string;
}) {
  const { wallets } = useWallets();
  const ownAddress = wallets[0]?.address as `0x${string}` | undefined;
  const walletAddress = (
    targetAddress?.toLowerCase() ?? ownAddress?.toLowerCase()
  ) as `0x${string}` | undefined;

  const isOwnProfile =
    !targetAddress ||
    targetAddress.toLowerCase() === ownAddress?.toLowerCase();

  const [period, setPeriod] = useState<Period>("24H");
  const [shareOpen, setShareOpen] = useState(false);

  // ── Account state ─────────────────────────────────────────────────────────
  const accountQuery = useQuery({
    queryKey: ["blink", "profile-account", walletAddress],
    queryFn: async () => {
      if (!walletAddress) return null;
      const [state, openOrders] = await Promise.all([
        infoClient.clearinghouseState({ user: walletAddress }),
        infoClient.frontendOpenOrders({ user: walletAddress }),
      ]);
      return { state, openOrders };
    },
    enabled: !!walletAddress,
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

  // ── All-time realized PnL from fills ─────────────────────────────────────
  const fillsQuery = useQuery({
    queryKey: ["blink", "profile-fills", walletAddress],
    queryFn: async () => {
      if (!walletAddress) return [];
      const twoYearsAgo = Date.now() - 2 * 365 * 24 * 60 * 60 * 1000;
      const fills = await infoClient.userFillsByTime({
        user: walletAddress,
        startTime: twoYearsAgo,
      });
      return fills ?? [];
    },
    enabled: !!walletAddress,
    staleTime: 120_000,
    gcTime: 300_000,
  });

  // ── Follow counts from Neon ───────────────────────────────────────────────
  const followQuery = useQuery({
    queryKey: ["blink", "follow", walletAddress, ownAddress],
    queryFn: async () => {
      if (!walletAddress) return null;
      const params = new URLSearchParams({ address: walletAddress });
      if (ownAddress) params.set("viewer", ownAddress);
      const res = await fetch(`/api/follow?${params.toString()}`);
      return res.json() as Promise<{
        followers: number;
        following: number;
        isFollowing: boolean;
      }>;
    },
    enabled: !!walletAddress,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const [followLoading, setFollowLoading] = useState(false);
  const toggleFollow = useCallback(async () => {
    if (!ownAddress || !walletAddress || isOwnProfile) return;
    setFollowLoading(true);
    try {
      await fetch("/api/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          followerAddress: ownAddress,
          followingAddress: walletAddress,
        }),
      });
      void followQuery.refetch();
    } finally {
      setFollowLoading(false);
    }
  }, [ownAddress, walletAddress, isOwnProfile, followQuery]);

  // ── Derived values ────────────────────────────────────────────────────────
  const state = accountQuery.data?.state;
  const openOrders = accountQuery.data?.openOrders ?? [];
  const loading = accountQuery.isLoading;

  const accountValue = Number(state?.marginSummary?.accountValue ?? 0);
  const withdrawable = Number(state?.withdrawable ?? 0);
  const perpsMarginUsed = Number(state?.marginSummary?.totalMarginUsed ?? 0);
  const positions = state?.assetPositions ?? [];
  const activePositions = positions.filter((p) => Number(p.position.szi) !== 0);

  // Realized PnL = sum of closedPnl across all fills
  const totalRealizedPnl = (fillsQuery.data ?? []).reduce(
    (sum, fill) =>
      sum + Number((fill as { closedPnl?: string }).closedPnl ?? 0),
    0,
  );
  const recentFillsCount = fillsQuery.data?.length ?? 0;

  // Allocation breakdown
  const spotWalletValue = Math.max(withdrawable, 0);
  const perpsValue = Math.max(perpsMarginUsed, 0);
  const stakingValue = Math.max(accountValue - spotWalletValue - perpsValue, 0);
  const allocTotal = Math.max(
    spotWalletValue + perpsValue + stakingValue,
    1,
  );
  const spotPct = (spotWalletValue / allocTotal) * 100;
  const perpsPct = (perpsValue / allocTotal) * 100;
  const stakingPct = (stakingValue / allocTotal) * 100;
  const pendingOrderNotional = openOrders.reduce(
    (sum, order) =>
      sum +
      Number(order.limitPx || 0) * Math.abs(Number(order.sz || 0)),
    0,
  );

  const follows = followQuery.data;

  return (
    <section>
      {/* Equity header + follow counts */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xl text-white/70">Total Equity</p>
          {loading ? (
            <div className="mt-2 space-y-2">
              <SkeletonLine w="w-56" />
              <SkeletonLine w="w-32" />
            </div>
          ) : (
            <>
              <h2 className="mt-1 text-6xl font-semibold">
                {formatUsd(accountValue)}
              </h2>
              <p
                className={`mt-1 text-2xl ${totalRealizedPnl >= 0 ? "text-emerald-300" : "text-rose-300"}`}
              >
                {totalRealizedPnl >= 0 ? "+" : ""}
                {formatUsd(totalRealizedPnl)} realized PnL
              </p>
            </>
          )}
        </div>

        {follows && (
          <div className="flex shrink-0 items-center gap-5 pt-2 text-sm text-white/55">
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-4" />
              <strong className="font-semibold text-white">
                {follows.followers}
              </strong>{" "}
              followers
            </span>
            <span>
              <strong className="font-semibold text-white">
                {follows.following}
              </strong>{" "}
              following
            </span>
          </div>
        )}
      </div>

      {/* Period selector + chart */}
      <div className="mt-4">
        <div className="inline-flex h-11 w-full items-center gap-1 rounded-[12px] bg-white/[0.02] p-1">
          <span className="mr-auto truncate px-2 font-mono text-sm text-white/65">
            {walletAddress
              ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`
              : "—"}
          </span>
          {(["24H", "7D", "30D", "ALL"] as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`rounded-[8px] px-2.5 py-1 text-base transition ${
                period === p
                  ? "bg-white/[0.09] text-white"
                  : "text-white/55 hover:text-white/80"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <ProfileEquityChart className="mt-3 h-[340px] rounded-[12px]" />
      </div>

      {/* Action buttons */}
      <div className="mt-4 flex flex-row justify-between gap-3">
        {isOwnProfile ? (
          <>
            <Button
              asChild
              className="h-11 w-full rounded-xl bg-[#2c6bff] px-5 text-sm font-semibold hover:bg-[#2c6bff]/90"
            >
              <Link href="/deposit">Deposit</Link>
            </Button>
            <Button className="h-11 w-full rounded-xl bg-[#2c6bff] px-5 text-sm font-semibold hover:bg-[#2c6bff]/90">
              Send
            </Button>
            <Button
              variant="destructive"
              className="h-11 w-full rounded-xl px-5 text-sm font-semibold"
            >
              Withdraw
            </Button>
            <Button
              onClick={() => setShareOpen(true)}
              variant="outline"
              className="h-11 w-full rounded-xl border-white/10 bg-white/[0.04] px-5 text-sm font-semibold text-white hover:bg-white/[0.09]"
            >
              <Share2 className="size-4" />
              Share PnL
            </Button>
          </>
        ) : (
          <>
            <Button
              asChild
              className="h-11 flex-1 rounded-xl bg-[#2c6bff] px-5 text-sm font-semibold hover:bg-[#2c6bff]/90"
            >
              <Link href="/trade">Copy trade</Link>
            </Button>
            <Button
              onClick={() => void toggleFollow()}
              disabled={followLoading || !ownAddress}
              className={`h-11 flex-1 rounded-xl px-5 text-sm font-semibold ${
                follows?.isFollowing
                  ? "border border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.09]"
                  : "bg-[#2c6bff] text-white hover:bg-[#2c6bff]/90"
              }`}
            >
              {follows?.isFollowing ? "Following" : "Follow"}
            </Button>
            <Button
              onClick={() => setShareOpen(true)}
              variant="outline"
              className="h-11 flex-1 rounded-xl border-white/10 bg-white/[0.04] px-5 text-sm font-semibold text-white hover:bg-white/[0.09]"
            >
              <Share2 className="size-4" />
              Share
            </Button>
          </>
        )}
      </div>

      {/* Allocation bar */}
      <div className="mt-5 h-4 overflow-hidden rounded bg-white/[0.06]">
        <div className="flex h-full w-full">
          <div
            className="bg-[#2c6bff] transition-all duration-500"
            style={{ width: `${spotPct}%` }}
          />
          <div
            className="bg-[#41d38f] transition-all duration-500"
            style={{ width: `${perpsPct}%` }}
          />
          <div
            className="bg-[#2b8dcc] transition-all duration-500"
            style={{ width: `${stakingPct}%` }}
          />
        </div>
      </div>

      {/* Live balance rows */}
      <div className="mt-4 space-y-2.5">
        <StatRow
          label="Spot wallet"
          value={formatUsd(spotWalletValue)}
          color="#2c6bff"
        />
        <StatRow
          label="Perps margin"
          value={formatUsd(perpsValue)}
          color="#41d38f"
        />
        <StatRow
          label="Staking / vaults"
          value={formatUsd(stakingValue)}
          color="#2b8dcc"
        />
        <StatRow
          label="Pending orders (notional)"
          value={formatUsd(pendingOrderNotional)}
          color="#788395"
        />
      </div>

      <p className="mt-2 text-xs text-white/35">
        Realized PnL sums all closed fills. Equity includes spot + perps margin +
        staking.
      </p>

      {/* Open positions */}
      {!loading && activePositions.length > 0 && (
        <div className="mt-6">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.14em] text-white/40">
            Open positions ({activePositions.length})
          </p>
          <div className="space-y-2">
            {activePositions.map(({ position }) => {
              const pnl = Number(position.unrealizedPnl);
              const size = Number(position.szi);
              return (
                <div
                  key={position.coin}
                  className="flex items-center justify-between rounded-[10px] bg-white/[0.03] px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-white">{position.coin}</p>
                    <p className="text-sm text-white/50">
                      {size > 0 ? "Long" : "Short"}{" "}
                      {Math.abs(size).toFixed(4)} @ {position.entryPx}
                    </p>
                  </div>
                  <p
                    className={`text-sm font-medium ${pnl >= 0 ? "text-emerald-300" : "text-rose-300"}`}
                  >
                    {pnl >= 0 ? "+" : ""}
                    {formatUsd(pnl)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!loading && !walletAddress && (
        <p className="mt-6 text-center text-sm text-white/35">
          Connect a wallet to see your live account.
        </p>
      )}

      {/* PnL share modal */}
      {walletAddress && (
        <PnlShareModal
          type="portfolio"
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          data={{
            walletAddress,
            accountValue,
            totalRealizedPnl,
            openPositions: activePositions.length,
            recentFills: recentFillsCount,
          }}
        />
      )}
    </section>
  );
}
