"use client";

import { useState } from "react";

import Link from "next/link";

import { useWallets } from "@privy-io/react-auth";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@acme/ui/button";

import { infoClient } from "~/lib/blink/hyperliquid";
import { formatUsd } from "~/lib/blink/markets";

import { ProfileEquityChart } from "./profile-equity-chart";

type Period = "24H" | "7D" | "30D" | "ALL";

function SkeletonLine({ w }: { w: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-white/[0.07] ${w} h-7`}
    />
  );
}

export function ProfileEquitySection() {
  const { wallets } = useWallets();
  const walletAddress = wallets[0]?.address as `0x${string}` | undefined;
  const [period, setPeriod] = useState<Period>("24H");

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

  const state = accountQuery.data?.state;
  const openOrders = accountQuery.data?.openOrders ?? [];
  const loading = accountQuery.isLoading;

  const accountValue = Number(state?.marginSummary?.accountValue ?? 0);
  const totalPnl = Number(state?.marginSummary?.totalRawUsd ?? 0);
  const withdrawable = Number(state?.withdrawable ?? 0);
  const perpsMarginUsed = Number(state?.marginSummary?.totalMarginUsed ?? 0);
  const positions = state?.assetPositions ?? [];
  const activePositions = positions.filter(
    (p) => Number(p.position.szi) !== 0,
  );

  // Hyperliquid allocations mapped to whop-like sections:
  // - Spot wallet: withdrawable balance
  // - Perps margin: currently used margin
  // - Staking/vaults: residual equity not immediately withdrawable or in perps margin
  // - Pending orders: displayed as notional (execution intent), not included in equity bar total
  const pendingOrderNotional = openOrders.reduce(
    (sum, order) => sum + Number(order.limitPx || 0) * Math.abs(Number(order.sz || 0)),
    0,
  );

  const spotWalletValue = Math.max(withdrawable, 0);
  const perpsValue = Math.max(perpsMarginUsed, 0);
  const stakingValue = Math.max(accountValue - spotWalletValue - perpsValue, 0);

  const allocTotal = Math.max(spotWalletValue + perpsValue + stakingValue, 1);
  const spotPct = (spotWalletValue / allocTotal) * 100;
  const perpsPct = (perpsValue / allocTotal) * 100;
  const stakingPct = (stakingValue / allocTotal) * 100;

  return (
    <section>
      {/* Equity header */}
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
            className={`mt-1 text-2xl ${totalPnl >= 0 ? "text-emerald-300" : "text-rose-300"}`}
          >
            {totalPnl >= 0 ? "+" : ""}
            {formatUsd(totalPnl)} raw PnL
          </p>
        </>
      )}

      {/* Period selector + chart */}
      <div className="mt-4">
        <div className="inline-flex h-11 w-full items-center gap-1 rounded-[12px] bg-white/[0.02] p-1">
          <span className="mr-auto flex items-center gap-2 px-2 text-base text-white/65 font-mono text-sm truncate">
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
                period === p ? "bg-white/[0.09] text-white" : "text-white/55 hover:text-white/80"
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

      <div className="mt-4 space-y-2.5 text-2xl">
        {[
          ["Spot wallet", formatUsd(spotWalletValue), "#2c6bff"],
          ["Perps margin", formatUsd(perpsValue), "#41d38f"],
          ["Staking / vaults", formatUsd(stakingValue), "#2b8dcc"],
          ["Pending orders (notional)", formatUsd(pendingOrderNotional), "#788395"],
        ].map(([label, value, color]) => (
          <div key={label} className="flex items-center justify-between">
            <p className="inline-flex items-center gap-2 text-white/85">
              <span
                className="size-3 rounded-sm"
                style={{ backgroundColor: color }}
              />
              {label}
            </p>
            <p className="font-medium text-white">{value}</p>
          </div>
        ))}
      </div>

      <p className="mt-2 text-xs text-white/35">
        Equity includes Spot + Perps margin + Staking. Pending orders are shown
        as notional exposure.
      </p>

      {/* Open positions list */}
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
    </section>
  );
}
