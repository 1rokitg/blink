import type { Metadata } from "next";

import { DepositCard } from "~/components/blink/deposit-card";

export const metadata: Metadata = {
  title: "Deposit · Blink",
  description:
    "Fund your Blink account to start trading perpetuals on Hyperliquid. Fast, secure, self-custody.",
  openGraph: {
    title: "Deposit · Blink",
    description:
      "Fund your account and start trading perps on Hyperliquid with zero maker fees.",
    url: "https://blink.lat/deposit",
  },
  twitter: {
    card: "summary_large_image",
    title: "Deposit · Blink",
    description:
      "Fund your account and start trading perps on Hyperliquid with zero maker fees.",
  },
};

export default function DepositPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12 text-foreground">
      {/* Ambient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div className="absolute left-1/2 top-1/2 h-[600px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(44,107,255,0.13)_0%,transparent_70%)] blur-3xl" />
      </div>

      <DepositCard />
    </main>
  );
}
