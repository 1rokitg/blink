"use client";

import { useEffect, useMemo, useState } from "react";

import Link from "next/link";

import { useWallets } from "@privy-io/react-auth";
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@acme/ui/badge";

import {
  getAdminAccess,
  type AdminAccessResult,
} from "~/app/actions/get-admin-access";
import { AFFILIATE_SEEDS } from "~/lib/blink/affiliate-seeds";

export function AffiliatesDashboard() {
  const { wallets } = useWallets();
  const connectedWallets = useMemo(
    () =>
      wallets
        .map((wallet) => wallet.address?.toLowerCase())
        .filter((address): address is string => Boolean(address)),
    [wallets],
  );
  const [adminAccess, setAdminAccess] = useState<AdminAccessResult>({
    allowed: false,
    role: "viewer",
    walletAddress: "",
  });
  const [checkingAccess, setCheckingAccess] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function resolveAccess() {
      setCheckingAccess(true);
      try {
        const access = await getAdminAccess(connectedWallets);
        if (!cancelled) setAdminAccess(access);
      } catch (err) {
        console.error("[affiliates] Failed to resolve admin access:", err);
      } finally {
        if (!cancelled) setCheckingAccess(false);
      }
    }

    void resolveAccess();

    return () => {
      cancelled = true;
    };
  }, [connectedWallets]);

  const isAllowed = adminAccess.allowed;
  const role = adminAccess.role;

  const primaryAffiliate = AFFILIATE_SEEDS[0];
  const referralLink = useMemo(() => {
    if (!primaryAffiliate) return "https://blink.lat/r/BLINK";
    return `https://blink.lat/r/${primaryAffiliate.code}`;
  }, [primaryAffiliate]);

  if (checkingAccess) {
    return (
      <main className="min-h-screen bg-[#06070b] px-6 py-8 text-foreground">
        <div className="mx-auto max-w-3xl">
          <section className="rounded-2xl border border-white/10 bg-[#0f121a] p-8">
            <Badge className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-foreground/60">
              Admin
            </Badge>
            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white">
              Verifying access…
            </h1>
          </section>
        </div>
      </main>
    );
  }

  if (!isAllowed) {
    return (
      <main className="min-h-screen bg-[#06070b] px-6 py-8 text-foreground">
        <div className="mx-auto max-w-3xl">
          <section className="rounded-2xl border border-white/10 bg-[#0f121a] p-8">
            <Badge className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-foreground/60">
              Admin
            </Badge>
            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white">
              Admin role required.
            </h1>
            <p className="mt-3 text-base leading-7 text-foreground/58">
              Blink internal tools use Neon-backed RBAC. Ask a superuser to
              grant your connected wallet an admin or superuser role.
            </p>
            <Link
              href="/trade/BTC"
              className="mt-6 inline-flex text-sm text-foreground/60 transition hover:text-foreground/82"
            >
              ← Return to terminal
            </Link>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#06070b] px-4 py-5 text-foreground md:px-6">
      <div className="mx-auto flex max-w-[1500px] gap-4">
        <aside className="hidden w-[248px] shrink-0 rounded-2xl border border-white/10 bg-[#0b0d13] p-3 lg:block">
          <p className="px-2 py-1 text-xs uppercase tracking-[0.18em] text-foreground/45">
            Internal
          </p>
          <div className="mt-2 space-y-1">
            <Link
              href="/internal"
              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-foreground/60 transition hover:bg-white/[0.06] hover:text-white/85"
            >
              Home
            </Link>
            <Link
              href="/internal/affiliates"
              className="flex w-full items-center justify-between rounded-xl bg-white/12 px-3 py-2 text-left text-sm text-white transition"
            >
              Affiliates
            </Link>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#0b0d13] px-4 py-3">
            <div className="flex items-center gap-2">
              <Badge className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-foreground/60">
                Affiliates Dashboard
              </Badge>
              {role === "superuser" ? (
                <Badge className="rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-amber-300">
                  Superuser
                </Badge>
              ) : null}
            </div>
            <Link
              href="/internal"
              className="text-sm text-foreground/65 hover:text-white"
            >
              Back to Home →
            </Link>
            <Link
              href="/internal/affiliates/new"
              className="text-sm text-sky-300 hover:text-sky-200"
            >
              + New affiliate
            </Link>
          </div>

          <section className="rounded-2xl border border-white/10 bg-[#0b0d13] p-5">
            <h1 className="text-3xl font-semibold tracking-[-0.03em] text-white">
              Boosted referral program
            </h1>
            <p className="mt-2 text-sm text-foreground/60">
              High-signal affiliates with boosted code multipliers.
            </p>

            <div className="mt-5 grid gap-4 lg:grid-cols-[2fr_1fr]">
              <div className="rounded-xl border border-white/10 bg-[#121726] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-foreground/45">
                      Affiliate
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-white">
                      {primaryAffiliate?.name ?? "Affiliate"}
                    </p>
                    <a
                      href={primaryAffiliate?.xUrl ?? "https://x.com"}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-sm text-sky-300 hover:text-sky-200"
                    >
                      {primaryAffiliate?.xHandle ?? "@affiliate"}
                      <ExternalLink className="size-3.5" />
                    </a>
                  </div>

                  <Badge className="rounded-full border border-emerald-400/35 bg-emerald-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-emerald-300">
                    Boosted
                  </Badge>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-white/10 bg-[#0f1422] p-3">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-foreground/45">
                      Code
                    </p>
                    <p className="mt-1 text-lg font-semibold text-white">
                      {primaryAffiliate?.code ?? "BLINK"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-[#0f1422] p-3">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-foreground/45">
                      Reward boost
                    </p>
                    <p className="mt-1 text-lg font-semibold text-emerald-300">
                      {primaryAffiliate?.rewardBoostLabel ?? "1.0x"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-[#0f1422] p-3">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-foreground/45">
                      Payout split
                    </p>
                    <p className="mt-1 text-lg font-semibold text-white">
                      {primaryAffiliate?.payoutSplitLabel ?? "70/30"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-lg border border-white/10 bg-[#0f1422] p-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-foreground/45">
                    Boosted referral link
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="truncate font-mono text-sm text-white">
                      {referralLink}
                    </p>
                    <button
                      type="button"
                      onClick={async () => {
                        await navigator.clipboard.writeText(referralLink);
                        toast.success("Boosted link copied");
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
                  Status
                </p>
                <p className="mt-1 text-xl font-semibold text-white">Active</p>
                <p className="mt-2 text-sm text-foreground/60">
                  This affiliate is seeded and ready to drive traffic with a
                  boosted code.
                </p>

                <div className="mt-4 space-y-2">
                  <div className="rounded-lg border border-white/10 bg-[#0f1422] p-3 text-sm text-foreground/70">
                    Priority: Tier 1 creator
                  </div>
                  <div className="rounded-lg border border-white/10 bg-[#0f1422] p-3 text-sm text-foreground/70">
                    Source: X / CT
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-white/10 bg-[#121726] p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-foreground/45">
                Seeded affiliates
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead className="text-[11px] uppercase tracking-[0.12em] text-foreground/45">
                    <tr>
                      <th className="py-2">Name</th>
                      <th className="py-2">Code</th>
                      <th className="py-2">Boost</th>
                      <th className="py-2">Split</th>
                      <th className="py-2">Profile</th>
                    </tr>
                  </thead>
                  <tbody>
                    {AFFILIATE_SEEDS.map((seed) => (
                      <tr
                        key={`${seed.code}-${seed.xHandle}`}
                        className="border-t border-white/8"
                      >
                        <td className="py-2 text-white">{seed.name}</td>
                        <td className="py-2 font-mono text-sky-300">
                          {seed.code}
                        </td>
                        <td className="py-2 text-emerald-300">
                          {seed.rewardBoostLabel}
                        </td>
                        <td className="py-2 text-white">
                          {seed.payoutSplitLabel}
                        </td>
                        <td className="py-2">
                          <a
                            href={seed.xUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-foreground/75 hover:text-white"
                          >
                            {seed.xHandle}
                            <ExternalLink className="size-3.5" />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
