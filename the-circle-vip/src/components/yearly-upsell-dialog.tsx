"use client";

import { useEffect, useId, useState, useTransition } from "react";

import { useI18n } from "@/components/i18n-provider";
import type { Plan, PlanId } from "@/lib/plans";
import {
  compareAtEur,
  formatEurWhole,
  monthlyPlan,
  perMonthEur,
  savePercent,
  yearlyPlan,
  type BillingInterval,
} from "@/lib/pricing-display";
import { SITE } from "@/lib/site";

const SESSION_KEY = "circle_yearly_upsell_v1";

type Props = {
  plans: Plan[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectPlan: (planId: PlanId) => void;
  stripeConfigured: boolean;
  /** Auto-open once per browser session after a short delay. */
  autoOpen?: boolean;
};

export function YearlyUpsellDialog({
  plans,
  open,
  onOpenChange,
  onSelectPlan,
  stripeConfigured,
  autoOpen = true,
}: Props) {
  const { dictionary, t } = useI18n();
  const copy = dictionary.pricingDialog;
  const titleId = useId();
  const month = monthlyPlan(plans);
  const year = yearlyPlan(plans);
  const monthlyAmount = month?.amountEur ?? 43.28;

  const [interval, setInterval] = useState<BillingInterval>("year");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!SITE.yearlyUpsellDialog || !autoOpen || !year || !month) return;
    if (typeof window === "undefined") return;
    try {
      if (sessionStorage.getItem(SESSION_KEY) === "1") return;
    } catch {
      // private mode — still allow once this mount
    }
    const timer = window.setTimeout(() => {
      onOpenChange(true);
      try {
        sessionStorage.setItem(SESSION_KEY, "1");
      } catch {
        // ignore
      }
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [autoOpen, month, onOpenChange, year]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onOpenChange, pending]);

  if (!SITE.yearlyUpsellDialog || !month || !year) return null;
  if (!open) return null;

  const selected = interval === "year" ? year : month;
  const was = compareAtEur(selected, monthlyAmount);
  const yearSave = savePercent(year, monthlyAmount);
  const yearPerMonth = perMonthEur(year);
  const yearWas = compareAtEur(year, monthlyAmount);

  function confirm() {
    setError(null);
    onSelectPlan(selected.id);

    if (!stripeConfigured) {
      setError(dictionary.checkout.stripeNotConfigured);
      return;
    }

    // Main funnel: dialog CTA → Stripe Checkout (yearly $210 by default).
    startTransition(async () => {
      try {
        const response = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planId: selected.id }),
        });
        const data = (await response.json()) as {
          url?: string;
          error?: string;
        };
        if (!response.ok || !data.url) {
          setError(data.error ?? copy.ctaError);
          return;
        }
        window.location.href = data.url;
      } catch {
        setError(copy.ctaError);
      }
    });
  }

  const ctaLabel =
    interval === "year"
      ? t(copy.ctaYearly, { amount: formatEurWhole(year.amountEur) })
      : t(copy.ctaMonthly, { amount: formatEurWhole(month.amountEur) });

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center sm:p-6"
      role="presentation"
      onClick={() => {
        if (!pending) onOpenChange(false);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="yearly-upsell relative w-full max-w-md overflow-hidden rounded-3xl border border-white/12 bg-[#0c0c12] p-5 shadow-[0_30px_120px_rgba(0,0,0,0.65)] sm:p-7"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(255,106,0,0.22),transparent_55%)]" />
        <div className="relative">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={pending}
            className="absolute -top-1 -right-1 grid h-9 w-9 place-items-center rounded-full text-white/50 transition hover:bg-white/5 hover:text-white disabled:opacity-40"
            aria-label={copy.close}
          >
            ×
          </button>

          <p className="text-[11px] font-bold tracking-[0.18em] text-[#ff6a00] uppercase">
            {copy.eyebrow}
          </p>
          <h2
            id={titleId}
            className="mt-2 font-[family-name:var(--font-syne)] text-2xl font-semibold tracking-tight text-white"
          >
            {copy.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-white/60">
            {copy.body}
          </p>

          <div className="mt-5 grid grid-cols-2 rounded-2xl border border-white/10 bg-black/30 p-1">
            {(
              [
                ["month", copy.monthly],
                ["year", copy.yearly],
              ] as const
            ).map(([id, label]) => {
              const active = interval === id;
              return (
                <button
                  key={id}
                  type="button"
                  disabled={pending}
                  onClick={() => setInterval(id)}
                  className={`relative rounded-xl px-3 py-2.5 text-sm font-semibold transition disabled:opacity-60 ${
                    active
                      ? "bg-white text-black shadow-sm"
                      : "text-white/65 hover:text-white"
                  }`}
                >
                  {label}
                  {id === "year" ? (
                    <span
                      className={`ml-1.5 text-[10px] font-bold tracking-wide uppercase ${
                        active ? "text-[#ff6a00]" : "text-[#ffb079]"
                      }`}
                    >
                      {copy.bestValue}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-5 text-center">
            {interval === "year" ? (
              <>
                <p className="text-[12px] font-semibold tracking-[0.14em] text-emerald-300/90 uppercase">
                  {yearSave != null
                    ? copy.saveBadge.replace("{{pct}}", String(yearSave))
                    : copy.bestValue}
                </p>
                <p className="mt-2 text-sm text-white/45 line-through decoration-white/35">
                  {formatEurWhole(yearWas)}
                  <span className="ml-1">{copy.perYear}</span>
                </p>
                <p className="mt-1 font-[family-name:var(--font-syne)] text-5xl font-semibold tracking-tight text-white">
                  {formatEurWhole(year.amountEur)}
                  <span className="ml-1 text-base font-medium text-white/50">
                    {copy.perYear}
                  </span>
                </p>
                <p className="mt-2 text-sm text-white/55">
                  {copy.onlyPerMonth.replace(
                    "{{amount}}",
                    formatEurWhole(Math.round(yearPerMonth)),
                  )}
                </p>
                <p className="mt-1 text-[12px] text-white/40">
                  {copy.vsMonthly.replace(
                    "{{amount}}",
                    formatEurWhole(monthlyAmount * 12),
                  )}
                </p>
              </>
            ) : (
              <>
                <p className="text-[12px] font-semibold tracking-[0.14em] text-white/45 uppercase">
                  {copy.flexible}
                </p>
                <p className="mt-2 text-sm text-white/45 line-through decoration-white/35">
                  {formatEurWhole(was)}
                  <span className="ml-1">{copy.perMonth}</span>
                </p>
                <p className="mt-1 font-[family-name:var(--font-syne)] text-5xl font-semibold tracking-tight text-white">
                  {formatEurWhole(month.amountEur)}
                  <span className="ml-1 text-base font-medium text-white/50">
                    {copy.perMonth}
                  </span>
                </p>
                <p className="mt-2 text-sm text-white/55">{copy.monthHint}</p>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={confirm}
            disabled={pending}
            className="mt-5 flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-[#ff6a00] to-[#ff3b00] px-4 py-3.5 text-sm font-bold text-white shadow-[0_12px_40px_rgba(255,74,26,0.35)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? copy.ctaRedirecting : ctaLabel}
          </button>
          {error ? (
            <p className="mt-3 text-center text-[12px] text-red-300">{error}</p>
          ) : null}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={pending}
            className="mt-3 w-full text-center text-xs text-white/45 underline-offset-2 hover:text-white/70 hover:underline disabled:opacity-40"
          >
            {copy.dismiss}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Small link to reopen the experiment dialog from checkout. */
export function YearlyUpsellTrigger({ onClick }: { onClick: () => void }) {
  const { dictionary } = useI18n();
  if (!SITE.yearlyUpsellDialog) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs font-medium text-[#ffb079] underline-offset-2 hover:text-[#ffc48a] hover:underline"
    >
      {dictionary.pricingDialog.compareLink}
    </button>
  );
}
