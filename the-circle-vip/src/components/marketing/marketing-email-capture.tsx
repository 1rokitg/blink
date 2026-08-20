"use client";

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import { useI18n } from "@/components/i18n-provider";
import { LocaleLink } from "@/components/locale-link";
import {
  Credenza,
  CredenzaBody,
  CredenzaContent,
  CredenzaDescription,
  CredenzaFooter,
  CredenzaHeader,
  CredenzaTitle,
} from "@/components/ui/credenza";
import { ensureStoredAttribution } from "@/lib/attribution";
import { SITE } from "@/lib/site";

type Props = {
  /** Analytics / CRM source tag stored on the lead. */
  source?: string;
  className?: string;
  /** Show a secondary link to paid checkout under the form. */
  showJoinLink?: boolean;
};

const CONFETTI_COLORS = [
  "#ff6a00",
  "#ffb079",
  "#5ce1ff",
  "#34d399",
  "#a78bfa",
  "#fbbf24",
  "#ffffff",
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function CaptureConfetti({ active }: { active: boolean }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 28 }, (_, index) => {
        const angle = (index / 28) * Math.PI * 2 + (index % 3) * 0.2;
        const distance = 54 + (index % 5) * 14;
        return {
          id: index,
          color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance - 12,
          rotate: (index * 37) % 360,
          delay: (index % 8) * 18,
          size: 5 + (index % 4),
        };
      }),
    [],
  );

  if (!active) return null;

  return (
    <div
      className="email-capture-confetti pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden
    >
      {pieces.map((piece) => (
        <span
          key={piece.id}
          className="email-capture-confetti__piece absolute top-1/2 left-1/2 rounded-[2px]"
          style={{
            width: piece.size,
            height: piece.size * 0.55,
            background: piece.color,
            ["--tx" as string]: `${piece.x}px`,
            ["--ty" as string]: `${piece.y}px`,
            ["--rot" as string]: `${piece.rotate}deg`,
            animationDelay: `${piece.delay}ms`,
          }}
        />
      ))}
    </div>
  );
}

function SuccessCheck() {
  return (
    <div className="email-capture-check relative mx-auto grid h-16 w-16 place-items-center">
      <span className="email-capture-check__ring absolute inset-0 rounded-full" />
      <span className="email-capture-check__glow absolute inset-1 rounded-full" />
      <svg
        width="34"
        height="34"
        viewBox="0 0 24 24"
        fill="none"
        className="relative"
        aria-hidden
      >
        <path
          className="email-capture-check__mark"
          d="M5.5 12.5 10 17l8.5-9.5"
          stroke="#34d399"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export function MarketingEmailCapture({
  source = "landing",
  className,
  showJoinLink = true,
}: Props) {
  const { dictionary, t } = useI18n();
  const copy = dictionary.marketing;
  const [email, setEmail] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [confettiOn, setConfettiOn] = useState(false);

  useEffect(() => {
    if (!open) return;
    setConfettiOn(true);
    const stop = window.setTimeout(() => setConfettiOn(false), 1800);
    return () => window.clearTimeout(stop);
  }, [open]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setError(copy.emailError);
      return;
    }

    setSubmittedEmail(trimmed);
    setOpen(true);
    setEmail("");

    void fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: trimmed,
        company: honeypot,
        source,
        attribution: ensureStoredAttribution(),
      }),
      keepalive: true,
    }).catch(() => {
      // Ignore — UX already advanced.
    });
  }

  function acceptNewsletter() {
    window.location.assign(SITE.newsletterSubscribeUrl);
  }

  return (
    <div className={className}>
      <form onSubmit={onSubmit} className="w-full">
        <div className="relative flex w-full flex-col gap-2 rounded-full border border-white/15 bg-white p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.35)] sm:flex-row sm:items-center sm:gap-0">
          <label className="sr-only" htmlFor={`circle-email-${source}`}>
            {copy.emailPlaceholder}
          </label>
          <input
            id={`circle-email-${source}`}
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={copy.emailPlaceholder}
            className="min-w-0 flex-1 rounded-full bg-transparent px-4 py-3 text-[15px] text-[#111] outline-none placeholder:text-[#71717a]"
          />
          <input
            type="text"
            name="company"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(event) => setHoneypot(event.target.value)}
            className="pointer-events-none absolute left-[-9999px] h-0 w-0 opacity-0"
            aria-hidden
          />
          <button
            type="submit"
            className="shrink-0 cursor-pointer rounded-full bg-[#111] px-5 py-3 text-[14px] font-semibold text-white transition hover:bg-[#222] sm:px-6"
          >
            {copy.emailCta}
          </button>
        </div>
        <p className="mt-2.5 text-center text-[12px] leading-relaxed text-white/45">
          {copy.emailConsent}
        </p>
      </form>
      {error ? (
        <p className="mt-2 text-center text-[13px] text-rose-300">{error}</p>
      ) : null}
      {showJoinLink ? (
        <p className="mt-3 text-center text-[13px] text-white/45">
          {copy.emailOrJoin}{" "}
          <LocaleLink
            href="/join"
            className="font-semibold text-[#ffb079] underline-offset-2 hover:text-[#ffc48a] hover:underline"
          >
            {copy.emailJoinLink}
          </LocaleLink>
        </p>
      ) : null}

      <Credenza open={open} onOpenChange={setOpen}>
        <CredenzaContent className="overflow-hidden border-emerald-400/25 bg-[#0c1412] p-0 sm:max-w-md">
          <div className="relative overflow-hidden px-5 pt-7 pb-5 text-center sm:px-7 sm:pt-8 sm:pb-6">
            <CaptureConfetti active={confettiOn} />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_0%,rgba(52,211,153,0.18),transparent_65%)]" />

            <div className="relative">
              <CredenzaHeader className="space-y-0 p-0 text-center">
                <SuccessCheck />
                <CredenzaTitle className="email-capture-success__title mt-5 font-[family-name:var(--font-syne)] text-2xl font-semibold tracking-tight text-white">
                  {copy.emailSuccessTitle}
                </CredenzaTitle>
                <CredenzaDescription className="email-capture-success__body mx-auto mt-2 max-w-sm text-sm leading-relaxed text-white/70">
                  {t(copy.emailSuccessBody, {
                    email: submittedEmail || "your inbox",
                  })}
                </CredenzaDescription>
              </CredenzaHeader>

              <CredenzaBody className="mt-6 px-0">
                <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-4 text-left sm:px-5">
                  <p className="text-[11px] font-bold tracking-[0.16em] text-[#ff6a00] uppercase">
                    {copy.newsletterEyebrow}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {copy.newsletterTitle}
                  </p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-white/60">
                    {copy.newsletterBody}
                  </p>
                </div>
              </CredenzaBody>

              <CredenzaFooter className="mt-4 grid gap-2 p-0 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={acceptNewsletter}
                  className="inline-flex cursor-pointer items-center justify-center rounded-full bg-white px-4 py-3 text-sm font-semibold text-[#111] transition hover:bg-white/90"
                >
                  {copy.newsletterYes}
                </button>
                <LocaleLink
                  href="/join"
                  className="inline-flex cursor-pointer items-center justify-center rounded-full border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  {copy.newsletterNo}
                </LocaleLink>
              </CredenzaFooter>
            </div>
          </div>
        </CredenzaContent>
      </Credenza>
    </div>
  );
}
