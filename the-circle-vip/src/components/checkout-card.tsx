"use client";

import { useEffect, useState, useTransition } from "react";

import { CryptoPayPanel } from "@/components/crypto-pay-panel";
import { useI18n } from "@/components/i18n-provider";
import { readStoredReferralCode } from "@/components/referral-capture";
import { ensureStoredAttribution } from "@/lib/attribution";
import { TelegramLoginButton } from "@/components/telegram-login-button";
import { YearlyUpsellTrigger } from "@/components/yearly-upsell-dialog";
import { trackCryptoEvent } from "@/lib/client-fingerprint";
import {
  formatPlanAmount,
  REFERRAL_CHECKOUT_DISCOUNT_EUR,
  type Plan,
  type PlanId,
} from "@/lib/plans";
import {
  compareAtEur,
  formatEurWhole,
  monthlyPlan,
  perMonthEur,
  savePercent,
  type BillingInterval,
} from "@/lib/pricing-display";
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
  /** Controlled selection from the yearly upsell dialog. */
  planId?: PlanId;
  onPlanIdChange?: (planId: PlanId) => void;
  onOpenPricingDialog?: () => void;
};

export function CheckoutCard({
  plans,
  initialTelegram,
  stripeConfigured,
  telegramLoginConfigured,
  telegramBotUsername,
  initialError,
  planId: controlledPlanId,
  onPlanIdChange,
  onOpenPricingDialog,
}: Props) {
  const { dictionary, t } = useI18n();
  const copy = dictionary.checkout;
  const [internalPlanId, setInternalPlanId] = useState<PlanId>(
    plans.find((p) => p.id === "year")?.id ?? plans[0]?.id ?? "month",
  );
  const planId = controlledPlanId ?? internalPlanId;
  function setPlanId(next: PlanId) {
    onPlanIdChange?.(next);
    setInternalPlanId(next);
  }
  const [referralCode, setReferralCode] = useState("");
  const [telegramUsername, setTelegramUsername] = useState("");
  const [telegram, setTelegram] = useState<TelegramUser>(initialTelegram);
  const [showTelegram, setShowTelegram] = useState(Boolean(initialTelegram));
  const [showReferral, setShowReferral] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [isPending, startTransition] = useTransition();
  const [payMethod, setPayMethod] = useState<"card" | "crypto">("crypto");

  const plan = plans.find((item) => item.id === planId) ?? plans[0];
  const monthPlan = monthlyPlan(plans);
  const monthlyAmount = monthPlan?.amountEur ?? 43.28;
  const billing: BillingInterval =
    planId === "year" ? "year" : "month";

  useEffect(() => {
    const stored = readStoredReferralCode();
    if (stored) {
      setReferralCode(stored);
      setShowReferral(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => {
        const payload = data as { telegram: TelegramUser };
        if (!cancelled && payload.telegram) {
          setTelegram(payload.telegram);
          setShowTelegram(true);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  function handleCardCheckout() {
    setError(null);

    if (!stripeConfigured) {
      setError(copy.stripeNotConfigured);
      return;
    }
    if (!plan) {
      setError(copy.noPlans);
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planId: plan.id,
            referralCode: referralCode.trim() || undefined,
            telegramUsername: telegram
              ? undefined
              : telegramUsername.trim() || undefined,
            attribution: ensureStoredAttribution(),
          }),
        });
        const data = (await response.json()) as {
          url?: string;
          error?: string;
        };
        if (!response.ok || !data.url) {
          setError(data.error ?? copy.checkoutFailed);
          return;
        }
        window.location.href = data.url;
      } catch {
        setError(copy.networkError);
      }
    });
  }

  async function handleTelegramAuth(user: {
    id: number;
    first_name?: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
    auth_date: number;
    hash: string;
  }) {
    setError(null);
    try {
      const response = await fetch("/api/telegram/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(user),
      });
      const data = (await response.json()) as {
        telegram?: TelegramUser;
        error?: string;
      };
      if (!response.ok || !data.telegram) {
        setError(data.error ?? copy.telegramFailed);
        return;
      }
      setTelegram(data.telegram);
    } catch {
      setError(copy.telegramFailed);
    }
  }

  async function handleDisconnect() {
    await fetch("/api/telegram/logout", { method: "POST" });
    setTelegram(null);
  }

  const displayName =
    telegram?.username || telegram?.firstName || telegram?.id || null;

  if (!plan) {
    return null;
  }

  return (
    <section
      id="checkout"
      aria-label={copy.title}
      className="circle-panel circle-checkout-glow rounded-3xl p-5 sm:p-6"
    >
      <div className="mb-5">
        <p className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-[#ff6a00]/35 bg-[#ff6a00]/12 px-2.5 py-1 text-[11px] font-bold tracking-[0.14em] text-[#ffb079] uppercase">
          <span
            className="relative flex h-1.5 w-1.5"
            aria-hidden
          >
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ff6a00] opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#ff6a00]" />
          </span>
          {copy.nextStep}
        </p>
        <h2 className="text-2xl font-semibold tracking-tight text-white">
          {copy.title}
        </h2>
        <p className="mt-1 text-sm text-white/60">{copy.subtitle}</p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold tracking-[0.16em] text-white/45 uppercase">
            {copy.plan}
          </p>
          {onOpenPricingDialog && SITE.yearlyUpsellDialog ? (
            <YearlyUpsellTrigger onClick={onOpenPricingDialog} />
          ) : null}
        </div>

        {SITE.yearlyUpsellDialog && monthPlan && plans.some((p) => p.id === "year") ? (
          <div className="grid grid-cols-2 rounded-2xl border border-white/10 bg-black/25 p-1">
            {(
              [
                ["month", copy.billingMonthly],
                ["year", copy.billingYearly],
              ] as const
            ).map(([id, label]) => {
              const active = billing === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPlanId(id)}
                  className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                    active
                      ? "bg-white text-black"
                      : "text-white/65 hover:text-white"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        ) : null}

        {plans.map((item) => {
          const selected = planId === item.id;
          const was = compareAtEur(item, monthlyAmount);
          const save = savePercent(item, monthlyAmount);
          const showAnchor = was > item.amountEur;
          return (
            <label
              key={item.id}
              className={`flex cursor-pointer flex-col gap-1 rounded-2xl border px-4 py-3 transition ${
                selected
                  ? item.id === "year"
                    ? "border-[#ff6a00]/70 bg-[#ff6a00]/12"
                    : "border-[#5ce1ff]/70 bg-[#5ce1ff]/12"
                  : "border-white/10 bg-white/5 hover:border-white/25"
              }`}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="plan"
                    value={item.id}
                    checked={selected}
                    onChange={() => setPlanId(item.id)}
                    className="accent-[#ff6a00]"
                  />
                  <span className="font-medium text-white">{item.label}</span>
                  {save != null && item.id !== "month" ? (
                    <span className="rounded-md bg-[#ff6a00] px-2 py-0.5 text-[11px] font-bold tracking-wide text-white uppercase">
                      {item.saveLabel ?? `Save ${save}%`}
                    </span>
                  ) : item.saveLabel ? (
                    <span className="rounded-md bg-[#ff6a00] px-2 py-0.5 text-[11px] font-bold tracking-wide text-white uppercase">
                      {item.saveLabel}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 text-right">
                  {showAnchor ? (
                    <span className="mr-2 text-xs text-white/40 line-through">
                      {formatEurWhole(was)}
                    </span>
                  ) : null}
                  <span className="font-semibold text-white">
                    {formatPlanAmount(item)}
                  </span>
                  {item.id === "year" ? (
                    <span className="mt-0.5 block text-[11px] text-emerald-300/90">
                      {t(copy.perMonthShort, {
                        amount: formatEurWhole(Math.round(perMonthEur(item))),
                      })}
                    </span>
                  ) : null}
                </span>
              </span>
              <span className="pl-7 text-xs leading-relaxed text-white/55">
                {showAnchor
                  ? `${t(copy.wasPrice, { amount: formatEurWhole(was) })} · ${item.description}`
                  : item.description}
              </span>
            </label>
          );
        })}
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
        <div className="mb-3 flex items-end justify-between gap-3">
          <span className="text-xs font-semibold tracking-[0.16em] text-white/45 uppercase">
            {copy.total}
          </span>
          <span className="text-right">
            {compareAtEur(plan, monthlyAmount) > plan.amountEur ? (
              <span className="mb-0.5 block text-xs text-white/40 line-through">
                {formatEurWhole(compareAtEur(plan, monthlyAmount))}{" "}
                {plan.currencyLabel}
              </span>
            ) : null}
            <span className="block text-2xl font-semibold text-white">
              {payMethod === "crypto"
                ? `${plan.amountUsd} ${plan.cryptoLabel}`
                : formatPlanAmount(plan)}
            </span>
            <span className="block text-xs text-white/45">{plan.label}</span>
          </span>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setPayMethod("crypto");
              setError(null);
              trackCryptoEvent({
                event: "pay_method_select",
                planId: plan?.id,
                chainId: "crypto",
              });
            }}
            className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
              payMethod === "crypto"
                ? "border-[#2ea3ff] bg-[#2ea3ff]/20 text-white"
                : "border-white/10 bg-white/5 text-white/70"
            }`}
          >
            {copy.crypto}
            <span className="mt-0.5 block text-[10px] font-medium tracking-wide text-[#9fd4ff] uppercase">
              {copy.preferred}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setPayMethod("card");
              setError(null);
              trackCryptoEvent({
                event: "pay_method_select",
                planId: plan?.id,
                chainId: "card",
              });
            }}
            className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
              payMethod === "card"
                ? "border-[#ff6a00] bg-[#ff6a00]/15 text-white"
                : "border-white/10 bg-white/5 text-white/70"
            }`}
          >
            {copy.card}
            <span className="mt-0.5 block text-[10px] font-medium tracking-wide text-white/40 uppercase">
              {copy.stripe}
            </span>
          </button>
        </div>

        {payMethod === "crypto" ? (
          <CryptoPayPanel
            plan={plan}
            telegramUsername={telegramUsername}
            referralCode={referralCode}
            onError={setError}
          />
        ) : (
          <>
            <button
              type="button"
              onClick={handleCardCheckout}
              disabled={isPending}
              className="flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-[#ff6a00] to-[#ff3b00] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_12px_40px_rgba(255,74,26,0.35)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? copy.redirecting : copy.continueStripe}
            </button>
            <p className="mt-3 text-center text-xs leading-relaxed text-white/45">
              {copy.stripeHint}
            </p>
          </>
        )}
      </div>

      <div className="mt-4 space-y-2">
        <button
          type="button"
          onClick={() => setShowTelegram((value) => !value)}
          className="w-full text-left text-xs text-white/45 underline-offset-2 hover:text-white/70 hover:underline"
        >
          {showTelegram ? copy.hideTelegram : copy.addTelegram}
        </button>
        {showTelegram ? (
          <div className="space-y-2">
            {telegram ? (
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-white">{displayName}</p>
                  {telegram.username ? (
                    <p className="text-xs text-white/50">@{telegram.username}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="text-xs text-white/60 underline-offset-2 hover:text-white hover:underline"
                >
                  {copy.disconnect}
                </button>
              </div>
            ) : telegramLoginConfigured && telegramBotUsername ? (
              <TelegramLoginButton
                botUsername={telegramBotUsername}
                onAuth={handleTelegramAuth}
              />
            ) : (
              <input
                value={telegramUsername}
                onChange={(event) => setTelegramUsername(event.target.value)}
                placeholder={copy.telegramPlaceholder}
                autoComplete="username"
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#2ea3ff]/60"
              />
            )}
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setShowReferral((value) => !value)}
          className="w-full text-left text-xs text-white/45 underline-offset-2 hover:text-white/70 hover:underline"
        >
          {showReferral ? copy.hideReferral : copy.haveReferral}
        </button>
        {showReferral ? (
          <input
            value={referralCode}
            onChange={(event) => setReferralCode(event.target.value)}
            placeholder={copy.referralPlaceholder}
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#ff6a00]/60"
          />
        ) : null}
        {referralCode.trim() ? (
          <p className="text-xs font-medium text-[#ffc48a]">
            {t(copy.discountApplied, {
              amount: REFERRAL_CHECKOUT_DISCOUNT_EUR.toFixed(2),
            })}
          </p>
        ) : null}
      </div>

      {error ? (
        <p className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}
    </section>
  );
}
