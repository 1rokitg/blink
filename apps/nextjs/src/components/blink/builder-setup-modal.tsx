"use client";

import { useState } from "react";

import { useWallets } from "@privy-io/react-auth";
import { AnimatePresence, motion } from "motion/react";
import { Check, ExternalLink, Loader2, ShieldCheck, Zap } from "lucide-react";

import { ConnectTwitterButton } from "./connect-twitter-button";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogTitle } from "@acme/ui/dialog";

import { getOrCreateAgentKey } from "~/lib/blink/agent-wallet";
import {
  BUILDER_ADDRESS,
  builderMaxFeeRate,
  isBuilderApproved,
} from "~/lib/blink/builder";
import { createExchangeClient, infoClient } from "~/lib/blink/hyperliquid";

function asHexAddress(address: string) {
  return address as `0x${string}`;
}

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function isFundingRelatedError(errorMessage: string | null) {
  if (!errorMessage) return false;
  const lower = errorMessage.toLowerCase();
  return (
    lower.includes("must deposit") ||
    lower.includes("deposit at least") ||
    lower.includes("before performing actions") ||
    lower.includes("account value")
  );
}

type Step = "idle" | "step1-pending" | "step1-done" | "step2-pending" | "done";
const MIN_HL_ACCOUNT_VALUE_USD = 20;
const HYPERLIQUID_PORTFOLIO_URL = "https://app.hyperliquid.xyz/portfolio";

function ensureExchangeActionOk(
  result: unknown,
  fallbackMessage: string,
): void {
  const maybe = result as
    | { status?: string; response?: unknown }
    | undefined
    | null;
  if (!maybe || maybe.status !== "ok") {
    throw new Error(fallbackMessage);
  }
  const response = maybe.response as
    | { type?: string; data?: { statuses?: Array<{ error?: string }> } }
    | string
    | undefined;
  if (typeof response === "string") {
    throw new Error(response || fallbackMessage);
  }
  const statuses = response?.data?.statuses;
  const firstErr = statuses?.find((s) => typeof s.error === "string")?.error;
  if (firstErr) {
    throw new Error(firstErr);
  }
}

export function BuilderSetupModal(props: {
  open: boolean;
  walletAddress: string;
  market: string;
  requiredFeeUnits: number;
  onClose: () => void;
  onApproved: () => void;
}) {
  const { wallets } = useWallets();
  const [step, setStep] = useState<Step>("idle");
  const [checking, setChecking] = useState(false);
  const [successState, setSuccessState] = useState(false);
  const [fundingCheckPending, setFundingCheckPending] = useState(false);
  const [accountValueUsd, setAccountValueUsd] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fundingError = isFundingRelatedError(error);
  const needsFunding =
    accountValueUsd !== null && accountValueUsd < MIN_HL_ACCOUNT_VALUE_USD;
  const shareText = `DO NOT BLINK! Just enabled builder routing on Blink for ${props.market} perps.`;
  const shareUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent("https://blink.lat")}`;

  if (!props.open) return null;

  const ensureMinFunding = async () => {
    setFundingCheckPending(true);
    try {
      const state = await infoClient.clearinghouseState({
        user: asHexAddress(props.walletAddress),
      });
      const accountValue = Number(state?.marginSummary?.accountValue ?? 0);
      setAccountValueUsd(accountValue);
      if (accountValue < MIN_HL_ACCOUNT_VALUE_USD) {
        throw new Error(
          `Deposit at least ${MIN_HL_ACCOUNT_VALUE_USD} USDC on Hyperliquid before approvals. Current account value: $${accountValue.toFixed(2)}.`,
        );
      }
    } finally {
      setFundingCheckPending(false);
    }
  };

  const handleStep1 = async () => {
    const wallet = wallets[0];
    if (!wallet) return;
    setStep("step1-pending");
    setError(null);
    try {
      await ensureMinFunding();
      const provider = await wallet.getEthereumProvider();
      const accounts = (await provider.request({
        method: "eth_accounts",
      })) as string[];
      console.info("[setup] step 1 context", {
        modalWalletAddress: props.walletAddress,
        privyWalletAddress: wallet.address,
        providerAccounts: accounts,
        market: props.market,
      });
      const exchClient = await createExchangeClient(wallet);
      console.info("[setup] step 1 — approving builder fee...");
      const result = await exchClient.approveBuilderFee({
        builder: BUILDER_ADDRESS,
        maxFeeRate: builderMaxFeeRate(),
      });
      ensureExchangeActionOk(
        result,
        "Builder fee approval was not accepted by Hyperliquid",
      );
      console.info("[setup] step 1 — builder fee approved ✓");
      setStep("step1-done");
    } catch (err) {
      console.error("[setup] step 1 failed:", err);
      setError(
        err instanceof Error ? err.message : "Builder fee approval failed",
      );
      setStep("idle");
    }
  };

  const handleStep2 = async () => {
    const wallet = wallets[0];
    if (!wallet) return;
    setStep("step2-pending");
    setError(null);
    try {
      await ensureMinFunding();
      const provider = await wallet.getEthereumProvider();
      const accounts = (await provider.request({
        method: "eth_accounts",
      })) as string[];
      const exchClient = await createExchangeClient(wallet);
      const { address: agentAddress } = getOrCreateAgentKey(
        props.walletAddress,
      );
      console.info("[setup] step 2 context", {
        modalWalletAddress: props.walletAddress,
        privyWalletAddress: wallet.address,
        providerAccounts: accounts,
        agentAddress,
        market: props.market,
      });
      console.info("[setup] step 2 — approving trading agent:", agentAddress);
      const approveAgentResult = await exchClient.approveAgent({
        agentAddress,
        agentName: "blink-web",
      });
      ensureExchangeActionOk(
        approveAgentResult,
        "Agent approval was not accepted by Hyperliquid",
      );
      const builderApproved = await isBuilderApproved(
        asHexAddress(props.walletAddress),
        props.requiredFeeUnits,
      );
      if (!builderApproved) {
        throw new Error(
          `Builder fee has not been approved yet (${props.requiredFeeUnits} units required).`,
        );
      }
      console.info("[setup] step 2 — trading agent approved ✓");
      setStep("done");
      setSuccessState(true);
      props.onApproved();
      toast.success("Trading enabled — one-click orders ready.");
    } catch (err) {
      console.error("[setup] step 2 failed:", err);
      setError(err instanceof Error ? err.message : "Agent approval failed");
      setStep("step1-done");
    }
  };

  const handleRecheck = async () => {
    setChecking(true);
    setError(null);
    try {
      await ensureMinFunding();
      const approved = await isBuilderApproved(
        asHexAddress(props.walletAddress),
        props.requiredFeeUnits,
      );
      if (approved) {
        setSuccessState(true);
        props.onApproved();
        toast.success("You're all set.");
      } else {
        setError(
          "Approval not detected yet. Wait a few seconds and try again.",
        );
      }
    } catch {
      setError("Could not verify approval right now. Please retry.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <Dialog open={props.open} onOpenChange={(open) => !open && props.onClose()}>
      <AnimatePresence>
        {props.open ? (
          <DialogContent
            forceMount
            className="border-none bg-transparent p-0 shadow-none sm:max-w-[560px]"
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="relative w-full overflow-hidden rounded-[16px] bg-[#0f131bcc] shadow-[0_28px_90px_rgba(0,0,0,0.62)] backdrop-blur-[26px]"
            >
              <div className="onboarding-hero h-52 border-b border-white/10">
                <div className="relative z-10 flex h-full flex-col justify-between p-5">
                  <p className="text-sm font-medium text-[#d7f0ff]">
                    Hyperliquid Docs
                  </p>
                  <p className="text-6xl font-semibold tracking-[-0.04em] text-[#8af2df]">
                    Blink!
                  </p>
                </div>
              </div>
              <div className="p-6">
                <AnimatePresence mode="wait">
                  {successState ? (
                    <motion.div
                      key="success"
                      className="flex min-h-[220px] flex-col items-center justify-center text-center"
                    >
                      <div className="mb-5 flex size-20 items-center justify-center rounded-full bg-[#1b3d32]">
                        <Check className="size-9 text-[#9df2d9]" />
                      </div>
                      <DialogTitle className="text-3xl font-semibold tracking-[-0.03em] text-white">
                        Trading Enabled
                      </DialogTitle>
                      <p className="mt-2 text-sm text-foreground/65">
                        You can trade now. Share your setup and bring your desk
                        in.
                      </p>

                      <div className="mt-5 w-full max-w-[420px] space-y-3">
                        <motion.a
                          href={shareUrl}
                          target="_blank"
                          rel="noreferrer"
                          whileHover={{ rotateX: 6, rotateY: -6, y: -3 }}
                          transition={{
                            type: "spring",
                            stiffness: 280,
                            damping: 20,
                          }}
                          className="group block w-full [transform-style:preserve-3d]"
                        >
                          <div className="rounded-2xl border border-[#79a7ff57] bg-[linear-gradient(145deg,#0f1b35,#111728)] p-4 text-left shadow-[0_16px_40px_rgba(0,0,0,0.45)]">
                            <div className="flex items-center justify-between">
                              <p className="text-xs uppercase tracking-[0.16em] text-[#7fa8ff]">
                                Share setup
                              </p>
                              <ExternalLink className="size-4 text-foreground/60 transition group-hover:text-white" />
                            </div>
                            <p className="mt-2 text-sm font-medium text-white">
                              DO NOT BLINK! Builder routing is enabled.
                            </p>
                            <p className="mt-1 text-xs text-foreground/55">
                              Post to X and invite your crew to trade perps with
                              your link.
                            </p>
                          </div>
                        </motion.a>
                        <ConnectTwitterButton
                          showSuccessCard={false}
                          className="w-full justify-center"
                        />
                      </div>

                      <button
                        type="button"
                        className="whop-blue-btn mt-4"
                        onClick={props.onClose}
                      >
                        Continue Trading
                      </button>
                    </motion.div>
                  ) : (
                    <motion.div key="setup">
                      <DialogTitle className="text-4xl font-semibold tracking-[-0.03em] text-white">
                        2 signatures needed
                      </DialogTitle>
                      <p className="mt-2 text-sm text-foreground/55">
                        Wallet: {truncateAddress(props.walletAddress)} · Market:{" "}
                        {props.market}
                      </p>
                      <div className="mt-3 rounded-xl border border-[#ffd1663d] bg-[#ffd16614] p-3 text-xs text-[#ffe9b8cc]">
                        <p className="font-medium text-[#ffe9b8]">
                          Funding requirement for new accounts
                        </p>
                        <p className="mt-1">
                          Hyperliquid requires at least{" "}
                          {MIN_HL_ACCOUNT_VALUE_USD} USDC deposited before
                          builder/agent approvals can succeed.
                        </p>
                        <p className="mt-1">
                          Account value:{" "}
                          {accountValueUsd === null
                            ? "not checked yet"
                            : `$${accountValueUsd.toFixed(2)}`}
                        </p>
                        {needsFunding ? (
                          <a
                            href={HYPERLIQUID_PORTFOLIO_URL}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-[#ffe6ad4f] bg-[#ffe6ad1a] px-2 py-1 text-[11px] font-semibold text-[#fff0c9] transition hover:bg-[#ffe6ad26]"
                          >
                            Fund on Hyperliquid
                            <ExternalLink className="size-3.5" />
                          </a>
                        ) : null}
                      </div>

                      {/* ── Step list ── */}
                      <div className="mt-5 space-y-3">
                        {/* Step 1 */}
                        <div
                          className={`rounded-xl border p-4 transition-colors ${
                            step === "step1-done" ||
                            step === "step2-pending" ||
                            step === "done"
                              ? "border-[#39d6a57a] bg-[#0e2a20]"
                              : "border-white/10 bg-white/[0.03]"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                                step === "step1-done" ||
                                step === "step2-pending" ||
                                step === "done"
                                  ? "bg-[#1b3d32] text-[#9df2d9]"
                                  : "bg-white/10 text-white/60"
                              }`}
                            >
                              {step === "step1-done" ||
                              step === "step2-pending" ||
                              step === "done" ? (
                                <Check className="size-4" />
                              ) : (
                                "1"
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <ShieldCheck className="size-4 text-[#7fa8ff]" />
                                <p className="text-sm font-semibold text-white">
                                  Approve Builder Fee
                                </p>
                              </div>
                              <p className="mt-1 text-xs text-foreground/50">
                                Routes your trades through Blink's builder code.
                                Volume-tiered, prorated per fill.
                              </p>
                              {(step === "idle" ||
                                step === "step1-pending") && (
                                <button
                                  type="button"
                                  className="whop-blue-btn mt-3 text-xs"
                                  onClick={() => void handleStep1()}
                                  disabled={
                                    step === "step1-pending" ||
                                    fundingCheckPending
                                  }
                                >
                                  {step === "step1-pending" ||
                                  fundingCheckPending ? (
                                    <>
                                      <Loader2 className="size-3.5 animate-spin" />{" "}
                                      {fundingCheckPending
                                        ? "Checking funding…"
                                        : "Waiting for wallet…"}
                                    </>
                                  ) : (
                                    "Confirm"
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Step 2 */}
                        <div
                          className={`rounded-xl border p-4 transition-colors ${
                            step === "step1-done" || step === "step2-pending"
                              ? "border-[#79a7ff57] bg-[#0d1428]"
                              : step === "done"
                                ? "border-[#39d6a57a] bg-[#0e2a20]"
                                : "border-white/[0.06] bg-white/[0.01] opacity-50"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                                step === "done"
                                  ? "bg-[#1b3d32] text-[#9df2d9]"
                                  : step === "step1-done" ||
                                      step === "step2-pending"
                                    ? "bg-[#1a2540] text-[#7fa8ff]"
                                    : "bg-white/10 text-white/30"
                              }`}
                            >
                              {step === "done" ? (
                                <Check className="size-4" />
                              ) : (
                                "2"
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Zap className="size-4 text-[#fee440]" />
                                <p className="text-sm font-semibold text-white">
                                  Approve Trading Agent
                                </p>
                              </div>
                              <p className="mt-1 text-xs text-foreground/50">
                                Enables one-click trading: authorises a local
                                signer so orders execute instantly with no
                                wallet popup per trade.
                              </p>
                              {(step === "step1-done" ||
                                step === "step2-pending") && (
                                <button
                                  type="button"
                                  className="whop-blue-btn mt-3 text-xs"
                                  onClick={() => void handleStep2()}
                                  disabled={
                                    step === "step2-pending" ||
                                    fundingCheckPending
                                  }
                                >
                                  {step === "step2-pending" ? (
                                    <>
                                      <Loader2 className="size-3.5 animate-spin" />{" "}
                                      Waiting for wallet…
                                    </>
                                  ) : (
                                    "Enable Trading"
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {fundingError ? (
                        <div className="mt-3 rounded-xl border border-[#ffd1663d] bg-[#ffd16614] p-3 text-sm text-[#ffe9b8cc]">
                          <p className="font-medium text-[#ffe9b8]">
                            Deposit needed to continue
                          </p>
                          <p className="mt-1 text-xs">
                            Fund your Hyperliquid account with at least{" "}
                            {MIN_HL_ACCOUNT_VALUE_USD} USDC, then tap{" "}
                            <span className="font-semibold">Check</span>.
                          </p>
                          <a
                            href={HYPERLIQUID_PORTFOLIO_URL}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-[#ffe6ad4f] bg-[#ffe6ad1a] px-2 py-1 text-[11px] font-semibold text-[#fff0c9] transition hover:bg-[#ffe6ad26]"
                          >
                            Fund on Hyperliquid
                            <ExternalLink className="size-3.5" />
                          </a>
                        </div>
                      ) : error ? (
                        <p className="mt-3 text-sm text-rose-300">
                          Could not complete setup right now. Please retry.
                        </p>
                      ) : null}

                      <div className="mt-5 flex items-center gap-2">
                        <button
                          type="button"
                          className="whop-secondary-btn border-[#39d6a57a] bg-[#173d2f] text-[#9ef0d2] hover:bg-[#1f4b3a]"
                          onClick={() => void handleRecheck()}
                          disabled={
                            checking ||
                            fundingCheckPending ||
                            step === "step1-pending" ||
                            step === "step2-pending"
                          }
                        >
                          {checking ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Check className="size-3.5" />
                          )}
                          Check
                        </button>
                        <button
                          type="button"
                          className="whop-secondary-btn ml-auto"
                          onClick={props.onClose}
                        >
                          Not now
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </DialogContent>
        ) : null}
      </AnimatePresence>
    </Dialog>
  );
}
