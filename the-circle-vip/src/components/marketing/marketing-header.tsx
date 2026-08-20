"use client";

import { CircleLogo } from "@/components/circle-logo";
import { useI18n } from "@/components/i18n-provider";
import { LocaleLink } from "@/components/locale-link";
import { LocaleSwitcher } from "@/components/locale-switcher";

export function MarketingHeader() {
  const { dictionary } = useI18n();
  const copy = dictionary.marketing;

  return (
    <header className="sticky top-0 z-40 border-b border-white/8 bg-[#07070c]/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <LocaleLink href="/" className="flex items-center gap-3">
          <CircleLogo size={34} />
          <span className="text-sm font-semibold tracking-[0.18em] text-white uppercase">
            {dictionary.common.siteName}
          </span>
        </LocaleLink>

        <nav className="flex items-center gap-2 sm:gap-3">
          <LocaleSwitcher />
          <LocaleLink
            href="/join"
            className="inline-flex items-center rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-[#111] transition hover:bg-white/90"
          >
            {copy.navJoin}
          </LocaleLink>
        </nav>
      </div>
    </header>
  );
}
