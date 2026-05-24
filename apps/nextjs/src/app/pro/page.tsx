"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { useWallets } from "@privy-io/react-auth";
import { Check, CircleHelp, Gift, Shield, Zap } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@acme/ui/select";
import { toast } from "sonner";

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
    monthly: 19,
    yearly: 190,
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
  const [billing, setBilling] = useState<Billing>("yearly");
  const [selectedTier, setSelectedTier] = useState<Tier>("basic");
  const [monthlyVolume, setMonthlyVolume] = useState<number>(1_000_000);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("crypto");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutTier, setCheckoutTier] = useState<Tier | null>(null);
  const walletAddress = wallets[0]?.address;

  const selected = tierMeta[selectedTier];
  const selectedPrice =
    billing === "yearly" ? selected.yearly : selected.monthly;
  const selectedPerMonth =
    billing === "yearly" ? selected.yearly / 12 : selected.monthly;
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

        <section className="mt-7 grid gap-0 overflow-hidden rounded-2xl border border-white/10 bg-[#090f1be8] backdrop-blur-xl lg:grid-cols-2">
          <div className="border-b border-white/10 p-8 lg:border-b-0 lg:border-r">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#7ea9ff4f] bg-[#2c6bff24] px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-[#a8c5ff]">
              <Zap className="size-3.5" />
              Blink Pro Membership
            </div>

            <h1 className="mt-5 text-5xl font-semibold leading-[1.02] tracking-[-0.05em] text-white">
              Join Blink Pro and pay less to trade perps.
            </h1>
            <p className="mt-4 text-xl text-white/90">
              Start from{" "}
              <span className="font-semibold text-[#8fb9ff]">
                $
                {billing === "yearly"
                  ? (tierMeta.basic.yearly / 12).toFixed(2)
                  : tierMeta.basic.monthly}
                /mo
              </span>
            </p>

            <div className="mt-6 inline-flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
              {(["basic", "preferred", "premium"] as Tier[]).map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setSelectedTier(tier)}
                  className={`rounded-lg px-4 py-2 text-sm capitalize transition ${
                    selectedTier === tier
                      ? "bg-white/14 text-white"
                      : "text-white/55 hover:text-white/80"
                  }`}
                >
                  {tierMeta[tier].name}
                </button>
              ))}
            </div>

            <div className="mt-5 space-y-3">
              <button
                type="button"
                onClick={() => setBilling("monthly")}
                className="flex w-full items-start gap-2 text-left"
              >
                <span
                  className={`mt-1 size-4 rounded-full border ${billing === "monthly" ? "border-[#6fa8ff] bg-[#2c6bff]" : "border-white/40"}`}
                />
                <span>
                  <span className="block text-sm font-medium text-white">
                    Monthly
                  </span>
                  <span className="block text-sm text-white/65">
                    ${selected.monthly}/month
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setBilling("yearly")}
                className="flex w-full items-start gap-2 text-left"
              >
                <span
                  className={`mt-1 size-4 rounded-full border ${billing === "yearly" ? "border-[#6fa8ff] bg-[#2c6bff]" : "border-white/40"}`}
                />
                <span>
                  <span className="inline-flex items-center gap-2 text-sm font-medium text-white">
                    Yearly
                    <span className="rounded-md bg-[#2c6bff] px-2 py-0.5 text-[11px] uppercase tracking-[0.12em] text-white">
                      Save ${(savings / 12).toFixed(0)}/mo
                    </span>
                  </span>
                  <span className="block text-sm text-white/65">
                    ${selected.yearly}/year
                  </span>
                </span>
              </button>
            </div>

            <div className="mt-6 rounded-xl border border-[#7ea9ff40] bg-[#2c6bff1f] p-4 text-sm text-[#b7d1ff]">
              Bonus: Pro members get a 3% rebate pool on eligible routed volume
              campaigns.
            </div>

            <div className="mt-4 rounded-xl border border-[#41d38f55] bg-[#163328cc] p-4">
              <p className="text-sm font-semibold text-[#95f4cc]">
                Crypto payment discount: 15% off
              </p>
              <p className="mt-1 text-xs text-[#c8f2df]">
                Encourage payment on-chain and keep more edge per month.
              </p>
              <div className="mt-3 inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-1">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("crypto")}
                  className={`rounded-md px-3 py-1.5 text-xs transition ${
                    paymentMethod === "crypto"
                      ? "bg-[#41d38f2e] text-[#9ef1cb]"
                      : "text-white/55 hover:text-white/85"
                  }`}
                >
                  Crypto (15% off)
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("card")}
                  className={`rounded-md px-3 py-1.5 text-xs transition ${
                    paymentMethod === "card"
                      ? "bg-white/12 text-white"
                      : "text-white/55 hover:text-white/85"
                  }`}
                >
                  Card
                </button>
              </div>
            </div>

            <p className="mt-5 text-sm text-white/55">
              By clicking Join now, you accept terms and authorize recurring
              charges.
            </p>

            <div className="mt-6 flex items-center gap-3">
              <Link
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                  void handleCheckout(selectedTier);
                }}
                className="inline-flex h-12 flex-1 items-center justify-center rounded-xl border border-[#8fbaff80] bg-[linear-gradient(180deg,#3c76ff,#2457db)] px-6 text-base font-semibold text-white shadow-[0_16px_52px_rgba(37,90,224,0.45)] transition hover:brightness-110"
              >
                {checkoutLoading && checkoutTier === selectedTier
                  ? "Loading trial…"
                  : "Start 7-day free trial"}
              </Link>
              <button
                type="button"
                className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/12 bg-white/[0.05] px-4 text-sm text-white/75 transition hover:bg-white/[0.1]"
              >
                <Gift className="size-4" />
                ****4244
              </button>
            </div>
          </div>

          <div className="p-8">
            <h2 className="text-4xl font-semibold tracking-[-0.03em] text-white">
              Core benefits
            </h2>
            <div className="mt-6 space-y-5">
              {allBenefits.map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex size-6 items-center justify-center rounded-full bg-[#123276] text-[#8fb9ff]">
                    <Check className="size-3.5" />
                  </span>
                  <p className="text-lg text-white/88">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-[#7ea9ff4a] bg-[#0d1730de] p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-[#9fc0ff]">
                Membership value
              </p>
              <h3 className="mt-2 text-4xl font-semibold tracking-[-0.04em] text-white">
                Volume in, savings out.
              </h3>
              <p className="mt-1 text-sm text-white/60">
                Pick your monthly routed volume and Blink Pro shows the fee
                delta.
              </p>
            </div>
            <div className="w-full max-w-[250px]">
              <p className="mb-2 text-xs uppercase tracking-[0.14em] text-white/45">
                Monthly volume
              </p>
              <Select
                value={String(monthlyVolume)}
                onValueChange={(v) => setMonthlyVolume(Number(v))}
              >
                <SelectTrigger className="h-11 rounded-xl border-white/12 bg-white/[0.04] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {volumePresets.map((preset) => (
                    <SelectItem key={preset.value} value={String(preset.value)}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs text-white/50">Baseline monthly fees</p>
              <p className="mt-1 text-2xl font-semibold text-white">
                ${membershipValue.baselineMonthlyFees.toFixed(2)}
              </p>
            </div>
            <div className="rounded-xl border border-[#47daa97a] bg-[#1a4a3a4a] p-4">
              <p className="text-xs text-emerald-200/80">Estimated savings</p>
              <p className="mt-1 text-2xl font-semibold text-emerald-300">
                ${membershipValue.estimatedSavings.toFixed(2)}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs text-white/50">Membership cost / mo</p>
              <p className="mt-1 text-2xl font-semibold text-white">
                ${membershipValue.membershipCost.toFixed(2)}
              </p>
              {paymentMethod === "crypto" ? (
                <p className="mt-1 text-xs text-emerald-300">
                  15% discount applied
                </p>
              ) : null}
            </div>
            <div className="rounded-xl border border-[#8fbaff63] bg-[#2d64df2e] p-4">
              <p className="text-xs text-[#bdd6ff]">Net Monthly Savings</p>
              <p
                className={`mt-1 text-2xl font-semibold ${
                  membershipValue.netGain >= 0
                    ? "text-emerald-300"
                    : "text-rose-300"
                }`}
              >
                {membershipValue.netGain >= 0 ? "+" : ""}$
                {membershipValue.netGain.toFixed(2)}
              </p>
              <p className="mt-1 text-xs text-[#bdd6ff]/85">
                {membershipValue.roi.toFixed(0)}% value-to-cost ratio
              </p>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-4 flex items-end justify-between">
            <h3 className="text-5xl font-semibold tracking-[-0.04em] text-white">
              Compare plans
            </h3>
            <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
              <button
                type="button"
                onClick={() => setBilling("monthly")}
                className={`rounded-lg px-3 py-1.5 text-sm ${billing === "monthly" ? "bg-white/14 text-white" : "text-white/55"}`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBilling("yearly")}
                className={`rounded-lg px-3 py-1.5 text-sm ${billing === "yearly" ? "bg-white/14 text-white" : "text-white/55"}`}
              >
                Yearly
              </button>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {(["basic", "preferred", "premium"] as Tier[]).map((tier) => {
              const meta = tierMeta[tier];
              const price = billing === "yearly" ? meta.yearly : meta.monthly;
              const unit = billing === "yearly" ? "/yr" : "/mo";
              return (
                <article
                  key={tier}
                  className={`rounded-2xl border p-6 ${
                    tier === "basic"
                      ? "border-[#719eff75] bg-[#0d1f4bd8]"
                      : "border-white/10 bg-[#0a1226de]"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-4xl font-semibold text-white">
                        {meta.name}
                      </p>
                      <p className="mt-1 text-2xl text-white/80">
                        ${price}
                        <span className="text-lg text-white/55">{unit}</span>
                      </p>
                    </div>
                    {meta.badge ? (
                      <span className="rounded-full border border-[#7ea9ff62] bg-[#2c6bff2e] px-2.5 py-1 text-xs text-[#b8d3ff]">
                        {meta.badge}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm text-white/60">{meta.blurb}</p>

                  <button
                    type="button"
                    onClick={() => void handleCheckout(tier)}
                    disabled={checkoutLoading}
                    className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-xl border border-[#8fbaff80] bg-[linear-gradient(180deg,#3c76ff,#2457db)] text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
                  >
                    {checkoutLoading && checkoutTier === tier
                      ? "Loading trial…"
                      : "Start 7-day free trial"}
                  </button>

                  <div className="mt-5 space-y-3 border-t border-white/10 pt-5">
                    {tierBenefits[tier].map((benefit) => (
                      <div
                        key={benefit}
                        className="flex items-start gap-2 text-sm text-white/82"
                      >
                        <Check className="mt-0.5 size-4 shrink-0 text-emerald-300" />
                        <span>{benefit}</span>
                      </div>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <footer className="mt-8 border-t border-white/10 pt-5 text-sm text-white/45">
          <p>
            Reduced fees apply to eligible routed perps volume. Platform spread
            and external protocol costs may still apply.
          </p>
          <div className="mt-3 flex items-center gap-4 text-white/40">
            <span className="inline-flex items-center gap-1">
              <Shield className="size-4" />
              Non-custodial
            </span>
            <span className="inline-flex items-center gap-1">
              <CircleHelp className="size-4" />
              Cancel anytime
            </span>
          </div>
        </footer>
      </div>
    </main>
  );
}
