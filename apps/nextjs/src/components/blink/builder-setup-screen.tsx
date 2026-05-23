"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import { usePrivy, useWallets } from "@privy-io/react-auth";

import { recordBuilderApproval } from "~/app/actions/record-builder-approval";
import { Badge } from "@acme/ui/badge";
import { Button } from "@acme/ui/button";

import {
  BUILDER_ADDRESS,
  builderMaxFeeRate,
  isBuilderApproved,
} from "~/lib/blink/builder";
import { createExchangeClient } from "~/lib/blink/hyperliquid";
import { DEFAULT_MARKET } from "~/lib/blink/markets";

function fallbackMarket(value: string | null) {
  return value ? value.toUpperCase() : DEFAULT_MARKET.toUpperCase();
}

type ApprovalState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "already_approved" }
  | { status: "pending" }
  | { status: "approved" }
  | { status: "error"; message: string };

export function BuilderSetupScreen(props: { market: string | null }) {
  const { login } = usePrivy();
  const { wallets } = useWallets();

  const marketSlug = useMemo(
    () => fallbackMarket(props.market),
    [props.market],
  );

  const wallet = wallets[0];
  const walletAddress = wallet?.address as `0x${string}` | undefined;

  const [approval, setApproval] = useState<ApprovalState>({ status: "idle" });

  // On wallet connect, silently check for an existing on-chain approval
  useEffect(() => {
    if (!walletAddress) {
      setApproval({ status: "idle" });
      return;
    }
    setApproval({ status: "checking" });
    isBuilderApproved(walletAddress)
      .then((already) =>
        setApproval(
          already ? { status: "already_approved" } : { status: "idle" },
        ),
      )
      .catch(() => setApproval({ status: "idle" }));
  }, [walletAddress]);

  const handleApprove = useCallback(async () => {
    if (!wallet) return;
    setApproval({ status: "pending" });
    try {
      const exchClient = await createExchangeClient(wallet);
      await exchClient.approveBuilderFee({
        builder: BUILDER_ADDRESS,
        maxFeeRate: builderMaxFeeRate(),
      });
      // Persist approval to DB for admin visibility (fire-and-forget, non-critical)
      if (walletAddress) {
        void recordBuilderApproval(
          walletAddress,
          BUILDER_ADDRESS,
          builderMaxFeeRate(),
        );
      }
      setApproval({ status: "approved" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Approval failed";
      setApproval({ status: "error", message: msg });
    }
  }, [wallet, walletAddress]);

  const isPending = approval.status === "pending";
  const isChecking = approval.status === "checking";
  const isDone =
    approval.status === "approved" || approval.status === "already_approved";
  const feeRate = builderMaxFeeRate();

  return (
    <main className="min-h-screen bg-background px-6 py-8 text-foreground">
      <div className="mx-auto max-w-4xl">
        <Link
          href={`/trade/${marketSlug}`}
          className="inline-flex items-center gap-2 text-sm text-foreground/52 transition hover:text-foreground/82"
        >
          <ArrowLeft className="size-4" />
          Back to terminal
        </Link>

        <section className="glass-card noise-mask mt-4 p-8 md:p-10">
          <Badge className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-foreground/60">
            Enable Trading
          </Badge>

          <h1 className="mt-5 text-4xl font-semibold tracking-[-0.04em] text-white md:text-5xl">
            Approve Blink to route your trades.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-foreground/58">
            Builder routing uses a dynamic, volume-tiered fee that’s prorated
            per fill, so your effective rate trends lower as your executed
            notional scales.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              "Sign in with Google and use your embedded wallet",
              `Review fee disclosure: max ${feeRate} per trade`,
              "One-click approval — return to terminal immediately after",
            ].map((step) => (
              <div key={step} className="glass-panel px-4 py-4">
                <CheckCircle2 className="size-5 text-white" />
                <p className="mt-3 text-sm text-foreground/72">{step}</p>
              </div>
            ))}
          </div>

          {/* Wallet status + dynamic approval state */}
          <div className="mt-8 space-y-4 rounded-[28px] border border-white/8 bg-white/[0.04] p-5">
            <div className="flex items-center gap-3">
              <ShieldCheck className="size-5 shrink-0 text-white" />
              <div>
                <p className="text-sm font-medium text-white">Wallet status</p>
                <p className="mt-1 text-sm text-foreground/52">
                  {walletAddress
                    ? `Connected: ${walletAddress}`
                    : "No wallet connected yet."}
                </p>
              </div>
            </div>

            {isChecking && (
              <div className="flex items-center gap-2 text-sm text-foreground/52">
                <Loader2 className="size-4 animate-spin" />
                Checking existing approval…
              </div>
            )}

            {approval.status === "already_approved" && (
              <div className="flex items-center gap-2 rounded-[18px] border border-emerald-400/20 bg-emerald-400/8 px-4 py-3 text-sm text-emerald-200">
                <CheckCircle2 className="size-4 shrink-0" />
                Builder already approved — you can trade immediately.
              </div>
            )}

            {approval.status === "approved" && (
              <div className="flex items-center gap-2 rounded-[18px] border border-emerald-400/20 bg-emerald-400/8 px-4 py-3 text-sm text-emerald-200">
                <CheckCircle2 className="size-4 shrink-0" />
                Approval confirmed. Blink can now route your trades.
              </div>
            )}

            {approval.status === "error" && (
              <div className="flex items-start gap-2 rounded-[18px] border border-rose-400/20 bg-rose-400/8 px-4 py-3 text-sm text-rose-200">
                <XCircle className="mt-0.5 size-4 shrink-0" />
                {approval.message}
              </div>
            )}

            {isPending && (
              <div className="flex items-center gap-2 text-sm text-foreground/52">
                <Loader2 className="size-4 animate-spin" />
                Waiting for wallet signature…
              </div>
            )}
          </div>

          {/* Builder address disclosure */}
          <div className="mt-4 rounded-[20px] border border-white/6 bg-white/[0.02] px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-foreground/35">
              Builder address
            </p>
            <p className="mt-1 break-all font-mono text-xs text-foreground/52">
              {BUILDER_ADDRESS}
            </p>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            {!walletAddress ? (
              <Button
                className="rounded-full bg-white px-6 text-sm font-semibold text-black hover:bg-white/90"
                onClick={() => login()}
              >
                Continue with Google
              </Button>
            ) : isDone ? (
              <Button
                asChild
                className="rounded-full bg-white px-6 text-sm font-semibold text-black hover:bg-white/90"
              >
                <Link href={`/trade/${marketSlug}`}>Return to terminal</Link>
              </Button>
            ) : (
              <Button
                className="rounded-full bg-white px-6 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-50"
                onClick={() => void handleApprove()}
                disabled={isPending || isChecking}
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Approving…
                  </>
                ) : (
                  `Approve builder fee (${feeRate})`
                )}
              </Button>
            )}

            <Button
              asChild
              variant="outline"
              className="rounded-full border-white/8 bg-transparent px-6 text-sm text-foreground/72 hover:bg-white/[0.05]"
            >
              <Link href={`/trade/${marketSlug}`}>Return to terminal</Link>
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
