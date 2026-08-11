"use client";

import { useState, useTransition, type FormEvent } from "react";

import { CircleLogo } from "@/components/circle-logo";
import { SiteHeader } from "@/components/site-header";
import type { PublicCompGiftView } from "@/lib/comp-gifts-types";

export function GiftRedeemForm({ gift }: { gift: PublicCompGiftView }) {
  const [telegramUsername, setTelegramUsername] = useState(
    gift.telegramUsername ? `@${gift.telegramUsername}` : "",
  );
  const [email, setEmail] = useState(gift.email ?? "");
  const [error, setError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!gift.usable) return;
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/gift-redeem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            giftId: gift.id,
            telegramUsername: telegramUsername.trim(),
            email: email.trim() || undefined,
          }),
        });
        const data = (await response.json()) as {
          inviteLink?: string | null;
          error?: string;
        };
        if (!response.ok) {
          setError(data.error ?? "Could not claim gift.");
          return;
        }
        setInviteLink(data.inviteLink ?? null);
      } catch {
        setError("Network error. Please try again.");
      }
    });
  }

  const blockedMessage =
    gift.status === "redeemed"
      ? "This complimentary month was already claimed."
      : gift.status === "revoked"
        ? "This gift link was revoked."
        : gift.status === "expired" || !gift.usable
          ? "This gift link has expired."
          : null;

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
              Complimentary gift
            </p>
            <h1 className="mt-3 font-[family-name:var(--font-syne)] text-3xl font-bold tracking-tight">
              {gift.label || "Claim your free month"}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-white/70">
              You&apos;ve been gifted 1 month of The Circle. Enter your Telegram
              to unlock the private invite — no payment.
            </p>

            {gift.note ? (
              <p className="mt-4 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/65">
                {gift.note}
              </p>
            ) : null}

            {blockedMessage ? (
              <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
                {blockedMessage}
              </div>
            ) : null}

            {inviteLink ? (
              <div className="mt-8 space-y-4 text-center">
                <p className="text-sm text-[#ffc48a]">
                  You&apos;re in. Open your private invite:
                </p>
                <a
                  href={inviteLink}
                  target="_blank"
                  rel="noreferrer"
                  className="circle-cta inline-flex w-full items-center justify-center rounded-2xl px-5 py-3.5 text-sm font-semibold text-white"
                >
                  Open Telegram invite
                </a>
              </div>
            ) : gift.usable ? (
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
                    Email (optional)
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
                  {isPending ? "Claiming…" : "Claim free month"}
                </button>
              </form>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}
