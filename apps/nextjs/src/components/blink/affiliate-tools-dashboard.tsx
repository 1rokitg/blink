"use client";

import { useMemo } from "react";

import Link from "next/link";

import { useWallets } from "@privy-io/react-auth";
import { useQuery } from "@tanstack/react-query";
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@acme/ui/badge";

type AffiliateToolsResponse = {
  affiliate: {
    avatar: string;
    boostLabel: string;
    code: string;
    name: string;
    payoutSplitLabel: string;
    verifiedAt: string;
    verifiedUsername: string;
    walletAddress: string;
    xHandle: string;
    xUrl: string;
  };
  conversion: {
    approvalToTradePct: number;
    signupToApprovalPct: number;
    signupToTradePct: number;
    tradeToProPct: number;
  };
  metrics: {
    builderApproved: number;
    firstTrade: number;
    proStarted: number;
    referrals: number;
  };
  referredUsers: Array<{
    walletAddress: string;
    joinedAt: string;
    code: string;
    builderApproved: boolean;
    firstTrade: boolean;
    proStarted: boolean;
    signupSource: string | null;
    signupCountry: string | null;
  }>;
};

function truncateAddress(address: string) {
  if (!address) return "—";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function AffiliateToolsDashboard() {
  const { wallets } = useWallets();
  const walletAddress = wallets[0]?.address?.toLowerCase() ?? "";

  const toolsQuery = useQuery({
    queryKey: ["affiliate-tools", walletAddress],
    queryFn: async () => {
      const response = await fetch(
        `/api/affiliates/tools?address=${walletAddress}`,
      );
      const json = (await response.json().catch(() => null)) as
        | (AffiliateToolsResponse & { error?: string; reason?: string })
        | null;

      if (!response.ok) {
        return {
          ok: false as const,
          reason: json?.reason ?? "unknown",
          message: json?.error ?? "Failed to load affiliate tools",
        };
      }

      return { ok: true as const, data: json as AffiliateToolsResponse };
    },
    enabled: Boolean(walletAddress),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const referralLink = useMemo(() => {
    if (!toolsQuery.data?.ok) return "";
    return `https://blink.lat/r/${toolsQuery.data.data.affiliate.code}`;
  }, [toolsQuery.data]);

  if (!walletAddress) {
    return (
      <main className="min-h-screen bg-[#06070b] px-6 py-8 text-foreground">
        <div className="mx-auto max-w-3xl">
          <section className="rounded-2xl border border-white/10 bg-[#0f121a] p-8">
            <Badge className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-foreground/60">
              Affiliate tools
            </Badge>
            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white">
              Connect wallet first.
            </h1>
            <p className="mt-3 text-base leading-7 text-foreground/58">
              Connect the wallet you use for Blink referrals to access your
              affiliate performance workspace.
            </p>
            <Link
              href="/trade"
              className="mt-6 inline-flex text-sm text-foreground/70 transition hover:text-white"
            >
              ← Return to terminal
            </Link>
          </section>
        </div>
      </main>
    );
  }

  if (toolsQuery.isLoading) {
    return (
      <main className="min-h-screen bg-[#06070b] px-6 py-8 text-foreground">
        <div className="mx-auto max-w-3xl">
          <section className="rounded-2xl border border-white/10 bg-[#0f121a] p-8">
            <Badge className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-foreground/60">
              Affiliate tools
            </Badge>
            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white">
              Loading your workspace…
            </h1>
          </section>
        </div>
      </main>
    );
  }

  if (!toolsQuery.data?.ok) {
    const reason = toolsQuery.data?.reason ?? "unknown";
    const copy =
      reason === "not_verified"
        ? "Your wallet must be verified before affiliate tooling is enabled."
        : reason === "not_affiliate"
          ? "This wallet is not enrolled in Blink's affiliate program."
          : "Your affiliate workspace is not available for this wallet.";

    return (
      <main className="min-h-screen bg-[#06070b] px-6 py-8 text-foreground">
        <div className="mx-auto max-w-3xl">
          <section className="rounded-2xl border border-white/10 bg-[#0f121a] p-8">
            <Badge className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-amber-300">
              Affiliate tools
            </Badge>
            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white">
              Access requirements not met.
            </h1>
            <p className="mt-3 text-base leading-7 text-foreground/58">
              {copy}
            </p>
            <div className="mt-6 flex items-center gap-3">
              <Link
                href="/profile/verify"
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#8fbaff80] bg-[linear-gradient(180deg,#3c76ff,#2457db)] px-4 py-2 text-sm font-medium text-white shadow-[0_16px_40px_rgba(37,90,224,0.28)] transition hover:brightness-110"
              >
                Verify wallet
                <ExternalLink className="size-3.5" />
              </Link>
              <Link
                href="/rewards"
                className="inline-flex text-sm text-foreground/70 transition hover:text-white"
              >
                View rewards page
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  const data = toolsQuery.data.data;

  return (
    <main className="min-h-screen bg-[#06070b] px-4 py-5 text-foreground md:px-6">
      <div className="mx-auto max-w-[1280px]">
        <div className="rounded-2xl border border-white/10 bg-[#0b0d13] px-4 py-3">
          <Badge className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-foreground/60">
            Internal tools · Affiliates
          </Badge>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-white">
            Affiliate performance workspace
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-foreground/60">
            Read-only dashboard for your affiliate account: link performance,
            conversion funnel, and non-sensitive referred-user progression.
          </p>
        </div>

        <section className="mt-4 rounded-2xl border border-white/10 bg-[#0b0d13] p-5">
          <div className="grid gap-4 lg:grid-cols-[1.8fr_1fr]">
            <div className="rounded-xl border border-white/10 bg-[#121726] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-foreground/45">
                    Affiliate
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-white">
                    {data.affiliate.name}
                  </p>
                  <a
                    href={data.affiliate.xUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-sm text-sky-300 hover:text-sky-200"
                  >
                    {data.affiliate.xHandle}
                    <ExternalLink className="size-3.5" />
                  </a>
                </div>
                <Badge className="rounded-full border border-emerald-400/35 bg-emerald-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-emerald-300">
                  Verified @{data.affiliate.verifiedUsername}
                </Badge>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-white/10 bg-[#0f1422] p-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-foreground/45">
                    Code
                  </p>
                  <p className="mt-1 text-lg font-semibold text-white">
                    {data.affiliate.code}
                  </p>
                </div>
                <div className="rounded-lg border border-white/10 bg-[#0f1422] p-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-foreground/45">
                    Boost
                  </p>
                  <p className="mt-1 text-lg font-semibold text-emerald-300">
                    {data.affiliate.boostLabel}
                  </p>
                </div>
                <div className="rounded-lg border border-white/10 bg-[#0f1422] p-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-foreground/45">
                    Split
                  </p>
                  <p className="mt-1 text-lg font-semibold text-white">
                    {data.affiliate.payoutSplitLabel}
                  </p>
                </div>
                <div className="rounded-lg border border-white/10 bg-[#0f1422] p-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-foreground/45">
                    Wallet
                  </p>
                  <p className="mt-1 font-mono text-sm text-white">
                    {truncateAddress(data.affiliate.walletAddress)}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-white/10 bg-[#0f1422] p-3">
                <p className="text-[11px] uppercase tracking-[0.12em] text-foreground/45">
                  Affiliate link
                </p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="truncate font-mono text-sm text-white">
                    {referralLink}
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(referralLink);
                      toast.success("Affiliate link copied");
                    }}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-white/10 bg-white/[0.06] px-2 text-xs text-white/80 transition hover:bg-white/[0.1]"
                  >
                    <Copy className="size-3.5" />
                    Copy
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-[#121726] p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-foreground/45">
                Conversion funnel
              </p>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between rounded-lg border border-white/10 bg-[#0f1422] px-3 py-2">
                  <span className="text-foreground/65">Signups</span>
                  <span className="font-semibold text-white">
                    {data.metrics.referrals}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-white/10 bg-[#0f1422] px-3 py-2">
                  <span className="text-foreground/65">Builder approved</span>
                  <span className="font-semibold text-white">
                    {data.metrics.builderApproved}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-white/10 bg-[#0f1422] px-3 py-2">
                  <span className="text-foreground/65">First trade</span>
                  <span className="font-semibold text-white">
                    {data.metrics.firstTrade}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-white/10 bg-[#0f1422] px-3 py-2">
                  <span className="text-foreground/65">Pro started</span>
                  <span className="font-semibold text-white">
                    {data.metrics.proStarted}
                  </span>
                </div>
              </div>
              <div className="mt-4 space-y-2 text-xs text-foreground/60">
                <p>
                  Signup → approval:{" "}
                  {formatPercent(data.conversion.signupToApprovalPct)}
                </p>
                <p>
                  Approval → trade:{" "}
                  {formatPercent(data.conversion.approvalToTradePct)}
                </p>
                <p>
                  Signup → trade:{" "}
                  {formatPercent(data.conversion.signupToTradePct)}
                </p>
                <p>
                  Trade → pro: {formatPercent(data.conversion.tradeToProPct)}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-white/10 bg-[#0b0d13] p-5">
          <h2 className="text-base font-semibold text-white">
            Referred users (safe read-only)
          </h2>
          <p className="mt-1 text-xs text-foreground/45">
            Non-sensitive progression data only. No private PII, no IP metadata,
            no hidden internal risk signals.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="text-[11px] uppercase tracking-[0.12em] text-foreground/45">
                <tr>
                  <th className="py-2">Wallet</th>
                  <th className="py-2">Joined</th>
                  <th className="py-2">Code</th>
                  <th className="py-2">Source</th>
                  <th className="py-2">Country</th>
                  <th className="py-2">Builder</th>
                  <th className="py-2">First trade</th>
                  <th className="py-2">Pro started</th>
                </tr>
              </thead>
              <tbody>
                {data.referredUsers.length > 0 ? (
                  data.referredUsers.map((row) => (
                    <tr
                      key={`${row.walletAddress}-${row.joinedAt}`}
                      className="border-t border-white/8"
                    >
                      <td className="py-2 font-mono text-white/88">
                        {truncateAddress(row.walletAddress)}
                      </td>
                      <td className="py-2 text-white/74">
                        {formatTimestamp(row.joinedAt)}
                      </td>
                      <td className="py-2 text-sky-300">{row.code}</td>
                      <td className="py-2 text-white/74">
                        {row.signupSource ?? "—"}
                      </td>
                      <td className="py-2 text-white/74">
                        {row.signupCountry ?? "—"}
                      </td>
                      <td className="py-2">
                        {row.builderApproved ? (
                          <span className="text-emerald-300">Yes</span>
                        ) : (
                          <span className="text-white/55">No</span>
                        )}
                      </td>
                      <td className="py-2">
                        {row.firstTrade ? (
                          <span className="text-emerald-300">Yes</span>
                        ) : (
                          <span className="text-white/55">No</span>
                        )}
                      </td>
                      <td className="py-2">
                        {row.proStarted ? (
                          <span className="text-emerald-300">Yes</span>
                        ) : (
                          <span className="text-white/55">No</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr className="border-t border-white/8">
                    <td colSpan={8} className="py-6 text-center text-white/45">
                      No referred users yet. Start sharing your affiliate link
                      to populate this table.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
