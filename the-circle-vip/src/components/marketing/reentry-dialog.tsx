"use client";

import { useEffect, useId, useRef, useState } from "react";

import { useI18n } from "@/components/i18n-provider";
import { LocaleLink } from "@/components/locale-link";
import { SITE } from "@/lib/site";

const SESSION_KEY = "circle:reentry-dialog:shown";

/**
 * Mirrors the TJR-style return dialog: when the visitor leaves the tab
 * (document hidden) and comes back, open a one-shot CTA modal.
 */
export function ReentryDialog() {
  const { dictionary } = useI18n();
  const copy = dictionary.marketing;
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const leftTab = useRef(false);

  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === "hidden") {
        leftTab.current = true;
        return;
      }
      if (
        document.visibilityState === "visible" &&
        leftTab.current &&
        !open
      ) {
        try {
          if (sessionStorage.getItem(SESSION_KEY) === "1") return;
          sessionStorage.setItem(SESSION_KEY, "1");
        } catch {
          // sessionStorage may be blocked — still show once this mount.
        }
        leftTab.current = false;
        setOpen(true);
      }
    }

    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!open) return null;

  const videoId = SITE.marketingVideoId;
  const isLive = SITE.marketingVideoIsLive;
  const liveUrl = SITE.marketingVideoLiveUrl;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
      role="presentation"
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="marketing-reentry relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-[#0c0c12] p-6 shadow-[0_30px_120px_rgba(0,0,0,0.65)] sm:p-8"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
          aria-label="Close"
        >
          ×
        </button>

        {isLive ? (
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-red-400/35 bg-red-500/15 px-3 py-1.5 text-[12px] font-bold tracking-[0.16em] text-red-300 uppercase">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-400" />
            </span>
            {copy.reentryLiveBadge}
          </div>
        ) : (
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#5ce1ff]/50 bg-[#5ce1ff]/10 text-[#5ce1ff]">
            <PlayIcon />
          </div>
        )}

        <h2
          id={titleId}
          className="mt-5 text-center font-[family-name:var(--font-syne)] text-2xl font-semibold tracking-tight text-white sm:text-3xl"
        >
          {copy.reentryTitle}
        </h2>
        <p className="mt-3 text-center text-sm leading-relaxed text-white/60 sm:text-[15px]">
          {copy.reentryBody}
        </p>

        {videoId ? (
          <div className="relative mt-6 overflow-hidden rounded-2xl border border-white/10 bg-black">
            {isLive ? (
              <div className="absolute top-3 left-3 z-10 inline-flex items-center gap-1.5 rounded-md bg-red-600 px-2 py-1 text-[10px] font-bold tracking-wide text-white uppercase shadow-lg">
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
                {copy.reentryLiveBadge}
              </div>
            ) : null}
            <div className="relative aspect-video w-full">
              <iframe
                title={copy.reentryTitle}
                src={`https://www.youtube.com/embed/${videoId}?rel=0${isLive ? "&autoplay=0" : ""}`}
                className="absolute inset-0 h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-white/10 bg-gradient-to-br from-[#0b7cff]/25 via-[#1a1460]/40 to-[#050510] p-5">
            <p className="text-sm font-medium text-white/85">
              {dictionary.common.tagline}
            </p>
            <p className="mt-2 text-[13px] text-white/55">
              {copy.trustReviews} · {copy.trustAccess} · {copy.trustPay}
            </p>
          </div>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <LocaleLink
            href="/join#checkout"
            className="inline-flex items-center justify-center rounded-2xl bg-[#ff6a00] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#ff8126]"
            onClick={() => setOpen(false)}
          >
            {copy.reentryPrimary}
          </LocaleLink>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            {copy.reentrySecondary}
          </button>
        </div>

        <a
          href={isLive ? liveUrl : "/#included"}
          target={isLive ? "_blank" : undefined}
          rel={isLive ? "noreferrer" : undefined}
          className="mt-4 block text-center text-[13px] font-medium text-[#70a7ff] hover:underline"
          onClick={() => setOpen(false)}
        >
          {copy.reentryWatch}
        </a>
      </div>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86a1 1 0 0 0-1.5.86Z" />
    </svg>
  );
}
