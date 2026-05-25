"use client";

import { useMemo, useState } from "react";

import Link from "next/link";

import { Copy } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@acme/ui/badge";

import { createAffiliateFromXProfile } from "~/lib/blink/affiliate-seeds";

export function AffiliateQuickAdd() {
  const [xProfileUrl, setXProfileUrl] = useState("https://x.com/zolandinho");
  const [walletAddress, setWalletAddress] = useState("");
  const [split, setSplit] = useState("80/20");
  const [boost, setBoost] = useState("2.0x");
  const [codeOverride, setCodeOverride] = useState("");

  const seed = useMemo(
    () =>
      createAffiliateFromXProfile({
        xProfileUrl,
        walletAddress,
        payoutSplitLabel: split,
        rewardBoostLabel: boost,
        code: codeOverride || undefined,
      }),
    [boost, codeOverride, split, walletAddress, xProfileUrl],
  );

  const referralLink = `https://blink.lat/r/${seed.code}`;
  const jsonSnippet = JSON.stringify(seed, null, 2);

  return (
    <main className="min-h-screen bg-[#06070b] px-4 py-5 text-foreground md:px-6">
      <div className="mx-auto max-w-5xl rounded-2xl border border-white/10 bg-[#0b0d13] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Badge className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-foreground/60">
              Internal
            </Badge>
            <h1 className="mt-3 text-2xl font-semibold text-white">
              New affiliate (X-profile quick add)
            </h1>
            <p className="mt-1 text-sm text-foreground/60">
              Paste X profile → get code, URL, avatar, split, and ready-to-seed
              payload.
            </p>
          </div>
          <Link
            href="/internal/affiliates"
            className="text-sm text-sky-300 hover:text-sky-200"
          >
            ← Back to affiliates
          </Link>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.12em] text-foreground/45">
              X profile URL
            </span>
            <input
              value={xProfileUrl}
              onChange={(event) => setXProfileUrl(event.target.value)}
              className="h-10 w-full rounded-lg border border-white/10 bg-[#121726] px-3 text-sm text-white outline-none"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.12em] text-foreground/45">
              Wallet (optional)
            </span>
            <input
              value={walletAddress}
              onChange={(event) => setWalletAddress(event.target.value)}
              placeholder="0x..."
              className="h-10 w-full rounded-lg border border-white/10 bg-[#121726] px-3 text-sm text-white outline-none"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.12em] text-foreground/45">
              Payout split
            </span>
            <input
              value={split}
              onChange={(event) => setSplit(event.target.value)}
              className="h-10 w-full rounded-lg border border-white/10 bg-[#121726] px-3 text-sm text-white outline-none"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.12em] text-foreground/45">
              Reward boost
            </span>
            <input
              value={boost}
              onChange={(event) => setBoost(event.target.value)}
              className="h-10 w-full rounded-lg border border-white/10 bg-[#121726] px-3 text-sm text-white outline-none"
            />
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="text-xs uppercase tracking-[0.12em] text-foreground/45">
              Code override (optional)
            </span>
            <input
              value={codeOverride}
              onChange={(event) => setCodeOverride(event.target.value)}
              placeholder="Auto-derived from handle if empty"
              className="h-10 w-full rounded-lg border border-white/10 bg-[#121726] px-3 text-sm text-white outline-none"
            />
          </label>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
          <section className="rounded-xl border border-white/10 bg-[#121726] p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-foreground/45">
              Preview
            </p>
            <div className="mt-3 space-y-2 text-sm">
              <p className="text-white">
                <span className="text-foreground/60">Name:</span> {seed.name}
              </p>
              <p className="text-white">
                <span className="text-foreground/60">Handle:</span>{" "}
                {seed.xHandle}
              </p>
              <p className="text-white">
                <span className="text-foreground/60">Code:</span> {seed.code}
              </p>
              <p className="text-white">
                <span className="text-foreground/60">Split:</span>{" "}
                {seed.payoutSplitLabel}
              </p>
              <p className="text-white">
                <span className="text-foreground/60">Boost:</span>{" "}
                {seed.rewardBoostLabel}
              </p>
              <p className="text-white break-all">
                <span className="text-foreground/60">Link:</span> {referralLink}
              </p>
            </div>
          </section>

          <section className="rounded-xl border border-white/10 bg-[#121726] p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-foreground/45">
              Seed payload
            </p>
            <pre className="mt-3 overflow-x-auto rounded-lg border border-white/8 bg-[#0b0f19] p-3 text-xs text-foreground/80">
              {jsonSnippet}
            </pre>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(referralLink);
                  toast.success("Referral link copied");
                }}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-white/10 bg-white/[0.06] px-3 text-xs text-white/80 transition hover:bg-white/[0.1]"
              >
                <Copy className="size-3.5" />
                Copy link
              </button>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(jsonSnippet);
                  toast.success("Seed payload copied");
                }}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-white/10 bg-white/[0.06] px-3 text-xs text-white/80 transition hover:bg-white/[0.1]"
              >
                <Copy className="size-3.5" />
                Copy payload
              </button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
