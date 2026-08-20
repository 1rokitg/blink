"use client";

import { CircleLogo } from "@/components/circle-logo";
import { useI18n } from "@/components/i18n-provider";
import { LocaleLink } from "@/components/locale-link";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { SITE } from "@/lib/site";

type Props = {
  telegramUsername?: string | null;
  onOpenPortal?: () => void;
};

export function SiteHeader({ onOpenPortal }: Props) {
  const { dictionary } = useI18n();

  return (
    <header className="sticky top-0 z-40 border-b border-white/15 bg-[#050510]/45 backdrop-blur-2xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <LocaleLink href="/" className="flex items-center gap-3">
          <CircleLogo size={36} />
          <span className="text-sm font-semibold tracking-[0.18em] text-white uppercase">
            {dictionary.common.siteName}
          </span>
        </LocaleLink>

        <div className="flex items-center gap-2 sm:gap-3">
          <LocaleSwitcher />
          <a
            href={SITE.telegramInvite}
            target="_blank"
            rel="noreferrer"
            className="circle-chip inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm text-white transition hover:bg-white/15"
          >
            <TelegramIcon />
            <span className="hidden sm:inline">{dictionary.common.group}</span>
          </a>
          <button
            type="button"
            onClick={onOpenPortal}
            className="circle-chip inline-flex items-center rounded-full px-3 py-1.5 text-sm text-white transition hover:bg-white/15"
          >
            {dictionary.common.dashboard}
          </button>
        </div>
      </div>
    </header>
  );
}

function TelegramIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}
