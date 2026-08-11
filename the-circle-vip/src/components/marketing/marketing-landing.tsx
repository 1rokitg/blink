"use client";

import { useEffect, useState } from "react";

import { CircleLogo } from "@/components/circle-logo";
import { useI18n } from "@/components/i18n-provider";
import { LocaleLink } from "@/components/locale-link";
import { MarketingEmailCapture } from "@/components/marketing/marketing-email-capture";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { MarketingPartnersCarousel } from "@/components/marketing/marketing-partners-carousel";
import { ReentryDialog } from "@/components/marketing/reentry-dialog";
import { ReferralCapture } from "@/components/referral-capture";

function presenceCount() {
  // Soft presence pulse for the live badge — not a claimed analytics metric.
  const hour = new Date().getUTCHours();
  const base = 40 + ((hour * 7) % 55);
  const wobble = Math.floor(Date.now() / 15_000) % 9;
  return base + wobble;
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M5 12.5 10 17.5 19 7.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M7 7 17 17M17 7 7 17"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function MarketingLanding() {
  const { dictionary } = useI18n();
  const copy = dictionary.marketing;
  const [liveCount, setLiveCount] = useState(72);

  useEffect(() => {
    setLiveCount(presenceCount());
    const id = window.setInterval(() => setLiveCount(presenceCount()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="marketing-page relative min-h-screen overflow-x-hidden bg-[#07070c] text-white">
      <ReferralCapture />
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_50%_-10%,rgba(92,225,255,0.22),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_90%_20%,rgba(167,139,250,0.16),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_45%_35%_at_10%_70%,rgba(255,106,0,0.12),transparent_50%)]" />
        <div className="absolute inset-0 opacity-[0.14] [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:48px_48px]" />
      </div>

      <div className="relative">
        <MarketingHeader />
        <ReentryDialog />

        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 pt-10 pb-16 sm:px-6 sm:pt-16 sm:pb-24">
          <div className="mx-auto max-w-3xl text-center">
            <div className="marketing-fade-up inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 text-[12px] font-semibold text-emerald-300">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              {copy.liveLabel}: {liveCount} {copy.liveSuffix}
            </div>

            <div className="marketing-fade-up mt-8 flex justify-center" style={{ animationDelay: "60ms" }}>
              <CircleLogo size={72} />
            </div>

            <p
              className="marketing-fade-up mt-5 text-[12px] font-semibold tracking-[0.22em] text-[#ff6a00] uppercase"
              style={{ animationDelay: "80ms" }}
            >
              {copy.heroEyebrow}
            </p>

            <h1
              className="marketing-fade-up mt-4 font-[family-name:var(--font-syne)] text-4xl font-semibold tracking-tight text-balance sm:text-6xl"
              style={{ animationDelay: "100ms" }}
            >
              {copy.heroTitle}{" "}
              <span className="text-[#ff6a00]">{copy.heroTitleAccent}</span>
            </h1>
            <p
              className="marketing-fade-up mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/65 sm:text-lg"
              style={{ animationDelay: "160ms" }}
            >
              {copy.heroBody}
            </p>
            <p
              className="marketing-fade-up mt-4 text-sm font-medium text-white/55 italic"
              style={{ animationDelay: "200ms" }}
            >
              “{copy.heroQuote}”
            </p>

            <div
              className="marketing-fade-up mx-auto mt-8 w-full max-w-xl"
              style={{ animationDelay: "240ms" }}
            >
              <MarketingEmailCapture source="landing-hero" />
              <div className="mt-4 flex justify-center">
                <a
                  href="/#included"
                  className="text-sm font-semibold text-white/55 underline-offset-2 transition hover:text-white hover:underline"
                >
                  {copy.secondaryCta}
                </a>
              </div>
            </div>

            <div
              className="marketing-fade-up mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12px] text-white/45"
              style={{ animationDelay: "300ms" }}
            >
              <span>{copy.trustReviews}</span>
              <span className="hidden text-white/20 sm:inline">·</span>
              <span>{copy.trustAccess}</span>
              <span className="hidden text-white/20 sm:inline">·</span>
              <span>{copy.trustPay}</span>
            </div>
          </div>
        </section>

        {/* Marquee */}
        <div className="border-y border-white/8 bg-white/[0.02] py-3 overflow-hidden">
          <div className="marketing-marquee flex w-max gap-8 whitespace-nowrap text-sm font-semibold tracking-[0.18em] text-white/35 uppercase">
            {[...copy.marquee, ...copy.marquee].map((item, index) => (
              <span key={`${item}-${index}`} className="flex items-center gap-8">
                {item}
                <span className="text-[#5ce1ff]/50">•</span>
              </span>
            ))}
          </div>
        </div>

        {/* Movement stats */}
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-[family-name:var(--font-syne)] text-3xl font-semibold tracking-tight sm:text-4xl">
              {copy.movementTitle}
            </h2>
            <p className="mt-4 text-white/60">{copy.movementBody}</p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {copy.stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-3xl border border-white/10 bg-white/[0.03] px-5 py-7 text-center"
              >
                <p className="font-[family-name:var(--font-syne)] text-4xl font-semibold text-[#5ce1ff]">
                  {stat.value}
                </p>
                <p className="mt-2 text-sm text-white/55">{stat.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Achievements */}
        <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-[family-name:var(--font-syne)] text-3xl font-semibold tracking-tight sm:text-4xl">
              {copy.achieveTitle}
            </h2>
            <p className="mt-4 text-white/60">{copy.achieveBody}</p>
          </div>
          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            {copy.achievements.map((item) => (
              <div
                key={item.title}
                className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-transparent p-6"
              >
                <h3 className="text-xl font-semibold tracking-tight">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/60">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-12 rounded-3xl border border-[#5ce1ff]/20 bg-[#5ce1ff]/8 px-6 py-10 text-center">
            <h3 className="font-[family-name:var(--font-syne)] text-2xl font-semibold">
              {copy.midCtaTitle}
            </h3>
            <p className="mx-auto mt-3 max-w-xl text-sm text-white/65">
              {copy.midCtaBody}
            </p>
            <MarketingEmailCapture
              source="landing-mid"
              className="mx-auto mt-6 max-w-xl"
            />
            <p className="mt-3 text-[12px] text-white/45">{copy.midCtaHint}</p>
          </div>
        </section>

        {/* Pain points */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <h2 className="font-[family-name:var(--font-syne)] text-3xl font-semibold tracking-tight sm:text-4xl">
                {copy.painTitle}
              </h2>
              <p className="mt-4 text-white/60">{copy.painBody}</p>
              <ul className="mt-8 space-y-3">
                {copy.pains.map((pain) => (
                  <li
                    key={pain}
                    className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white/75"
                  >
                    <span className="mt-0.5 text-rose-400">
                      <XIcon />
                    </span>
                    {pain}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl border border-white/10 bg-[#0c0c14] p-7 sm:p-8">
              <h3 className="text-2xl font-semibold tracking-tight">
                {copy.painCtaTitle}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-white/60">
                {copy.painCtaBody}
              </p>
              <LocaleLink
                href="/join#checkout"
                className="mt-7 inline-flex w-full items-center justify-center rounded-2xl bg-[#ff6a00] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#ff8126]"
              >
                {copy.painCtaButton}
              </LocaleLink>
            </div>
          </div>
        </section>

        {/* Differently */}
        <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-[family-name:var(--font-syne)] text-3xl font-semibold tracking-tight sm:text-4xl">
              {copy.differTitle}
            </h2>
            <p className="mt-4 text-white/60">{copy.differBody}</p>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {copy.steps.map((step, index) => (
              <div
                key={step.title}
                className="rounded-3xl border border-white/10 bg-white/[0.03] p-6"
              >
                <p className="text-[12px] font-bold tracking-[0.2em] text-[#5ce1ff]">
                  0{index + 1}
                </p>
                <h3 className="mt-3 text-xl font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/60">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <div className="rounded-3xl border border-white/8 bg-white/[0.02] p-6">
              <h3 className="text-lg font-semibold text-white/55">
                {copy.othersTitle}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {copy.others.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2 text-sm text-white/50"
                  >
                    <XIcon className="mt-0.5 text-rose-400/80" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl border border-[#5ce1ff]/25 bg-[#5ce1ff]/8 p-6">
              <h3 className="text-lg font-semibold text-[#5ce1ff]">
                {copy.oursTitle}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {copy.ours.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2 text-sm text-white/85"
                  >
                    <CheckIcon className="mt-0.5 text-[#5ce1ff]" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-10 text-center">
            <p className="text-sm text-white/55">{copy.differCtaTitle}</p>
            <LocaleLink
              href="/join#checkout"
              className="mt-4 inline-flex rounded-2xl bg-[#ff6a00] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-[#ff8126]"
            >
              {copy.differCtaButton}
            </LocaleLink>
          </div>
        </section>

        {/* OG Whop reviews */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-[family-name:var(--font-syne)] text-3xl font-semibold tracking-tight sm:text-4xl">
              {copy.reviewsTitle}
            </h2>
            <div className="mt-5 flex items-center justify-center gap-3">
              <p className="font-[family-name:var(--font-syne)] text-4xl font-semibold text-white">
                {copy.reviewsRating}
              </p>
              <div className="flex text-[#fbbf24]" aria-hidden>
                {"★★★★★".split("").map((star, i) => (
                  <span key={i}>{star}</span>
                ))}
              </div>
            </div>
            <p className="mt-2 text-sm text-white/50">{copy.reviewsCount}</p>
          </div>
          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            {copy.reviews.map((review) => (
              <figure
                key={review.author}
                className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ff6a00]/20 text-sm font-bold text-[#ff6a00]">
                    {review.author.slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <figcaption className="text-sm font-semibold text-white">
                      {review.author}
                    </figcaption>
                    <p className="text-[#fbbf24] text-[12px]" aria-label="5 stars">
                      ★★★★★
                    </p>
                  </div>
                </div>
                <blockquote className="mt-4 text-sm leading-relaxed text-white/70">
                  “{review.body}”
                </blockquote>
              </figure>
            ))}
          </div>
        </section>

        {/* Included */}
        <section
          id="included"
          className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6 sm:py-20"
        >
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-[family-name:var(--font-syne)] text-3xl font-semibold tracking-tight sm:text-4xl">
              {copy.includedTitle}
            </h2>
            <p className="mt-4 text-white/60">{copy.includedBody}</p>
          </div>
          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            {copy.included.map((block) => (
              <div
                key={block.title}
                className="rounded-3xl border border-white/10 bg-white/[0.03] p-6"
              >
                <p className="text-[11px] font-bold tracking-[0.2em] text-[#5ce1ff] uppercase">
                  {block.eyebrow}
                </p>
                <h3 className="mt-2 text-xl font-semibold">{block.title}</h3>
                <ul className="mt-4 space-y-2.5">
                  {block.items.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2 text-sm text-white/65"
                    >
                      <CheckIcon className="mt-0.5 shrink-0 text-[#5ce1ff]" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-8 rounded-3xl border border-white/10 bg-[#0c0c14] p-6 sm:p-8">
            <h3 className="text-lg font-semibold">{copy.bonusesTitle}</h3>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {copy.bonuses.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-sm text-white/65"
                >
                  <CheckIcon className="mt-0.5 text-[#5ce1ff]" />
                  {item}
                </li>
              ))}
            </ul>
            <LocaleLink
              href="/join#checkout"
              className="mt-7 inline-flex rounded-2xl bg-[#ff6a00] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-[#ff8126]"
            >
              {copy.includedCta}
            </LocaleLink>
          </div>
        </section>

        {/* Product confidence carousel */}
        <MarketingPartnersCarousel />

        {/* Final CTA */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-[#0b7cff]/30 via-[#1a1460]/50 to-[#050510] px-6 py-14 text-center sm:px-12">
            <CircleLogo size={56} />
            <h2 className="mt-6 font-[family-name:var(--font-syne)] text-3xl font-semibold tracking-tight sm:text-5xl">
              {copy.finalTitle}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-white/70">
              {copy.finalBody}
            </p>
            <MarketingEmailCapture
              source="landing-final"
              className="mx-auto mt-8 max-w-xl"
            />
            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[12px] text-white/45">
              {copy.finalHints.map((hint) => (
                <span key={hint}>{hint}</span>
              ))}
            </div>
          </div>
        </section>

        <footer className="border-t border-white/8 px-4 py-8 text-center text-[12px] text-white/35 sm:px-6">
          {copy.footer}
        </footer>
      </div>
    </div>
  );
}
