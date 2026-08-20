"use client";

import { useState, useTransition, type FormEvent } from "react";

import { CircleLogo } from "@/components/circle-logo";
import { SiteHeader } from "@/components/site-header";
import type { PublicClaimView } from "@/lib/claim-links-types";
import { SITE } from "@/lib/site";

function statusCopy(claim: PublicClaimView, canceled: boolean) {
  if (claim.status === "completed") {
    return {
      title: "Already claimed",
      body: "This invite was already paid and activated. Check Telegram / email for access — this link can’t be used again.",
      tone: "done" as const,
    };
  }
  if (claim.status === "revoked") {
    return {
      title: "Invite revoked",
      body: "This invite link was revoked. Ask your host for a new one.",
      tone: "closed" as const,
    };
  }
  if (claim.status === "expired" || !claim.usable) {
    return {
      title: "Invite expired",
      body: "This invite link has expired. Ask your host for a new one.",
      tone: "closed" as const,
    };
  }
  if (canceled) {
    return {
      title: "Checkout canceled",
      body: "No charge was made. You can try again below — the link still works until it expires.",
      tone: "warn" as const,
    };
  }
  return null;
}

export function ClaimOfferForm({
  claim,
  canceled = false,
}: {
  claim: PublicClaimView;
  canceled?: boolean;
}) {
  const [telegramUsername, setTelegramUsername] = useState(
    claim.telegramUsername ? `@${claim.telegramUsername}` : "",
  );
  const [email, setEmail] = useState(claim.email ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const notice = statusCopy(claim, canceled);

  const intervalLabel =
    claim.intervalCount > 1
      ? `every ${claim.intervalCount} ${claim.interval}s`
      : `per ${claim.interval}`;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!claim.usable) return;
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/claim-checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            claimId: claim.id,
            telegramUsername: telegramUsername.trim(),
            email: email.trim() || undefined,
          }),
        });
        const data = (await response.json()) as {
          url?: string;
          error?: string;
        };
        if (!response.ok || !data.url) {
          setError(data.error ?? "Could not start checkout.");
          return;
        }
        window.location.href = data.url;
      } catch {
        setError("Network error. Please try again.");
      }
    });
  }

  if (!claim.usable) {
    const closed = notice ?? {
      title: "Invite unavailable",
      body: "This invite link is no longer claimable.",
      tone: "closed" as const,
    };
    return (
      <div className="relative min-h-screen overflow-hidden text-white">
        <div className="circle-atmosphere pointer-events-none absolute inset-0" />
        <div className="relative">
          <SiteHeader />
          <main className="mx-auto flex max-w-lg flex-col px-4 py-10 sm:px-6">
            <div className="circle-panel rounded-3xl p-6 sm:p-8 text-center">
              <div className="mx-auto mb-4 w-fit">
                <CircleLogo size={48} />
              </div>
              <p className="text-xs font-bold tracking-[0.18em] text-[#ff9a4d] uppercase">
                Private invite
              </p>
              <h1 className="mt-3 font-[family-name:var(--font-syne)] text-3xl font-bold tracking-tight">
                {closed.title}
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-white/70">
                {closed.body}
              </p>
              {claim.status === "completed" ? (
                <div className="mt-8 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-5 py-4 text-left">
                  <p className="text-xs font-medium tracking-wide text-emerald-200/80 uppercase">
                    Membership
                  </p>
                  <p className="mt-1 text-lg font-semibold text-emerald-50">
                    Active · {claim.amountLabel}
                    <span className="ml-2 text-sm font-medium text-emerald-100/70">
                      {intervalLabel}
                    </span>
                  </p>
                  {claim.telegramUsername ? (
                    <p className="mt-2 text-sm text-emerald-100/75">
                      @{claim.telegramUsername}
                    </p>
                  ) : null}
                </div>
              ) : null}
              <a
                href={SITE.telegramInvite}
                target="_blank"
                rel="noreferrer"
                className="circle-cta mt-8 inline-flex w-full items-center justify-center rounded-2xl px-5 py-3.5 text-sm font-semibold text-white"
              >
                Open Telegram
              </a>
            </div>
          </main>
        </div>
      </div>
    );
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
              Private invite
            </p>
            <h1 className="mt-3 font-[family-name:var(--font-syne)] text-3xl font-bold tracking-tight">
              {claim.label || "Claim your Circle membership"}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-white/70">
              Secure one-time link. Continue to Stripe Checkout to activate your
              membership at the locked-in price below.
            </p>

            <div className="mt-8 rounded-2xl border border-white/10 bg-black/30 px-5 py-4">
              <p className="text-xs font-medium tracking-wide text-white/50 uppercase">
                Your price
              </p>
              <p className="mt-1 font-[family-name:var(--font-syne)] text-4xl font-bold tracking-tight">
                {claim.amountLabel}
                <span className="ml-2 text-base font-medium text-white/55">
                  {intervalLabel}
                </span>
              </p>
              {claim.note ? (
                <p className="mt-2 text-sm text-white/60">{claim.note}</p>
              ) : null}
            </div>

            {notice ? (
              <div className="mt-6 rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                <p className="font-medium">{notice.title}</p>
                <p className="mt-1 text-amber-100/80">{notice.body}</p>
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-white/60">
                  Telegram @username
                </span>
                <input
                  required
                  value={telegramUsername}
                  onChange={(e) => setTelegramUsername(e.target.value)}
                  placeholder="@username"
                  className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none focus:border-[#ff9a4d]/60"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-white/60">
                  Email for receipts
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none focus:border-[#ff9a4d]/60"
                />
              </label>

              {error ? (
                <p className="rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={isPending}
                className="circle-cta inline-flex w-full items-center justify-center rounded-2xl px-5 py-3.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {isPending ? "Opening Stripe…" : "Continue to secure checkout"}
              </button>
              <p className="text-center text-xs text-white/40">
                Credit card payment via Stripe. This link works once.
              </p>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
