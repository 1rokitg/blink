"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@acme/ui/select";
import { useWallets } from "@privy-io/react-auth";
import { Check, CircleHelp, Gift, Shield, Zap } from "lucide-react";
import { toast } from "sonner";
import {
  getGrowthProDiscountRate,
  isGrowthModeEnabled,
} from "~/lib/blink/growth-mode";

type Tier = "basic" | "preferred" | "premium";
type Billing = "monthly" | "yearly";
type PaymentMethod = "card" | "crypto";

const CRYPTO_DISCOUNT_RATE = 0.15;

const tierMeta: Record<
  Tier,
  {
    name: string;
    monthly: number;
    yearly: number;
    blurb: string;
    badge?: string;
    feeDiscount: number;
  }
> = {
  basic: {
    name: "Basic",
    monthly: 9.99,
    yearly: 99,
    blurb: "Best for active traders scaling from zero.",
    feeDiscount: 0.2,
  },
  preferred: {
    name: "Preferred",
    monthly: 79,
    yearly: 790,
    blurb: "For high-frequency perps operators.",
    badge: "Most popular",
    feeDiscount: 0.35,
  },
  premium: {
    name: "Premium",
    monthly: 249,
    yearly: 2490,
    blurb: "Desk-level package with priority everything.",
    feeDiscount: 0.5,
  },
};

const volumePresets = [
  { label: "$10K / month", value: 10_000 },
  { label: "$100K / month", value: 100_000 },
  { label: "$1M / month", value: 1_000_000 },
  { label: "$5M / month", value: 5_000_000 },
  { label: "$10M / month", value: 10_000_000 },
];

const allBenefits = [
  "Lower routed fees on Hyperliquid execution",
  "Staking reward boost multipliers",
  "Private member-only strategy room",
  "Tax/export tooling and reporting shortcuts",
  "On-chain partner perks and rewards",
];

const tierBenefits: Record<Tier, string[]> = {
  basic: [
    "$250K/month reduced-fee routed notional",
    "5% staking reward boost",
    "Member raffles and partner drops",
    "Fast tax snapshot exports",
    "Community support queue",
  ],
  preferred: [
    "$2M/month reduced-fee routed notional",
    "10% staking reward boost",
    "Priority support + private alpha room",
    "Advanced tax/export integrations",
    "Enhanced partner rewards",
  ],
  premium: [
    "Unlimited reduced-fee routed notional",
    "15% staking reward boost",
    "White-glove support and desk onboarding",
    "Dedicated strategy review sessions",
    "Maximum partner rewards",
  ],
};

export default function BlinkProPage() {
  const { wallets } = useWallets();
  const [billing, setBilling] = useState<Billing>("monthly");
  const [selectedTier, setSelectedTier] = useState<Tier>("basic");
  const [monthlyVolume, setMonthlyVolume] = useState<number>(1_000_000);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("crypto");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutTier, setCheckoutTier] = useState<Tier | null>(null);
  const walletAddress = wallets[0]?.address;
  const growthMode = isGrowthModeEnabled();
  const growthDiscountRate = growthMode ? getGrowthProDiscountRate() : 0;

  const selected = tierMeta[selectedTier];
  const baseSelectedPrice =
    billing === "yearly" ? selected.yearly : selected.monthly;
  const selectedPrice = baseSelectedPrice * (1 - growthDiscountRate);
  const baseSelectedPerMonth =
    billing === "yearly" ? selected.yearly / 12 : selected.monthly;
  const selectedPerMonth = baseSelectedPerMonth * (1 - growthDiscountRate);
  const selectedPerMonthEffective =
    paymentMethod === "crypto"
      ? selectedPerMonth * (1 - CRYPTO_DISCOUNT_RATE)
      : selectedPerMonth;

  const savings = useMemo(() => {
    const monthlyAnnualized = selected.monthly * 12;
    return Math.max(0, monthlyAnnualized - selected.yearly);
  }, [selected.monthly, selected.yearly]);

  const membershipValue = useMemo(() => {
    const baselineFeeRate = 0.0005; // 5 bps
    const baselineMonthlyFees = monthlyVolume * baselineFeeRate;
    const estimatedSavings = baselineMonthlyFees * selected.feeDiscount;
    const netGain = estimatedSavings - selectedPerMonthEffective;
    return {
      baselineMonthlyFees,
      estimatedSavings,
      membershipCost: selectedPerMonthEffective,
      netGain,
      roi:
        selectedPerMonthEffective > 0
          ? (estimatedSavings / selectedPerMonthEffective) * 100
          : 0,
    };
  }, [monthlyVolume, selected.feeDiscount, selectedPerMonthEffective]);

  const handleCheckout = async (tier: Tier) => {
    if (checkoutLoading) return;
    setCheckoutLoading(true);
    setCheckoutTier(tier);
    const toastId = toast.loading("Preparing your 7-day free trial…");
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tier,
          billing,
          paymentMethod,
          walletAddress,
        }),
      });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "Unable to launch Stripe checkout");
      }
      toast.success("Redirecting to Stripe checkout…", { id: toastId });
      window.location.href = data.url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Checkout failed", {
        id: toastId,
      });
      setCheckoutLoading(false);
      setCheckoutTier(null);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-background px-6 py-8 text-foreground">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(62,116,255,0.22),transparent_42%),radial-gradient(circle_at_85%_12%,rgba(36,198,182,0.2),transparent_42%),radial-gradient(circle_at_52%_84%,rgba(25,70,165,0.14),transparent_45%)] blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-[1320px]">
        <header className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-5xl font-bold tracking-[-0.04em] text-white"
            >
              blink
            </Link>
            <p className="text-xl font-semibold text-white/90">Pro</p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="https://rokitg.fun"
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-[#7ea9ff66] bg-[#2b60db2b] px-3 py-2 text-sm text-[#b7d1ff] transition hover:bg-[#2b60db42]"
            >
              rokitg.fun
            </a>
            <Link
              href="/trade/BTC"
              className="rounded-lg border border-white/12 bg-white/[0.05] px-3 py-2 text-sm text-white/80 transition hover:bg-white/[0.1]"
            >
              Launch Terminal
            </Link>
          </div>
        </header>




      </div>
    </main>
  );
}
