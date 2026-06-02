import { eq } from "drizzle-orm";
import type Stripe from "stripe";

import { db } from "@acme/db/client";
import { BlinkMembership, UserProfile } from "@acme/db/schema";

import { LIFETIME_MEMBERSHIP_END } from "./gift-membership.server";
import { getStripeClient, isStripeConfigured } from "./stripe.server";

export type StripeMembershipSyncResult = {
  scanned: number;
  upserted: number;
  skippedGift: number;
  skippedNoWallet: number;
  errors: number;
};

function normalizeWallet(value: string | null | undefined) {
  const wallet = value?.trim().toLowerCase() ?? "";
  return /^0x[0-9a-f]{40}$/.test(wallet) ? wallet : null;
}

function isLifetimeGiftPeriodEnd(value: Date | null | undefined) {
  if (!value) return false;
  return value.getTime() >= LIFETIME_MEMBERSHIP_END.getTime() - 24 * 60 * 60 * 1000;
}

function readMetadataString(
  metadata: Stripe.Metadata | null | undefined,
  key: string,
) {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function resolveTier(subscription: Stripe.Subscription) {
  const fromMeta = readMetadataString(subscription.metadata, "tier");
  if (
    fromMeta === "basic" ||
    fromMeta === "preferred" ||
    fromMeta === "premium"
  ) {
    return fromMeta;
  }
  return "basic";
}

function resolvePaymentMethod(subscription: Stripe.Subscription) {
  const fromMeta = readMetadataString(subscription.metadata, "paymentMethod");
  if (fromMeta === "crypto" || fromMeta === "card") return fromMeta;
  return "card";
}

function resolveWalletAddress(subscription: Stripe.Subscription) {
  return (
    normalizeWallet(readMetadataString(subscription.metadata, "walletAddress")) ??
    normalizeWallet(
      typeof subscription.customer === "object" && subscription.customer
        ? readMetadataString(subscription.customer.metadata, "walletAddress")
        : null,
    )
  );
}

function mapStripeSubscriptionStatus(status: Stripe.Subscription.Status) {
  if (status === "trialing") return "trialing";
  if (status === "active") return "active";
  if (status === "past_due") return "past_due";
  if (status === "canceled") return "canceled";
  if (status === "unpaid") return "unpaid";
  if (status === "paused") return "paused";
  return status;
}

function subscriptionPeriodEnd(subscription: Stripe.Subscription) {
  const endSeconds =
    subscription.items.data[0]?.current_period_end ??
    subscription.current_period_end;
  if (!endSeconds) return null;
  return new Date(endSeconds * 1000);
}

function subscriptionCustomerId(subscription: Stripe.Subscription) {
  if (typeof subscription.customer === "string") return subscription.customer;
  return subscription.customer?.id ?? null;
}

export async function upsertMembershipFromStripeSubscription(
  subscription: Stripe.Subscription,
) {
  const walletAddress = resolveWalletAddress(subscription);
  if (!walletAddress) {
    return { ok: false as const, reason: "no_wallet" as const };
  }

  const [existing] = await db
    .select({
      paymentMethod: BlinkMembership.paymentMethod,
      currentPeriodEnd: BlinkMembership.currentPeriodEnd,
    })
    .from(BlinkMembership)
    .where(eq(BlinkMembership.walletAddress, walletAddress))
    .limit(1);

  if (
    existing?.paymentMethod === "gift" &&
    isLifetimeGiftPeriodEnd(existing.currentPeriodEnd)
  ) {
    return { ok: false as const, reason: "lifetime_gift" as const };
  }

  const status = mapStripeSubscriptionStatus(subscription.status);
  const currentPeriodEnd = subscriptionPeriodEnd(subscription);
  const stripeCustomerId = subscriptionCustomerId(subscription);
  const tier = resolveTier(subscription);
  const paymentMethod = resolvePaymentMethod(subscription);
  const createdAt = new Date(subscription.created * 1000);

  await db
    .insert(BlinkMembership)
    .values({
      walletAddress,
      tier,
      status,
      paymentMethod,
      stripeCustomerId,
      stripeSubscriptionId: subscription.id,
      currentPeriodEnd,
      createdAt,
    })
    .onConflictDoUpdate({
      target: BlinkMembership.walletAddress,
      set: {
        tier,
        status,
        paymentMethod,
        stripeCustomerId,
        stripeSubscriptionId: subscription.id,
        currentPeriodEnd,
        updatedAt: new Date(),
      },
    });

  const entitled =
    status === "active" ||
    status === "trialing" ||
    (currentPeriodEnd !== null && currentPeriodEnd.getTime() > Date.now());

  if (entitled) {
    await db
      .insert(UserProfile)
      .values({
        isPro: true,
        walletAddress,
      })
      .onConflictDoUpdate({
        target: UserProfile.walletAddress,
        set: {
          isPro: true,
          updatedAt: new Date(),
        },
      });
  }

  return { ok: true as const, walletAddress };
}

export async function syncStripeSubscriptionsToDatabase(): Promise<StripeMembershipSyncResult> {
  if (!isStripeConfigured()) {
    return {
      scanned: 0,
      upserted: 0,
      skippedGift: 0,
      skippedNoWallet: 0,
      errors: 0,
    };
  }

  const stripe = getStripeClient();
  const result: StripeMembershipSyncResult = {
    scanned: 0,
    upserted: 0,
    skippedGift: 0,
    skippedNoWallet: 0,
    errors: 0,
  };

  let startingAfter: string | undefined;
  for (;;) {
    const page = await stripe.subscriptions.list({
      limit: 100,
      starting_after: startingAfter,
      status: "all",
      expand: ["data.customer"],
    });

    for (const subscription of page.data) {
      result.scanned += 1;
      try {
        const upsert = await upsertMembershipFromStripeSubscription(subscription);
        if (upsert.ok) {
          result.upserted += 1;
        } else if (upsert.reason === "lifetime_gift") {
          result.skippedGift += 1;
        } else {
          result.skippedNoWallet += 1;
        }
      } catch (error) {
        result.errors += 1;
        console.error("[stripe-sync] subscription upsert failed", {
          subscriptionId: subscription.id,
          error,
        });
      }
    }

    if (!page.has_more) break;
    startingAfter = page.data.at(-1)?.id;
    if (!startingAfter) break;
  }

  return result;
}

export async function applyStripeCheckoutSession(
  session: Stripe.Checkout.Session,
) {
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  if (!subscriptionId) return;

  const stripe = getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["customer"],
  });

  const walletAddress = normalizeWallet(
    readMetadataString(session.metadata, "walletAddress") ??
      readMetadataString(subscription.metadata, "walletAddress"),
  );

  if (walletAddress && typeof subscription.customer === "string") {
    await stripe.customers.update(subscription.customer, {
      metadata: { walletAddress },
    });
  }

  await upsertMembershipFromStripeSubscription(subscription);
}
