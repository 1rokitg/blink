"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";

import { useI18n } from "@/components/i18n-provider";
import { LOCALE_COOKIE, type Locale } from "@/lib/i18n/config";
import { localizePath, stripLocalePath } from "@/lib/i18n/path";

function setLocaleCookie(locale: Locale) {
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

function FlagUs() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 12"
      className="h-3 w-4 shrink-0 rounded-[2px] shadow-[0_0_0_1px_rgba(255,255,255,0.12)]"
    >
      <rect width="16" height="12" fill="#b22234" />
      <path
        fill="#fff"
        d="M0 1.2h16v1.2H0zm0 2.4h16v1.2H0zm0 2.4h16v1.2H0zm0 2.4h16v1.2H0z"
      />
      <rect width="7.2" height="6.4" fill="#3c3b6e" />
    </svg>
  );
}

function FlagEs() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 12"
      className="h-3 w-4 shrink-0 rounded-[2px] shadow-[0_0_0_1px_rgba(255,255,255,0.12)]"
    >
      <rect width="16" height="12" fill="#c60b1e" />
      <rect y="3" width="16" height="6" fill="#ffc400" />
    </svg>
  );
}

export function LocaleSwitcher() {
  const { locale, dictionary } = useI18n();
  const router = useRouter();
  const pathname = usePathname() || "/";
  const [isPending, startTransition] = useTransition();

  function prefetch(next: Locale) {
    if (next === locale) return;
    router.prefetch(localizePath(next, stripLocalePath(pathname)));
  }

  function switchTo(next: Locale) {
    if (next === locale || isPending) return;
    setLocaleCookie(next);
    const href = localizePath(next, stripLocalePath(pathname));

    const run = () => {
      startTransition(() => {
        router.push(href);
      });
    };

    // Snapshot only after React schedules the nav; avoid named nested
    // view-transition elements (they ghost the switcher in the header).
    const doc = document as Document & {
      startViewTransition?: (cb: () => void) => void;
    };
    if (typeof doc.startViewTransition === "function") {
      doc.startViewTransition(run);
    } else {
      run();
    }
  }

  const isEn = locale === "en";

  return (
    <div
      className="relative inline-grid grid-cols-2 rounded-full border border-white/15 bg-black/25 p-0.5 text-xs font-semibold"
      role="group"
      aria-label={dictionary.common.language}
      aria-busy={isPending}
    >
      {/* Sliding selected pill — no view-transition-name, so it won’t ghost */}
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-y-0.5 w-[calc(50%-2px)] rounded-full bg-white/15 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] transition-[left] duration-200 ease-out ${
          isEn ? "left-0.5" : "left-[calc(50%)]"
        }`}
      />

      <button
        type="button"
        onClick={() => switchTo("en")}
        onPointerEnter={() => prefetch("en")}
        onFocus={() => prefetch("en")}
        className={`relative z-10 inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-full px-2.5 py-1 transition-colors duration-150 ${
          isEn ? "text-white" : "text-white/55 hover:text-white"
        }`}
        aria-pressed={isEn}
        aria-label={dictionary.common.english}
      >
        <FlagUs />
        EN
      </button>
      <button
        type="button"
        onClick={() => switchTo("es")}
        onPointerEnter={() => prefetch("es")}
        onFocus={() => prefetch("es")}
        className={`relative z-10 inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-full px-2.5 py-1 transition-colors duration-150 ${
          !isEn ? "text-white" : "text-white/55 hover:text-white"
        }`}
        aria-pressed={!isEn}
        aria-label={dictionary.common.spanish}
      >
        <FlagEs />
        ES
      </button>
    </div>
  );
}
