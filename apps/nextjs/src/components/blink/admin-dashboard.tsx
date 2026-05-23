"use client";

import Link from "next/link";

import { useWallets } from "@privy-io/react-auth";

import { Badge } from "@acme/ui/badge";

function readAdminAllowlist() {
  const source = process.env.NEXT_PUBLIC_ADMIN_WALLET_ALLOWLIST ?? "";
  return source
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function AdminDashboard() {
  const { wallets } = useWallets();
  const walletAddress = wallets[0]?.address?.toLowerCase() ?? "";
  const isAllowed = walletAddress
    ? readAdminAllowlist().includes(walletAddress)
    : false;

  if (!isAllowed) {
    return (
      <main className="min-h-screen bg-background px-6 py-8 text-foreground">
        <div className="mx-auto max-w-3xl">
          <section className="glass-card p-8">
            <Badge className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-foreground/60">
              Admin
            </Badge>
            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white">
              Allowlisted wallet required.
            </h1>
            <p className="mt-3 text-base leading-7 text-foreground/58">
              Blink admin is gated behind a Privy wallet allowlist. Add your
              wallet to `NEXT_PUBLIC_ADMIN_WALLET_ALLOWLIST` to unlock the
              internal metrics surface.
            </p>
            <Link
              href="/trade/BTC"
              className="mt-6 inline-flex text-sm text-foreground/60 transition hover:text-foreground/82"
            >
              Return to terminal
            </Link>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-6 py-8 text-foreground">
      <div className="mx-auto max-w-6xl">
        <section className="glass-card p-8">
          <Badge className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-foreground/60">
            Internal dashboard
          </Badge>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white">
            Builder-fee and product analytics surface
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-foreground/58">
            This route is reserved for Blink internal metrics. The UI is in
            place for wallet connects, builder approvals, routed volume, and
            event-quality checks once the event tables and APIs land.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-4">
            {[
              "Wallet connects",
              "Builder approvals",
              "Routed volume",
              "App errors",
            ].map((item) => (
              <div key={item} className="glass-panel min-h-[128px] p-4">
                <p className="terminal-label">{item}</p>
                <p className="mt-5 text-2xl font-semibold text-white">
                  Coming next
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
