"use client";

import { useI18n } from "@/components/i18n-provider";
import { SITE } from "@/lib/site";

/**
 * Infinite product confidence carousel — partner apps members trade with.
 * CSS-driven marquee (no JS timer) so it stays smooth and cheap.
 */
export function MarketingPartnersCarousel() {
  const { dictionary } = useI18n();
  const copy = dictionary.marketing;
  const partners = SITE.partners;
  // Duplicate for seamless loop
  const track = [...partners, ...partners];

  return (
    <section
      aria-label={copy.carouselTitle}
      className="relative overflow-hidden border-y border-white/8 bg-white/[0.02] py-14 sm:py-16"
    >
      <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
        <p className="text-[12px] font-semibold tracking-[0.2em] text-white/40 uppercase">
          {copy.carouselEyebrow}
        </p>
        <h2 className="mt-3 font-[family-name:var(--font-syne)] text-2xl font-semibold tracking-tight sm:text-3xl">
          {copy.carouselTitle}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-white/55">
          {copy.carouselBody}
        </p>
      </div>

      <div className="relative mt-10">
        {/* Edge fades */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-[#07070c] to-transparent sm:w-24" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-[#07070c] to-transparent sm:w-24" />

        <div className="marketing-partners-marquee flex w-max gap-4 pl-4">
          {track.map((partner, index) => {
            const description =
              dictionary.landing.partnerDescriptions[partner.id] ??
              partner.title;
            return (
              <a
                key={`${partner.id}-${index}`}
                href={partner.href}
                target="_blank"
                rel="noreferrer sponsored"
                className="group relative flex w-[280px] shrink-0 flex-col justify-between overflow-hidden rounded-3xl border border-white/10 p-5 transition hover:border-white/25 sm:w-[320px]"
                style={{ background: partner.gradient }}
              >
                <div
                  className="pointer-events-none absolute -top-8 -right-6 h-28 w-28 rounded-full blur-3xl"
                  style={{ background: partner.glow }}
                />
                <div className="relative">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg font-semibold tracking-tight text-white">
                      {partner.title}
                    </h3>
                    {"logo" in partner && partner.logo ? (
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-black/80 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]">
                        <img
                          src={partner.logo}
                          alt=""
                          width={28}
                          height={28}
                          className="h-7 w-7 object-contain"
                        />
                      </span>
                    ) : (
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 text-[11px] font-bold tracking-wide text-white/80 uppercase">
                        {partner.title.slice(0, 2)}
                      </span>
                    )}
                  </div>
                  <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-white/75">
                    {description}
                  </p>
                </div>
                <span className="relative mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-white/90 transition group-hover:text-white">
                  {dictionary.landing.openApp}
                  <span
                    aria-hidden
                    className="transition group-hover:translate-x-0.5"
                  >
                    →
                  </span>
                </span>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
