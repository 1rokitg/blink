"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  BarChart3,
  Binary,
  Clock3,
  Loader2,
  Search,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@acme/ui/button";
import { Input } from "@acme/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@acme/ui/tabs";

import { createAgentExchangeClient } from "~/lib/blink/agent-wallet";
import {
  BUILDER_ADDRESS,
  BUILDER_FEE_UNITS,
  getApprovedBuilderFeeUnits,
  isBuilderApproved,
} from "~/lib/blink/builder";
import {
  type OutcomeMarket,
  type OutcomeSide,
  getHip4MarketPath,
} from "~/lib/blink/hip4/markets";
import { infoClient } from "~/lib/blink/hyperliquid";
import { runWalletConnect } from "~/lib/blink/wallet-connect";
import { BuilderSetupModal } from "../builder-setup-modal";
import { TerminalOrderBook } from "../terminal-order-book";

function asHexAddress(address: string) {
  return address as `0x${string}`;
}

function clampOutcomePrice(value: number) {
  return Math.max(0.001, Math.min(0.999, value));
}

function formatOutcomePrice(value: number) {
  return clampOutcomePrice(value).toFixed(4);
}

function formatProbability(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(value >= 0.1 ? 1 : 2)}%`;
}

function formatCompactAmount(value: number) {
  if (!Number.isFinite(value)) return "0";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  if (value >= 1)
    return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return value.toFixed(4);
}

function OutcomeStatCard(props: {
  label: string;
  tone?: "default" | "buy" | "sell";
  value: string;
}) {
  const toneClass =
    props.tone === "buy"
      ? "text-emerald-300"
      : props.tone === "sell"
        ? "text-rose-300"
        : "text-white";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-4">
      <p className="text-[11px] uppercase tracking-[0.16em] text-white/38">
        {props.label}
      </p>
      <p
        className={`mt-3 text-2xl font-semibold tracking-[-0.04em] ${toneClass}`}
      >
        {props.value}
      </p>
    </div>
  );
}

export function OutcomeMarketShell(props: { market: OutcomeMarket }) {
  const { authenticated, login, linkWallet } = usePrivy();
  const { wallets } = useWallets();
  const queryClient = useQueryClient();

  const [selectedSideKey, setSelectedSideKey] = useState<"yes" | "no">("yes");
  const [orderSide, setOrderSide] = useState<"buy" | "sell">("buy");
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [shares, setShares] = useState("10");
  const [limitPrice, setLimitPrice] = useState(
    props.market.yes.mid !== null
      ? formatOutcomePrice(props.market.yes.mid)
      : "0.5000",
  );
  const [submitting, setSubmitting] = useState(false);
  const [builderModalOpen, setBuilderModalOpen] = useState(false);

  const walletAddress = wallets[0]?.address;
  const selectedSide =
    selectedSideKey === "yes" ? props.market.yes : props.market.no;
  const alternateSide =
    selectedSideKey === "yes" ? props.market.no : props.market.yes;

  const approvalQuery = useQuery({
    queryKey: ["blink", "hip4-builder-approval", walletAddress],
    queryFn: () => {
      if (!walletAddress) throw new Error("Wallet not connected");
      return isBuilderApproved(asHexAddress(walletAddress), BUILDER_FEE_UNITS);
    },
    enabled: Boolean(walletAddress),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const spotStateQuery = useQuery({
    queryKey: ["blink", "hip4-spot-state", walletAddress],
    queryFn: () => {
      if (!walletAddress) throw new Error("Wallet not connected");
      return infoClient.spotClearinghouseState({
        user: asHexAddress(walletAddress),
      });
    },
    enabled: Boolean(walletAddress),
    staleTime: 15_000,
    refetchInterval: 15_000,
  });

  const balances = spotStateQuery.data?.balances ?? [];

  const usdhBalance = useMemo(
    () =>
      Number(balances.find((balance) => balance.coin === "USDH")?.total ?? 0),
    [balances],
  );
  const selectedOutcomeBalance = useMemo(
    () =>
      Number(
        balances.find((balance) => balance.coin === selectedSide.balanceCoin)
          ?.total ?? 0,
      ),
    [balances, selectedSide.balanceCoin],
  );
  const alternateOutcomeBalance = useMemo(
    () =>
      Number(
        balances.find((balance) => balance.coin === alternateSide.balanceCoin)
          ?.total ?? 0,
      ),
    [alternateSide.balanceCoin, balances],
  );

  const shareCount = Math.max(0, Math.floor(Number(shares) || 0));
  const effectivePrice =
    orderType === "limit"
      ? clampOutcomePrice(Number(limitPrice) || selectedSide.mid || 0.5)
      : clampOutcomePrice(selectedSide.mid || 0.5);
  const estimatedNotional = shareCount * effectivePrice;
  const estimatedSettlementValue =
    orderSide === "buy"
      ? shareCount
      : Math.max(0, selectedOutcomeBalance - shareCount) * effectivePrice;

  const requestWallet = useCallback(async () => {
    await runWalletConnect(
      { authenticated, login, linkWallet },
      { source: "outcome-market-shell" },
    );
  }, [authenticated, linkWallet, login]);

  const handleSubmit = async () => {
    if (!authenticated || !walletAddress) {
      await requestWallet();
      return;
    }

    if (approvalQuery.data !== true) {
      setBuilderModalOpen(true);
      return;
    }

    const liveApprovedFeeUnits = await getApprovedBuilderFeeUnits(
      asHexAddress(walletAddress),
    );
    if (liveApprovedFeeUnits < BUILDER_FEE_UNITS) {
      toast.error(
        `Builder fee has not been approved (${liveApprovedFeeUnits}/${BUILDER_FEE_UNITS}).`,
      );
      setBuilderModalOpen(true);
      return;
    }

    if (!shareCount) {
      toast.error("Enter a whole number of shares");
      return;
    }

    if (orderSide === "sell" && shareCount > selectedOutcomeBalance) {
      toast.error(
        `You only hold ${formatCompactAmount(selectedOutcomeBalance)} shares.`,
      );
      return;
    }

    if (orderType === "limit") {
      const rawLimitPrice = Number(limitPrice);
      if (!Number.isFinite(rawLimitPrice) || rawLimitPrice <= 0) {
        toast.error("Enter a valid limit price between 0.001 and 0.999.");
        return;
      }
    }

    const minNotional = 10;
    if (estimatedNotional < minNotional) {
      toast.error(`Minimum order value is ${minNotional} USDH.`);
      return;
    }

    if (orderSide === "buy" && usdhBalance < estimatedNotional) {
      toast.error("Not enough USDH to place this order.");
      return;
    }

    setSubmitting(true);

    try {
      const exchClient = createAgentExchangeClient(asHexAddress(walletAddress));
      const mids = await infoClient.allMids();
      const latestMid = Number(
        mids[selectedSide.tradeCoin] ?? selectedSide.mid ?? 0,
      );

      if (!latestMid && orderType === "market") {
        throw new Error("Could not fetch a live outcome mid price.");
      }

      const priceForOrder =
        orderType === "limit"
          ? clampOutcomePrice(Number(limitPrice))
          : orderSide === "buy"
            ? clampOutcomePrice(latestMid * 1.05)
            : clampOutcomePrice(latestMid * 0.95);
      const tif: "Ioc" | "Gtc" = orderType === "market" ? "Ioc" : "Gtc";

      const orderPayload = {
        orders: [
          {
            a: selectedSide.assetId,
            b: orderSide === "buy",
            p: formatOutcomePrice(priceForOrder),
            s: String(shareCount),
            r: false,
            t: {
              limit: {
                tif,
              },
            },
          },
        ],
        grouping: "na" as const,
        builder: { b: BUILDER_ADDRESS, f: BUILDER_FEE_UNITS },
      };

      try {
        await exchClient.order(orderPayload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.toLowerCase().includes("duplicate nonce")) throw error;
        await exchClient.order(orderPayload);
      }

      toast.success(
        `${orderType === "market" ? "Market" : "Limit"} ${orderSide} ${shareCount} ${selectedSide.name} shares sent.`,
      );

      void queryClient.invalidateQueries({
        queryKey: ["blink", "hip4-spot-state", walletAddress],
      });

      if (orderType === "market" && latestMid) {
        setLimitPrice(formatOutcomePrice(latestMid));
      }
      setShares("");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Outcome order could not be sent.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#060510] px-4 py-8 text-[#f4f7fb] sm:px-6 lg:px-8">
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(circle at 16% 18%, rgba(56,189,248,0.16), transparent 24%), radial-gradient(circle at 82% 14%, rgba(96,165,250,0.10), transparent 20%), radial-gradient(circle at 50% 82%, rgba(14,165,233,0.08), transparent 26%)",
        }}
      />

      <div className="relative mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <Link
              href={getHip4MarketPath(props.market.slug).replace(
                `/${props.market.slug}`,
                "",
              )}
              className="inline-flex items-center gap-2 text-sm text-[#9bddff] transition hover:text-white"
            >
              <Search className="size-4" />
              Back to outcomes discovery
            </Link>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#38bdf8]/20 bg-[#38bdf8]/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[#9bddff]">
              <Binary className="size-3.5" />
              Outcome market
            </div>
            <h1 className="text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl">
              {props.market.title}
            </h1>
            <p className="max-w-2xl text-base leading-7 text-white/60">
              {props.market.subtitle} Trade the YES or NO side directly with
              integer shares and USDH collateral.
            </p>
          </div>

          <Link
            href="/trade/BTC"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/75 transition hover:bg-white/[0.08] hover:text-white"
          >
            Open perp terminal
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <OutcomeStatCard
            label="Target"
            value={String(props.market.targetPrice ?? "—")}
          />
          <OutcomeStatCard
            label="Expiry"
            value={props.market.expiryLabel ?? "—"}
          />
          <OutcomeStatCard
            label={`${props.market.yes.name} mid`}
            tone="buy"
            value={formatProbability(props.market.yes.mid)}
          />
          <OutcomeStatCard
            label={`${props.market.no.name} mid`}
            tone="sell"
            value={formatProbability(props.market.no.mid)}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,17,28,0.98),rgba(7,11,20,0.98))] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#9bddff]">
                  Market depth
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  {selectedSide.name} live book
                </h2>
              </div>
              <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
                {(["yes", "no"] as const).map((sideKey) => {
                  const side =
                    sideKey === "yes" ? props.market.yes : props.market.no;
                  return (
                    <button
                      key={side.tradeCoin}
                      type="button"
                      onClick={() => {
                        setSelectedSideKey(sideKey);
                        if (side.mid !== null) {
                          setLimitPrice(formatOutcomePrice(side.mid));
                        }
                      }}
                      className={`rounded-lg px-4 py-2 text-sm transition ${
                        selectedSideKey === sideKey
                          ? "bg-white/12 text-white"
                          : "text-white/50 hover:text-white/78"
                      }`}
                    >
                      {side.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
              <TerminalOrderBook market={selectedSide.tradeCoin} />

              <div className="space-y-4 rounded-[24px] border border-white/10 bg-[#09101c] p-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-white/40">
                    Selected side
                  </p>
                  <p className="mt-2 text-xl font-semibold text-white">
                    {selectedSide.name}
                  </p>
                  <p className="mt-1 text-sm text-white/52">
                    Trade coin {selectedSide.tradeCoin} · balance coin{" "}
                    {selectedSide.balanceCoin}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-white/40">
                    Account snapshot
                  </p>
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-white/55">USDH available</span>
                      <span className="font-medium text-white">
                        {walletAddress ? formatCompactAmount(usdhBalance) : "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-white/55">
                        {selectedSide.name} shares
                      </span>
                      <span className="font-medium text-white">
                        {walletAddress
                          ? formatCompactAmount(selectedOutcomeBalance)
                          : "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-white/55">
                        {alternateSide.name} shares
                      </span>
                      <span className="font-medium text-white">
                        {walletAddress
                          ? formatCompactAmount(alternateOutcomeBalance)
                          : "—"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#7fd6ff24] bg-[linear-gradient(180deg,rgba(56,189,248,0.08),rgba(10,15,24,0.20))] p-4 text-sm text-white/64">
                  <div className="inline-flex items-center gap-2 text-[#9bddff]">
                    <BarChart3 className="size-4" />
                    Outcome contract notes
                  </div>
                  <ul className="mt-3 space-y-2">
                    <li>Trades are fully collateralized and settle in USDH.</li>
                    <li>Binary sizes are whole shares for now.</li>
                    <li>Minimum order value is 10 USDH.</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,17,28,0.98),rgba(7,11,20,0.98))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#9bddff]">
              Trade panel
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              Place a live HIP-4 order
            </h2>

            {!authenticated || !walletAddress ? (
              <div className="mt-5 rounded-[24px] border border-white/10 bg-white/[0.03] p-5 text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#38bdf8]/10 text-[#9bddff]">
                  <Wallet className="size-5" />
                </div>
                <p className="mt-4 text-lg font-medium text-white">
                  Connect to trade outcomes
                </p>
                <p className="mt-2 text-sm leading-6 text-white/55">
                  Blink uses the same non-custodial Hyperliquid setup, but this
                  screen is dedicated to outcome markets.
                </p>
                <Button
                  className="mt-5 h-11 w-full rounded-xl bg-[#2c6bff] font-semibold hover:bg-[#2c6bff]/90"
                  onClick={() => void requestWallet()}
                >
                  {authenticated ? "Link wallet" : "Connect wallet"}
                </Button>
              </div>
            ) : (
              <>
                <Tabs
                  value={selectedSideKey}
                  onValueChange={(value) => {
                    if (value === "yes" || value === "no") {
                      setSelectedSideKey(value);
                    }
                  }}
                  className="mt-5"
                >
                  <TabsList className="grid h-10 w-full grid-cols-2 rounded-xl bg-white/[0.04] p-1">
                    <TabsTrigger value="yes" className="rounded-lg">
                      {props.market.yes.name}
                    </TabsTrigger>
                    <TabsTrigger value="no" className="rounded-lg">
                      {props.market.no.name}
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="yes" />
                  <TabsContent value="no" />
                </Tabs>

                <div className="mt-4 inline-flex w-full rounded-xl border border-white/10 bg-white/[0.03] p-1">
                  {(["buy", "sell"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setOrderSide(value)}
                      className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
                        orderSide === value
                          ? value === "buy"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-rose-500/15 text-rose-300"
                          : "text-white/52 hover:text-white/78"
                      }`}
                    >
                      {value === "buy" ? "Buy shares" : "Sell shares"}
                    </button>
                  ))}
                </div>

                <div className="mt-3 inline-flex w-full rounded-xl border border-white/10 bg-white/[0.03] p-1">
                  {(["market", "limit"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setOrderType(value)}
                      className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
                        orderType === value
                          ? "bg-white/12 text-white"
                          : "text-white/52 hover:text-white/78"
                      }`}
                    >
                      {value === "market" ? "Market" : "Limit"}
                    </button>
                  ))}
                </div>

                <div className="mt-5 space-y-4">
                  <div>
                    <p className="mb-2 text-xs uppercase tracking-[0.14em] text-white/40">
                      Shares
                    </p>
                    <Input
                      inputMode="numeric"
                      value={shares}
                      onChange={(event) =>
                        setShares(event.target.value.replace(/[^\d]/g, ""))
                      }
                      placeholder="10"
                      className="h-12 rounded-xl border-white/10 bg-white/[0.04] text-white"
                    />
                  </div>

                  {orderType === "limit" ? (
                    <div>
                      <p className="mb-2 text-xs uppercase tracking-[0.14em] text-white/40">
                        Limit price
                      </p>
                      <Input
                        inputMode="decimal"
                        value={limitPrice}
                        onChange={(event) => setLimitPrice(event.target.value)}
                        placeholder="0.5000"
                        className="h-12 rounded-xl border-white/10 bg-white/[0.04] text-white"
                      />
                    </div>
                  ) : null}
                </div>

                <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-white/55">Selected side</span>
                    <span className="font-medium text-white">
                      {selectedSide.name}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-white/55">Working price</span>
                    <span className="font-medium text-white">
                      {formatOutcomePrice(effectivePrice)}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-white/55">Estimated order value</span>
                    <span className="font-medium text-white">
                      {estimatedNotional.toFixed(2)} USDH
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-white/55">
                      {orderSide === "buy"
                        ? "Max settlement value"
                        : "Remaining mark value"}
                    </span>
                    <span className="font-medium text-white">
                      {estimatedSettlementValue.toFixed(2)} USDH
                    </span>
                  </div>
                </div>

                {approvalQuery.data !== true ? (
                  <div className="mt-4 rounded-2xl border border-[#7fd6ff24] bg-[#38bdf8]/10 p-4 text-sm text-white/68">
                    <div className="inline-flex items-center gap-2 text-[#9bddff]">
                      <ShieldCheck className="size-4" />
                      Trading setup required
                    </div>
                    <p className="mt-2 leading-6">
                      Enable the Blink builder and approve the local trading
                      agent once, then HIP-4 orders can execute without repeated
                      wallet popups.
                    </p>
                  </div>
                ) : null}

                <Button
                  className="mt-5 h-12 w-full rounded-xl bg-[#2c6bff] font-semibold hover:bg-[#2c6bff]/90"
                  onClick={() => void handleSubmit()}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Sending order...
                    </>
                  ) : approvalQuery.data !== true ? (
                    "Enable trading"
                  ) : (
                    `${orderType === "market" ? "Submit market" : "Place limit"} ${orderSide}`
                  )}
                </Button>

                <p className="mt-3 text-xs leading-5 text-white/42">
                  Outcome orders use USDH collateral and Blink&apos;s builder
                  routing. If your account is new, fund Hyperliquid and approve
                  trading once before the first order.
                </p>
              </>
            )}
          </section>
        </div>

        <BuilderSetupModal
          open={builderModalOpen}
          walletAddress={walletAddress ?? ""}
          market={props.market.title}
          requiredFeeUnits={BUILDER_FEE_UNITS}
          onCloseAction={() => setBuilderModalOpen(false)}
          onApprovedAction={() => {
            void approvalQuery.refetch();
            setBuilderModalOpen(false);
          }}
        />
      </div>
    </main>
  );
}
