"use client";

import { useState } from "react";

import { CheckoutCard } from "@/components/checkout-card";
import { CircleLogo } from "@/components/circle-logo";
import { useI18n } from "@/components/i18n-provider";
import { LocaleLink } from "@/components/locale-link";
import { ReferralCapture } from "@/components/referral-capture";
import { SiteHeader } from "@/components/site-header";
import { YearlyUpsellDialog } from "@/components/yearly-upsell-dialog";
import type { Plan, PlanId } from "@/lib/plans";
import { SITE } from "@/lib/site";

type TelegramUser = {
  id: string;
  username: string | null;
  firstName: string | null;
  photoUrl: string | null;
} | null;

type Props = {
  plans: Plan[];
  initialTelegram: TelegramUser;
  stripeConfigured: boolean;
  telegramLoginConfigured: boolean;
  telegramBotUsername?: string | null;
  initialError?: string | null;
};

export function LandingPage({
  plans,
  initialTelegram,
  stripeConfigured,
  telegramLoginConfigured,
  telegramBotUsername,
  initialError,
}: Props) {
  const { dictionary } = useI18n();
  const [portalError, setPortalError] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [planId, setPlanId] = useState<PlanId>(
    plans.find((p) => p.id === "year")?.id ?? plans[0]?.id ?? "month",
  );
  const [pricingOpen, setPricingOpen] = useState(false);

  async function openPortal() {
    setPortalError(null);
    setPortalLoading(true);
    try {
      const response = await fetch("/api/portal", { method: "POST" });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        setPortalError(data.error ?? dictionary.landing.portalError);
        return;
      }
      window.location.href = data.url;
    } catch {
      setPortalError(dictionary.landing.portalNetworkError);
    } finally {
      setPortalLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      <ReferralCapture />
      <div className="circle-atmosphere pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:radial-gradient(rgba(255,255,255,0.28)_1px,transparent_1px)] [background-size:26px_26px]" />

      <div className="relative">
        <SiteHeader
          telegramUsername={initialTelegram?.username}
          onOpenPortal={() => {
            void openPortal();
          }}
        />

        <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
          <section
            aria-label={dictionary.common.siteName}
            className="circle-panel circle-panel-hero relative overflow-hidden rounded-[2rem] px-5 py-10 text-center sm:px-10 sm:py-14"
          >
            <div className="relative">
              <div className="circle-logo-float mx-auto w-fit">
                <CircleLogo size={88} />
              </div>
              <h1 className="mt-6 font-[family-name:var(--font-syne)] text-4xl font-bold tracking-tight text-white sm:text-5xl">
                {dictionary.common.siteName}
              </h1>
              <p className="mx-auto mt-3 max-w-lg text-base text-white/80 sm:text-lg">
                {dictionary.common.tagline}
              </p>
              <p className="circle-opportunity mt-2 text-sm font-semibold tracking-wide">
                {dictionary.landing.heroKicker}
              </p>
              <LocaleLink
                href="/#included"
                className="circle-cta mt-7 inline-flex rounded-2xl px-6 py-3 text-sm font-semibold text-white transition"
              >
                {dictionary.landing.learnMore}
              </LocaleLink>
            </div>
          </section>

          {(portalError || portalLoading) && (
            <p className="mt-3 text-sm text-white/80">
              {portalLoading ? dictionary.landing.openingPortal : portalError}
            </p>
          )}

          <div className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
            <div className="space-y-6">
              <section
                aria-label={dictionary.landing.benefitsTitle}
                className="circle-panel rounded-3xl p-5 sm:p-6"
              >
                <h2 className="text-xl font-semibold">
                  {dictionary.landing.benefitsTitle}
                </h2>
                <ul className="mt-4 space-y-3">
                  {dictionary.landing.benefits.map((benefit) => (
                    <li key={benefit} className="flex gap-3 text-sm text-white/85">
                      <span className="mt-0.5 text-[#5ce1ff]">✓</span>
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section
                aria-label={dictionary.landing.plansTitle}
                className="circle-panel rounded-3xl p-5 sm:p-6"
              >
                <h2 className="text-xl font-semibold">
                  {dictionary.landing.plansTitle}
                </h2>
                <p className="mt-1 text-sm text-white/65">
                  {dictionary.landing.plansSubtitle}
                </p>
                <ul className="mt-4 space-y-4">
                  {plans.map((item) => {
                    const monthly =
                      plans.find((p) => p.id === "month")?.amountEur ?? 43.28;
                    const was =
                      item.id === "month"
                        ? item.amountEur * 2
                        : Math.max(
                            item.amountEur * 2,
                            monthly *
                              (item.interval === "year"
                                ? 12 * item.intervalCount
                                : item.intervalCount),
                          );
                    return (
                      <li
                        key={item.id}
                        className="border-b border-white/15 pb-4 last:border-b-0 last:pb-0"
                      >
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="font-medium text-white">{item.label}</p>
                          <p className="shrink-0 text-right">
                            {was > item.amountEur ? (
                              <span className="mr-2 text-sm text-white/40 line-through">
                                €{Math.round(was)}
                              </span>
                            ) : null}
                            <span className="font-semibold text-white">
                              €{item.amountEur.toFixed(2)}
                            </span>
                          </p>
                        </div>
                        <p className="mt-1 text-sm text-white/70">
                          {item.description}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </section>

              <section
                aria-label={dictionary.landing.howItWorksTitle}
                className="circle-panel rounded-3xl p-5 sm:p-6"
              >
                <h2 className="text-xl font-semibold">
                  {dictionary.landing.howItWorksTitle}
                </h2>
                <ol className="mt-4 space-y-3">
                  {dictionary.landing.steps.map((step, index) => (
                    <li key={step} className="flex gap-3 text-sm text-white/85">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#5ce1ff]/15 text-xs font-bold text-[#5ce1ff]">
                        {index + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </section>
            </div>

            <div className="lg:sticky lg:top-24">
              <CheckoutCard
                plans={plans}
                initialTelegram={initialTelegram}
                stripeConfigured={stripeConfigured}
                telegramLoginConfigured={telegramLoginConfigured}
                telegramBotUsername={telegramBotUsername}
                initialError={initialError}
                planId={planId}
                onPlanIdChange={setPlanId}
                onOpenPricingDialog={() => setPricingOpen(true)}
              />
            </div>
          </div>

          <YearlyUpsellDialog
            plans={plans}
            open={pricingOpen}
            onOpenChange={setPricingOpen}
            onSelectPlan={setPlanId}
            stripeConfigured={stripeConfigured}
          />

          <section aria-label={dictionary.landing.partnersTitle} className="mt-8">
            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold sm:text-2xl">
                  {dictionary.landing.partnersTitle}
                </h2>
                <p className="mt-1 text-sm text-white/60">
                  {dictionary.landing.partnersSubtitle}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {SITE.partners.map((partner) => (
                <a
                  key={partner.id}
                  href={partner.href}
                  target="_blank"
                  rel="noreferrer sponsored"
                  className="circle-bento-card group relative flex min-h-[150px] flex-col justify-between rounded-[1.75rem] p-5 sm:p-6"
                  style={{ background: partner.gradient }}
                >
                  <div
                    className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full blur-3xl"
                    style={{ background: partner.glow }}
                  />
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-lg font-semibold tracking-tight text-white sm:text-xl">
                        {partner.title}
                      </h3>
                      {"logo" in partner && partner.logo ? (
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-black shadow-[0_0_0_1px_rgba(255,255,255,0.08)]">
                          <img
                            src={partner.logo}
                            alt=""
                            width={28}
                            height={28}
                            className="h-7 w-7 object-contain"
                          />
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-white/75">
                      {dictionary.landing.partnerDescriptions[partner.id] ??
                        partner.title}
                    </p>
                  </div>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-white/90 transition group-hover:text-white">
                    {dictionary.landing.openApp}
                    <span aria-hidden className="transition group-hover:translate-x-0.5">
                      →
                    </span>
                  </span>
                </a>
              ))}
            </div>
          </section>

          <footer className="mt-12 border-t border-white/15 py-8 text-center text-xs text-white/55">
            <p>{dictionary.landing.footer}</p>
          </footer>
        </div>
      </div>
    </div>
  );
}
