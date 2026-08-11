import Link from "next/link";

import { CircleLogo } from "@/components/circle-logo";
import { CryptoSuccessBeacon } from "@/components/crypto-success-beacon";
import { t } from "@/lib/i18n/dictionary";
import { localizePath } from "@/lib/i18n/path";
import { getRequestDictionary } from "@/lib/i18n/server";
import { grantMembershipFromCheckout } from "@/lib/membership";
import { createVipInviteLink, isTelegramBotConfigured } from "@/lib/telegram";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { SITE } from "@/lib/site";

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{
    session_id?: string;
    crypto?: string;
    invite?: string;
    plan?: string;
  }>;
}) {
  const params = await searchParams;
  const { locale, dictionary } = await getRequestDictionary();
  const copy = dictionary.success;
  const sessionId = params.session_id;
  let planLabel: string | null = params.plan ?? null;
  let telegramUsername: string | null = null;
  let inviteLink: string | null = params.invite ?? null;
  const isCrypto = params.crypto === "1";

  if (sessionId && isStripeConfigured()) {
    try {
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["subscription"],
      });
      planLabel = session.metadata?.planId ?? planLabel;
      telegramUsername = session.metadata?.telegramUsername ?? null;

      const subscription =
        typeof session.subscription === "object" && session.subscription
          ? session.subscription
          : null;

      inviteLink = subscription?.metadata?.telegramInviteLink ?? inviteLink;

      // Webhook may lag or miss — finalize claim + whitelist on success too.
      if (session.payment_status === "paid" && session.mode === "subscription") {
        try {
          await grantMembershipFromCheckout(session);
          if (subscription?.id) {
            const refreshed = await stripe.subscriptions.retrieve(subscription.id);
            inviteLink =
              refreshed.metadata?.telegramInviteLink?.trim() || inviteLink;
          }
        } catch (error) {
          console.error("[success] grantMembershipFromCheckout failed", error);
        }
      }

      if (
        !inviteLink &&
        session.payment_status === "paid" &&
        isTelegramBotConfigured()
      ) {
        const label = (
          telegramUsername ||
          session.metadata?.telegramUserId ||
          "member"
        ).slice(0, 32);
        const created = await createVipInviteLink(label);
        inviteLink = created.inviteLink;

        if (inviteLink && subscription?.id) {
          await stripe.subscriptions.update(subscription.id, {
            metadata: {
              ...(subscription.metadata ?? {}),
              ...(session.metadata ?? {}),
              telegramInviteLink: inviteLink,
            },
          });
        }
      }
    } catch {
      // ignore retrieval errors on success page
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-16 text-white">
      {isCrypto ? <CryptoSuccessBeacon planId={planLabel} /> : null}
      <div className="pointer-events-none absolute inset-0 circle-atmosphere" />
      <div className="relative w-full max-w-lg circle-panel rounded-3xl p-8 text-center">
        <div className="mx-auto mb-4 w-fit">
          <CircleLogo size={56} />
        </div>
        <p className="text-xs font-bold tracking-[0.2em] text-[#ff9a4d] uppercase">
          {copy.eyebrow}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          {t(copy.welcome, { name: dictionary.common.siteName })}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-white/65">
          {copy.active}
          {planLabel ? ` (${planLabel})` : ""}.
          {isCrypto ? ` ${copy.cryptoVerified}` : null}{" "}
          {telegramUsername
            ? t(copy.admitUser, { user: telegramUsername })
            : copy.useInvite}
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {inviteLink ? (
            <a
              href={inviteLink}
              target="_blank"
              rel="noreferrer"
              className="circle-cta rounded-2xl px-5 py-3 text-sm font-semibold text-white"
            >
              {copy.join}
            </a>
          ) : (
            <a
              href={SITE.telegramInvite}
              target="_blank"
              rel="noreferrer"
              className="circle-cta rounded-2xl px-5 py-3 text-sm font-semibold text-white"
            >
              {copy.openTelegram}
            </a>
          )}
          <Link
            href={localizePath(locale, "/dashboard")}
            className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
          >
            {copy.manageBilling}
          </Link>
        </div>
        {!inviteLink && !isTelegramBotConfigured() ? (
          <p className="mt-4 text-xs text-white/45">{copy.messageForAccess}</p>
        ) : null}
      </div>
    </main>
  );
}
