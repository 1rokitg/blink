"use client";

import { useEffect, useMemo, useState } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { usePrivy, useWallets } from "@privy-io/react-auth";
import { ExternalLink, Wrench } from "lucide-react";

import { Badge } from "@acme/ui/badge";

import {
  type AdminAccessResult,
  getAdminAccess,
} from "~/app/actions/get-admin-access";
import { AffiliateLeaderboardPanel } from "~/components/blink/affiliate-leaderboard-panel";
import { InternalAccessCheckpoint } from "./internal-access-checkpoint";

export function AffiliatesDashboard() {
  const pathname = usePathname();
  const { user } = usePrivy();
  const { wallets } = useWallets();
  const connectedWallets = useMemo(
    () =>
      wallets
        .map((wallet) => wallet.address?.toLowerCase())
        .filter((address): address is string => Boolean(address)),
    [wallets],
  );
  const identityEmails = useMemo(
    () =>
      [user?.email?.address, user?.google?.email].filter(
        (email): email is string => Boolean(email),
      ),
    [user],
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
        const access = await getAdminAccess(connectedWallets, identityEmails);
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
  }, [connectedWallets, identityEmails]);

  const isAllowed = adminAccess.allowed;
  const role = adminAccess.role;

  if (checkingAccess) {
    return <InternalAccessCheckpoint label="Internal Security" />;
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
              className={`flex w-full items-center rounded-xl px-3 py-2 text-left text-sm transition ${
                pathname === "/internal"
                  ? "bg-white/12 text-white"
                  : "text-foreground/60 hover:bg-white/[0.06] hover:text-white/85"
              }`}
            >
              Home
            </Link>
            <Link
              href="/internal/tools"
              className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition ${
                pathname === "/internal/tools"
                  ? "bg-white/12 text-white"
                  : "text-foreground/60 hover:bg-white/[0.06] hover:text-white/85"
              }`}
            >
              <Wrench className="size-4 shrink-0 text-foreground/55" />
              Tools
            </Link>
            <Link
              href="/internal/affiliates"
              className={`flex w-full items-center rounded-xl px-3 py-2 text-left text-sm transition ${
                pathname === "/internal/affiliates"
                  ? "bg-white/12 text-white"
                  : "text-foreground/60 hover:bg-white/[0.06] hover:text-white/85"
              }`}
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
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
            <h1 className="text-3xl font-semibold tracking-[-0.03em] text-white">
              Boosted referral program
            </h1>
                <p className="mt-2 text-sm text-foreground/60">
                  High-signal affiliates with boosted code multipliers. Rankings
                  update from live referral and funnel data.
                </p>
              </div>
              <Link
                href="/affiliates/leaderboard"
                target="_blank"
                className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-sky-300 transition hover:bg-white/[0.07] hover:text-sky-200"
              >
                View public leaderboard
                <ExternalLink className="size-3.5" />
              </Link>
            </div>

            <div className="mt-5">
              <AffiliateLeaderboardPanel showInternalFields />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
