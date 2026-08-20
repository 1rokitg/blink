"use client";

import { useState, useTransition, type FormEvent } from "react";

import { CircleLogo } from "@/components/circle-logo";
import { useI18n } from "@/components/i18n-provider";
import { LocaleLink } from "@/components/locale-link";
import { SiteHeader } from "@/components/site-header";
import { SITE } from "@/lib/site";

type ClaimResult = {
  inviteLink?: string;
  message?: string;
  error?: string;
};

export function ClaimAccessForm() {
  const { dictionary, t } = useI18n();
  const copy = dictionary.claim;
  const [email, setEmail] = useState("");
  const [telegramUsername, setTelegramUsername] = useState("");
  const [result, setResult] = useState<ClaimResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setResult(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim(),
            telegramUsername: telegramUsername.trim() || undefined,
          }),
        });
        const data = (await response.json()) as ClaimResult;
        if (!response.ok) {
          setResult({ error: data.error ?? copy.verifyFailed });
          return;
        }
        setResult(data);
      } catch {
        setResult({ error: copy.networkError });
      }
    });
  }

  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      <div className="circle-atmosphere pointer-events-none absolute inset-0" />
      <div className="relative">
        <SiteHeader />
        <main className="mx-auto flex max-w-lg flex-col px-4 py-10 sm:px-6">
          <div className="circle-panel rounded-3xl p-6 sm:p-8">
            <div className="mb-4">
              <CircleLogo size={48} />
            </div>
            <p className="text-xs font-bold tracking-[0.18em] text-[#ff9a4d] uppercase">
              {copy.eyebrow}
            </p>
            <h1 className="mt-3 font-[family-name:var(--font-syne)] text-3xl font-bold tracking-tight">
              {copy.title}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-white/70">{copy.body}</p>

            {result?.inviteLink ? (
              <div className="mt-8 space-y-4 text-center">
                <p className="text-sm text-[#ffc48a]">
                  {result.message ?? copy.verified}
                </p>
                <a
                  href={result.inviteLink}
                  target="_blank"
                  rel="noreferrer"
                  className="circle-cta inline-flex w-full items-center justify-center rounded-2xl px-5 py-3.5 text-sm font-semibold text-white"
                >
                  {copy.openInvite}
                </a>
                <LocaleLink
                  href="/"
                  className="inline-flex text-sm text-white/55 underline-offset-2 hover:text-white hover:underline"
                >
                  {t(copy.backTo, { name: dictionary.common.siteName })}
                </LocaleLink>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-8 space-y-4">
                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold tracking-[0.14em] text-white/45 uppercase">
                    {copy.emailLabel}
                  </span>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder={copy.emailPlaceholder}
                    className="w-full rounded-2xl border border-white/15 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#ff6a00]/60"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold tracking-[0.14em] text-white/45 uppercase">
                    {copy.telegramLabel}
                  </span>
                  <input
                    type="text"
                    value={telegramUsername}
                    onChange={(event) => setTelegramUsername(event.target.value)}
                    placeholder={copy.telegramPlaceholder}
                    autoComplete="username"
                    className="w-full rounded-2xl border border-white/15 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#2ea3ff]/60"
                  />
                </label>

                <div
                  className="grid grid-cols-1 gap-3"
                  aria-label={copy.screenshotTitle}
                >
                  <a
                    href={SITE.telegramInvite}
                    target="_blank"
                    rel="noreferrer"
                    className="circle-chip group relative block overflow-hidden rounded-3xl p-5 transition hover:bg-white/15"
                  >
                    <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-[#5ce1ff]/20 blur-2xl transition group-hover:bg-[#5ce1ff]/30" />
                    <div className="pointer-events-none absolute -bottom-8 left-10 h-20 w-20 rounded-full bg-[#ff6a00]/20 blur-2xl" />
                    <p className="text-[11px] font-bold tracking-[0.18em] text-[#9fd4ff] uppercase">
                      {copy.fastestVerify}
                    </p>
                    <p className="mt-2 text-base font-semibold tracking-tight text-white">
                      {copy.screenshotTitle}
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-white/65">
                      {copy.screenshotBody}
                    </p>
                    <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#ffc48a]">
                      {copy.shareTelegram}
                      <span aria-hidden>→</span>
                    </span>
                  </a>
                </div>

                <button
                  type="submit"
                  disabled={isPending}
                  className="circle-cta flex w-full items-center justify-center rounded-2xl px-4 py-3.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPending ? copy.verifying : copy.claimInvite}
                </button>

                {result?.error ? (
                  <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                    {result.error}
                  </p>
                ) : null}

                <p className="text-center text-xs text-white/45">
                  {copy.stuck}{" "}
                  <a
                    href={SITE.telegramInvite}
                    target="_blank"
                    rel="noreferrer"
                    className="text-white/70 underline-offset-2 hover:underline"
                  >
                    @rokitgg
                  </a>
                  .
                </p>
              </form>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
