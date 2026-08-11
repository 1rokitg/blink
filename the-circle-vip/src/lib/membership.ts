import "server-only";

import type Stripe from "stripe";

import { completeClaimFromCheckout } from "@/lib/claim-links.server";
import {
  DISCOUNT_TAG_KEY,
  EARLY_CUSTOMER_DISCOUNT_TAG,
  claimDiscountStripeMetadata,
} from "@/lib/member-tags";
import {
  createVipInviteLink,
  ensureVipAccess,
  revokeVipAccess,
} from "@/lib/telegram";
import {
  deactivatePaidTelegramMember,
  upsertPaidTelegramMember,
} from "@/lib/telegram-paid-whitelist.server";
import { getStripe } from "@/lib/stripe";

function getTelegramUserId(
  obj: Stripe.Checkout.Session | Stripe.Subscription,
) {
  return (
    obj.metadata?.telegramUserId?.trim() ||
    obj.metadata?.telegram_user_id?.trim() ||
    ""
  );
}

function getTelegramUsername(
  obj: Stripe.Checkout.Session | Stripe.Subscription,
) {
  return (
    obj.metadata?.telegramUsername?.trim() ||
    obj.metadata?.telegram_username?.trim() ||
    ""
  );
}

export async function grantMembershipFromCheckout(
  session: Stripe.Checkout.Session,
) {
  const telegramUserId = getTelegramUserId(session);
  const telegramUsername = getTelegramUsername(session);
  const claimId = session.metadata?.claimId?.trim() || "";
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer &&
          typeof session.customer === "object" &&
          "id" in session.customer
        ? session.customer.id
        : null;

  if (claimId) {
    try {
      await completeClaimFromCheckout({
        claimId,
        checkoutSessionId: session.id,
        subscriptionId: subscriptionId ?? null,
      });
    } catch (error) {
      console.error("[membership] Failed to complete claim link", error);
    }
  }

  if (!telegramUserId && !telegramUsername) {
    console.warn(
      `[membership] checkout.session.completed missing telegram identity (${session.id})`,
    );
    return;
  }

  try {
    await upsertPaidTelegramMember({
      username: telegramUsername || null,
      telegramUserId: telegramUserId || null,
      subscriptionId: subscriptionId ?? null,
      customerId,
      email: session.customer_details?.email ?? session.customer_email ?? null,
      claimId: claimId || null,
      source: session.metadata?.source?.trim() || "stripe_checkout",
      status: "active",
    });
  } catch (error) {
    console.error("[membership] Failed to upsert paid Telegram whitelist", error);
  }

  if (telegramUserId) {
    await ensureVipAccess(telegramUserId);
  }

  const label = (telegramUsername || telegramUserId || "member").slice(0, 32);
  const { inviteLink } = await createVipInviteLink(label);

  if (!inviteLink) {
    return;
  }

  // Persist invite on the subscription for the success page / support.
  try {
    const stripe = getStripe();
    const claimDiscount =
      claimId
        ? claimDiscountStripeMetadata({
            label: session.metadata?.claim_label || session.metadata?.discount_label,
            note: session.metadata?.note,
          })
        : null;

    if (subscriptionId) {
      await stripe.subscriptions.update(subscriptionId, {
        metadata: {
          ...(session.metadata ?? {}),
          ...(claimDiscount ?? {}),
          telegramInviteLink: inviteLink,
        },
      });
    }

    if (customerId) {
      const existing = await stripe.customers.retrieve(customerId);
      const existingTag =
        !existing.deleted && existing.metadata?.tag
          ? existing.metadata.tag
          : null;
      await stripe.customers.update(customerId, {
        metadata: {
          telegramUserId: telegramUserId || "",
          telegramUsername: telegramUsername || "",
          telegramInviteLink: inviteLink,
          app: "the-circle-vip",
          ...(claimId
            ? {
                claimId,
                source: "claim_link",
                ...(claimDiscount ?? {}),
                // Keep Whop migration tag when present.
                tag:
                  existingTag === "Whop"
                    ? "Whop"
                    : (claimDiscount?.tag ?? EARLY_CUSTOMER_DISCOUNT_TAG),
                [DISCOUNT_TAG_KEY]: EARLY_CUSTOMER_DISCOUNT_TAG,
              }
            : {}),
        },
      });
    }

    if (claimId && subscriptionId) {
      try {
        const invoices = await stripe.invoices.list({
          subscription: subscriptionId,
          limit: 3,
        });
        for (const invoice of invoices.data) {
          if (!invoice.id || invoice.status !== "paid") continue;
          await stripe.invoices.update(invoice.id, {
            metadata: {
              ...(invoice.metadata ?? {}),
              source: "claim_link",
              claimId,
              tag: EARLY_CUSTOMER_DISCOUNT_TAG,
              discount: "early_customer",
              [DISCOUNT_TAG_KEY]: EARLY_CUSTOMER_DISCOUNT_TAG,
            },
          });
        }
      } catch (error) {
        console.error("[membership] Failed to tag claim invoices", error);
      }
    }
  } catch (error) {
    console.error("[membership] Failed to persist invite link", error);
  }

  console.info(
    `[membership] Granted Telegram invite for ${telegramUsername || telegramUserId}${claimId ? ` (claim ${claimId})` : ""}`,
  );
}

export async function syncMembershipFromSubscription(
  subscription: Stripe.Subscription,
) {
  const telegramUserId = getTelegramUserId(subscription);
  const telegramUsername = getTelegramUsername(subscription);
  const activeStatuses = new Set(["active", "trialing"]);
  const isActive = activeStatuses.has(subscription.status);
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer &&
          typeof subscription.customer === "object" &&
          !subscription.customer.deleted
        ? subscription.customer.id
        : null;

  if (telegramUsername || telegramUserId) {
    try {
      if (isActive) {
        await upsertPaidTelegramMember({
          username: telegramUsername || null,
          telegramUserId: telegramUserId || null,
          subscriptionId: subscription.id,
          customerId,
          claimId: subscription.metadata?.claimId?.trim() || null,
          source: subscription.metadata?.source?.trim() || "stripe_subscription",
          status: "active",
        });
      } else {
        await deactivatePaidTelegramMember({
          username: telegramUsername || null,
          telegramUserId: telegramUserId || null,
          subscriptionId: subscription.id,
        });
      }
    } catch (error) {
      console.error(
        "[membership] Failed to sync paid Telegram whitelist",
        error,
      );
    }
  }

  if (!telegramUserId) {
    console.warn(
      `[membership] subscription event missing telegramUserId (${subscription.id})`,
    );
    return;
  }

  if (isActive) {
    await ensureVipAccess(telegramUserId);
    return;
  }

  await revokeVipAccess(telegramUserId);
}
