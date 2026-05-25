"use client";

import { type ReactNode, useCallback, useState } from "react";

import Link from "next/link";

import { useWallets } from "@privy-io/react-auth";
import { useQuery } from "@tanstack/react-query";
import { Share2, Users } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@acme/ui/accordion";
import { Button } from "@acme/ui/button";

import {
  maskNumberish,
  maskValue,
  useHideBalances,
} from "~/lib/blink/hide-balances";
import { infoClient } from "~/lib/blink/hyperliquid";
import { formatUsd } from "~/lib/blink/markets";

import { PnlShareModal } from "./pnl-share-modal";
import { ProfileEquityChart } from "./profile-equity-chart";

type Period = "24H" | "7D" | "30D" | "ALL";

function SkeletonLine({ w }: { w: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-white/[0.07] ${w} h-7`} />
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-white/52">{label}</p>
      <p className="font-mono text-sm text-white/82">{value}</p>
    </div>
  );
}

function formatTokenAmount(value: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(value);
}

function formatTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function BreakdownRow({
  itemValue,
  label,
  meta,
  value,
  color,
  children,
}: {
  itemValue: string;
  label: string;
  meta: string;
  value: string;
  color: string;
  children: ReactNode;
}) {
  return (
    <AccordionItem
      value={itemValue}
      className="overflow-hidden rounded-[14px] border border-white/[0.07] bg-white/[0.025] px-4"
      style={{ borderLeft: `2px solid ${color}66` }}
    >
      <AccordionTrigger className="py-3 hover:no-underline">
        <div className="flex flex-1 items-center justify-between gap-3 pr-4">
          <div className="min-w-0 text-left">
            <p className="inline-flex items-center gap-2 text-xl text-white/88">
              <span
                className="size-3 rounded-sm"
                style={{ backgroundColor: color }}
              />
              {label}
            </p>
            <p className="mt-1 text-xs text-white/42">{meta}</p>
          </div>
          <p className="shrink-0 text-right text-2xl font-medium text-white">
            {value}
          </p>
        </div>
      </AccordionTrigger>
      <AccordionContent className="border-t border-white/[0.06] pb-4 pt-3">
        {children}
      </AccordionContent>
    </AccordionItem>
  );
}

export function ProfileEquitySection({
  /** If provided, show this wallet's data (public profile). Falls back to Privy wallet. */
  targetAddress,
}: {
  targetAddress?: string | null;
}) {
  const { wallets } = useWallets();
  const ownAddress = wallets[0]?.address as `0x${string}` | undefined;
  const hasExplicitTarget = targetAddress !== undefined;
  const normalizedTargetAddress = targetAddress?.toLowerCase() as
    | `0x${string}`
    | undefined;
  const walletAddress = hasExplicitTarget
    ? normalizedTargetAddress
    : (ownAddress?.toLowerCase() as `0x${string}` | undefined);

  const isOwnProfile = hasExplicitTarget
    ? normalizedTargetAddress === ownAddress?.toLowerCase()
    : true;

  const [period, setPeriod] = useState<Period>("24H");
  const [shareOpen, setShareOpen] = useState(false);
  const { hideBalances } = useHideBalances();

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

  const assetLocationQuery = useQuery({
    queryKey: ["blink", "profile-asset-locations", walletAddress],
    queryFn: async () => {
      if (!walletAddress) return null;
      const [spot, stakingSummary, delegations] = await Promise.all([
        infoClient.spotClearinghouseState({ user: walletAddress }),
        infoClient.delegatorSummary({ user: walletAddress }),
        infoClient.delegations({ user: walletAddress }),
      ]);
      return { spot, stakingSummary, delegations };
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
  const allocTotal = Math.max(spotWalletValue + perpsValue + stakingValue, 1);
  const spotPct = (spotWalletValue / allocTotal) * 100;
  const perpsPct = (perpsValue / allocTotal) * 100;
  const stakingPct = (stakingValue / allocTotal) * 100;
  const pendingOrderNotional = openOrders.reduce(
    (sum, order) =>
      sum + Number(order.limitPx || 0) * Math.abs(Number(order.sz || 0)),
    0,
  );
  const totalUnrealizedPnl = activePositions.reduce(
    (sum, { position }) => sum + Number(position.unrealizedPnl ?? 0),
    0,
  );
  const openOrderCount = openOrders.length;
  const spotBalances = assetLocationQuery.data?.spot?.balances ?? [];
  const spotEscrows = assetLocationQuery.data?.spot?.evmEscrows ?? [];
  const stakingSummary = assetLocationQuery.data?.stakingSummary;
  const stakingDelegations = assetLocationQuery.data?.delegations ?? [];
  const spotMeta =
    spotBalances.length > 0 || spotEscrows.length > 0
      ? `${spotBalances.length} spot asset${spotBalances.length === 1 ? "" : "s"}${spotEscrows.length ? ` • ${spotEscrows.length} escrowed` : ""}`
      : `${spotPct.toFixed(0)}% of account value`;
  const stakingMeta = stakingSummary
    ? `${stakingDelegations.length} validator${stakingDelegations.length === 1 ? "" : "s"} • ${stakingSummary.nPendingWithdrawals} pending withdrawal${stakingSummary.nPendingWithdrawals === 1 ? "" : "s"}`
    : `${stakingPct.toFixed(0)}% of account value`;

  const follows = followQuery.data;

  return (
    <section>
      {/* Equity header + follow counts */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xl text-white/70">Account value</p>
          {loading ? (
            <div className="mt-2 space-y-2">
              <SkeletonLine w="w-56" />
              <SkeletonLine w="w-32" />
            </div>
          ) : (
            <>
              <h2 className="mt-1 text-6xl font-semibold">
                {maskNumberish(accountValue, formatUsd, hideBalances)}
              </h2>
              <p
                className={`mt-1 text-2xl ${totalRealizedPnl >= 0 ? "text-emerald-300" : "text-rose-300"}`}
              >
                {totalRealizedPnl >= 0 ? "+" : ""}
                {maskNumberish(totalRealizedPnl, formatUsd, hideBalances)}{" "}
                realized PnL
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
      <div className="mt-4">
        {loading ? (
          <div className="space-y-2.5">
            <SkeletonLine w="w-full" />
            <SkeletonLine w="w-full" />
            <SkeletonLine w="w-full" />
            <SkeletonLine w="w-full" />
          </div>
        ) : (
          <Accordion type="single" collapsible className="space-y-2.5">
            <BreakdownRow
              itemValue="spot"
              label="Spot wallet"
              meta={spotMeta}
              value={maskNumberish(spotWalletValue, formatUsd, hideBalances)}
              color="#2c6bff"
            >
              <div className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <DetailRow
                    label="Withdrawable balance"
                    value={maskNumberish(withdrawable, formatUsd, hideBalances)}
                  />
                  <DetailRow
                    label="Share of total equity"
                    value={`${spotPct.toFixed(1)}%`}
                  />
                </div>

                {spotBalances.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-white/35">
                      Spot balances
                    </p>
                    {spotBalances.map((balance) => {
                      const total = Number(balance.total);
                      const hold = Number(balance.hold);
                      const available = Math.max(total - hold, 0);

                      return (
                        <div
                          key={`${balance.token}-${balance.coin}`}
                          className="rounded-[12px] border border-white/[0.06] bg-white/[0.03] px-4 py-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-medium text-white">
                              {balance.coin}
                            </p>
                            <p className="font-mono text-sm text-white/82">
                              {maskValue(
                                `${formatTokenAmount(total)} ${balance.coin}`,
                                hideBalances,
                              )}
                            </p>
                          </div>
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            <DetailRow
                              label="Available"
                              value={maskValue(
                                `${formatTokenAmount(available)} ${balance.coin}`,
                                hideBalances,
                              )}
                            />
                            <DetailRow
                              label="On hold"
                              value={maskValue(
                                `${formatTokenAmount(hold)} ${balance.coin}`,
                                hideBalances,
                              )}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-white/42">
                    No spot balances tracked in spot clearinghouse state.
                  </p>
                )}

                {spotEscrows.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-white/35">
                      Escrowed balances
                    </p>
                    {spotEscrows.map((escrow) => (
                      <div
                        key={`${escrow.token}-${escrow.coin}`}
                        className="flex items-center justify-between rounded-[12px] border border-white/[0.06] bg-white/[0.03] px-4 py-3"
                      >
                        <p className="font-medium text-white">{escrow.coin}</p>
                        <p className="font-mono text-sm text-white/82">
                          {maskValue(
                            `${formatTokenAmount(Number(escrow.total))} ${escrow.coin}`,
                            hideBalances,
                          )}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}

                <DetailRow
                  label="Tracked asset buckets"
                  value={String(spotBalances.length + spotEscrows.length)}
                />
                <p className="text-xs text-white/42">
                  Spot clearinghouse data reports token balances plus escrowed
                  balances separately.
                </p>
              </div>
            </BreakdownRow>

            <BreakdownRow
              itemValue="perps"
              label="Perps margin"
              meta={`${activePositions.length} open positions${openOrders.length ? ` • ${openOrders.length} working orders` : ""}`}
              value={maskNumberish(perpsValue, formatUsd, hideBalances)}
              color="#41d38f"
            >
              <div className="space-y-4">
                <div className="grid gap-2 sm:grid-cols-3">
                  <DetailRow
                    label="Margin used"
                    value={maskNumberish(
                      perpsMarginUsed,
                      formatUsd,
                      hideBalances,
                    )}
                  />
                  <DetailRow
                    label="Unrealized PnL"
                    value={maskNumberish(
                      totalUnrealizedPnl,
                      formatUsd,
                      hideBalances,
                    )}
                  />
                  <DetailRow
                    label="Open positions"
                    value={String(activePositions.length)}
                  />
                </div>

                {activePositions.length > 0 ? (
                  <div className="space-y-2">
                    {activePositions.map(({ position }) => {
                      const pnl = Number(position.unrealizedPnl);
                      const size = Number(position.szi);
                      const entry = Number(position.entryPx);
                      const positionValue = Number(position.positionValue);
                      const leverage = Number(position.leverage?.value ?? 1);

                      return (
                        <div
                          key={`${position.coin}-${position.entryPx}`}
                          className="rounded-[12px] border border-white/[0.06] bg-white/[0.03] px-4 py-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-medium text-white">
                                {position.coin}
                              </p>
                              <p className="mt-1 text-xs text-white/45">
                                {size > 0 ? "Long" : "Short"}{" "}
                                {Math.abs(size).toFixed(4)} @{" "}
                                {hideBalances ? "••••" : formatUsd(entry)}
                              </p>
                            </div>
                            <p
                              className={`text-sm font-medium ${
                                pnl >= 0 ? "text-emerald-300" : "text-rose-300"
                              }`}
                            >
                              {pnl >= 0 ? "+" : ""}
                              {maskNumberish(pnl, formatUsd, hideBalances)}
                            </p>
                          </div>
                          <div className="mt-3 grid gap-2 text-xs text-white/50 sm:grid-cols-3">
                            <DetailRow
                              label="Position value"
                              value={maskNumberish(
                                positionValue,
                                formatUsd,
                                hideBalances,
                              )}
                            />
                            <DetailRow
                              label="Leverage"
                              value={`${leverage.toFixed(1)}x`}
                            />
                            <DetailRow
                              label="Entry price"
                              value={maskNumberish(
                                entry,
                                formatUsd,
                                hideBalances,
                              )}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-white/42">
                    No open positions right now.
                  </p>
                )}
              </div>
            </BreakdownRow>

            <BreakdownRow
              itemValue="staking"
              label="Staking / vaults"
              meta={stakingMeta}
              value={maskNumberish(stakingValue, formatUsd, hideBalances)}
              color="#2b8dcc"
            >
              <div className="space-y-3">
                {stakingSummary ? (
                  <>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <DetailRow
                        label="Delegated"
                        value={maskValue(
                          `${formatTokenAmount(Number(stakingSummary.delegated))} HYPE`,
                          hideBalances,
                        )}
                      />
                      <DetailRow
                        label="Undelegated"
                        value={maskValue(
                          `${formatTokenAmount(Number(stakingSummary.undelegated))} HYPE`,
                          hideBalances,
                        )}
                      />
                      <DetailRow
                        label="Pending withdrawal"
                        value={maskValue(
                          `${formatTokenAmount(
                            Number(stakingSummary.totalPendingWithdrawal),
                          )} HYPE`,
                          hideBalances,
                        )}
                      />
                      <DetailRow
                        label="Pending requests"
                        value={String(stakingSummary.nPendingWithdrawals)}
                      />
                    </div>

                    {stakingDelegations.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs font-medium uppercase tracking-[0.14em] text-white/35">
                          Validator delegations
                        </p>
                        {stakingDelegations.map((delegation) => (
                          <div
                            key={delegation.validator}
                            className="rounded-[12px] border border-white/[0.06] bg-white/[0.03] px-4 py-3"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="font-mono text-xs text-white/62">
                                {delegation.validator.slice(0, 6)}…
                                {delegation.validator.slice(-4)}
                              </p>
                              <p className="font-mono text-sm text-white/82">
                                {maskValue(
                                  `${formatTokenAmount(Number(delegation.amount))} HYPE`,
                                  hideBalances,
                                )}
                              </p>
                            </div>
                            <p className="mt-2 text-xs text-white/42">
                              Locked until{" "}
                              {formatTimestamp(delegation.lockedUntilTimestamp)}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {Number(stakingSummary.totalPendingWithdrawal) > 0 ? (
                      <p className="text-xs text-white/42">
                        Pending staking-to-spot withdrawals sit in the unstaking
                        queue until Hyperliquid releases them.
                      </p>
                    ) : (
                      <p className="text-xs text-white/42">
                        No pending staking withdrawal queue detected for this
                        wallet right now.
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <DetailRow
                      label="Estimated strategy balance"
                      value={maskNumberish(
                        stakingValue,
                        formatUsd,
                        hideBalances,
                      )}
                    />
                    <DetailRow
                      label="Share of total equity"
                      value={`${stakingPct.toFixed(1)}%`}
                    />
                    <p className="text-xs text-white/42">
                      This residual bucket is shown because no live staking
                      summary was available yet.
                    </p>
                  </>
                )}
              </div>
            </BreakdownRow>

            <BreakdownRow
              itemValue="orders"
              label="Pending orders (notional)"
              meta={`${openOrderCount} working orders`}
              value={maskNumberish(
                pendingOrderNotional,
                formatUsd,
                hideBalances,
              )}
              color="#788395"
            >
              <div className="space-y-4">
                <div className="grid gap-2 sm:grid-cols-3">
                  <DetailRow
                    label="Working orders"
                    value={String(openOrderCount)}
                  />
                  <DetailRow
                    label="Pending notional"
                    value={maskNumberish(
                      pendingOrderNotional,
                      formatUsd,
                      hideBalances,
                    )}
                  />
                  <DetailRow
                    label="Average order size"
                    value={
                      openOrderCount > 0
                        ? maskNumberish(
                            pendingOrderNotional / openOrderCount,
                            formatUsd,
                            hideBalances,
                          )
                        : "—"
                    }
                  />
                </div>

                {openOrders.length > 0 ? (
                  <div className="space-y-2">
                    {openOrders.map((order) => {
                      const isBuy = order.side === "B";
                      return (
                        <div
                          key={order.oid}
                          className="flex items-center justify-between rounded-[12px] border border-white/[0.06] bg-white/[0.03] px-4 py-3"
                        >
                          <div>
                            <p className="font-medium text-white">
                              {order.coin}{" "}
                              <span
                                className={
                                  isBuy ? "text-emerald-300" : "text-rose-300"
                                }
                              >
                                {isBuy ? "Buy" : "Sell"}
                              </span>
                            </p>
                            <p className="mt-1 text-xs text-white/45">
                              {order.sz} @{" "}
                              {maskNumberish(
                                Number(order.limitPx),
                                formatUsd,
                                hideBalances,
                              )}
                            </p>
                          </div>
                          <div className="text-right text-xs text-white/45">
                            <p>
                              Original size{" "}
                              <span className="font-mono text-white/75">
                                {order.origSz}
                              </span>
                            </p>
                            <p className="mt-1">
                              Notional{" "}
                              <span className="font-mono text-white/75">
                                {maskNumberish(
                                  Number(order.limitPx) *
                                    Math.abs(Number(order.sz || 0)),
                                  formatUsd,
                                  hideBalances,
                                )}
                              </span>
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-white/42">
                    No pending orders on the book.
                  </p>
                )}
              </div>
            </BreakdownRow>
          </Accordion>
        )}
      </div>

      <p className="mt-2 text-xs text-white/35">
        Realized PnL sums all closed fills. Equity includes spot + perps margin
        + staking.
      </p>

      {!loading && !walletAddress && hasExplicitTarget && (
        <p className="mt-6 text-center text-sm text-white/35">
          This Blink profile does not have a live Hyperliquid account linked
          yet.
        </p>
      )}

      {!loading && !walletAddress && !hasExplicitTarget && (
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
          hideBalances={hideBalances}
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
