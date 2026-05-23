"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Check, CircleHelp, Gift, Shield, Zap } from "lucide-react";

type Tier = "basic" | "preferred" | "premium";
type Billing = "monthly" | "yearly";

const tierMeta: Record<
  Tier,
  {
    name: string;
    monthly: number;
    yearly: number;
    blurb: string;
    badge?: string;
  }
> = {
  basic: {
    name: "Basic",
    monthly: 19,
    yearly: 190,
    blurb: "Best for active traders scaling from zero.",
  },
  preferred: {
    name: "Preferred",
    monthly: 79,
    yearly: 790,
    blurb: "For high-frequency perps operators.",
    badge: "Most popular",
  },
  premium: {
    name: "Premium",
    monthly: 249,
    yearly: 2490,
    blurb: "Desk-level package with priority everything.",
  },
};

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
  const [billing, setBilling] = useState<Billing>("yearly");
  const [selectedTier, setSelectedTier] = useState<Tier>("basic");

  const selected = tierMeta[selectedTier];
  const selectedPrice =
    billing === "yearly" ? selected.yearly : selected.monthly;
  const selectedPerMonth =
    billing === "yearly" ? selected.yearly / 12 : selected.monthly;

  const savings = useMemo(() => {
    const monthlyAnnualized = selected.monthly * 12;
    return Math.max(0, monthlyAnnualized - selected.yearly);
  }, [selected.monthly, selected.yearly]);

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
              Back to terminal
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

            <p className="mt-5 text-sm text-white/55">
              By clicking Join now, you accept terms and authorize recurring
              charges.
            </p>

            <div className="mt-6 flex items-center gap-3">
              <Link
                href="/trade/BTC"
                className="inline-flex h-12 flex-1 items-center justify-center rounded-xl border border-[#8fbaff80] bg-[linear-gradient(180deg,#3c76ff,#2457db)] px-6 text-base font-semibold text-white shadow-[0_16px_52px_rgba(37,90,224,0.45)] transition hover:brightness-110"
              >
                Join now
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

                  <Link
                    href="/trade/BTC"
                    className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-xl border border-[#8fbaff80] bg-[linear-gradient(180deg,#3c76ff,#2457db)] text-sm font-semibold text-white transition hover:brightness-110"
                  >
                    Join now
                  </Link>

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
