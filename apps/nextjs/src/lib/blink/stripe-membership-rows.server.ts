import type Stripe from "stripe";

import {
  describeMembershipLifecycle,
  estimateMembershipTotalSpendUsd,
  isStripeTrialMembership,
  tierProductLabel,
} from "./internal-memberships.server";
import type { InternalMembershipRow } from "./internal-memberships.types";
import { getStripeClient, isStripeConfigured } from "./stripe.server";

function normalizeWallet(value: string | null | undefined) {
  const wallet = value?.trim().toLowerCase() ?? "";
  return /^0x[0-9a-f]{40}$/.test(wallet) ? wallet : null;
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

function subscriptionPeriodEnd(subscription: Stripe.Subscription) {
  const endSeconds =
    subscription.items.data[0]?.current_period_end ??
    (subscription as { current_period_end?: number }).current_period_end;
  if (!endSeconds) return null;
  return new Date(endSeconds * 1000);
}

function subscriptionCustomerId(subscription: Stripe.Subscription) {
  if (typeof subscription.customer === "string") return subscription.customer;
  return subscription.customer?.id ?? null;
}

function mapStripeStatus(status: Stripe.Subscription.Status) {
  if (status === "trialing") return "trialing";
  if (status === "active") return "active";
  if (status === "past_due") return "past_due";
  if (status === "canceled") return "canceled";
  if (status === "unpaid") return "unpaid";
  if (status === "paused") return "paused";
  return status;
}

export function stripeSubscriptionToMembershipRow(
  subscription: Stripe.Subscription,
  customerSpendUsd: Record<string, number>,
): InternalMembershipRow | null {
  const walletAddress = resolveWalletAddress(subscription);
  if (!walletAddress) return null;

  const createdAt = new Date(subscription.created * 1000);
  const currentPeriodEnd = subscriptionPeriodEnd(subscription);
  const stripeCustomerId = subscriptionCustomerId(subscription);
  const tier = resolveTier(subscription);
  const paymentMethod = resolvePaymentMethod(subscription);
  const status = mapStripeStatus(subscription.status);

  const membershipInput = {
    status,
    paymentMethod,
    stripeCustomerId,
    stripeSubscriptionId: subscription.id,
    createdAt,
    currentPeriodEnd,
  };

  const isTrial = isStripeTrialMembership(membershipInput);
  const lifecycle = describeMembershipLifecycle(membershipInput);

  const customer =
    typeof subscription.customer === "object" ? subscription.customer : null;
  const email = customer && "email" in customer ? customer.email : null;

  return {
    walletAddress,
    displayName: email,
    profileSlug: null,
    twitterUsername: null,
    tier,
    productLabel: isTrial
      ? `${tierProductLabel(tier)} · Trial`
      : tierProductLabel(tier),
    status,
    lifecycle: lifecycle.lifecycle,
    statusLabel: lifecycle.statusLabel,
    paymentMethod,
    stripeCustomerId,
    stripeSubscriptionId: subscription.id,
    totalSpendUsd: stripeCustomerId
      ? (customerSpendUsd[stripeCustomerId] ?? 0)
      : estimateMembershipTotalSpendUsd({
          tier,
          paymentMethod,
          createdAt,
          currentPeriodEnd,
          status,
        }),
    createdAt: createdAt.toISOString(),
    currentPeriodEnd: currentPeriodEnd?.toISOString() ?? null,
    updatedAt: null,
    canceledAt:
      !lifecycle.isActive && currentPeriodEnd
        ? currentPeriodEnd.toISOString()
        : null,
    isActive: lifecycle.isActive,
    isTrial,
  };
}

export async function fetchStripeMembershipRows(
  customerSpendUsd: Record<string, number> = {},
) {
  if (!isStripeConfigured()) return [];

  const stripe = getStripeClient();
  const rows: InternalMembershipRow[] = [];

  let startingAfter: string | undefined;
  for (;;) {
    const page = await stripe.subscriptions.list({
      limit: 100,
      starting_after: startingAfter,
      status: "all",
      expand: ["data.customer"],
    });

    for (const subscription of page.data) {
      const row = stripeSubscriptionToMembershipRow(
        subscription,
        customerSpendUsd,
      );
      if (row) rows.push(row);
    }

    if (!page.has_more) break;
    startingAfter = page.data.at(-1)?.id;
    if (!startingAfter) break;
  }

  return rows;
}

export function mergeNeonAndStripeMembershipRows(
  neonRows: InternalMembershipRow[],
  stripeRows: InternalMembershipRow[],
) {
  const byWallet = new Map<string, InternalMembershipRow>();

  for (const row of neonRows) {
    byWallet.set(row.walletAddress.toLowerCase(), row);
  }

  for (const stripeRow of stripeRows) {
    const key = stripeRow.walletAddress.toLowerCase();
    const existing = byWallet.get(key);

    if (!existing) {
      byWallet.set(key, stripeRow);
      continue;
    }

    if (
      existing.paymentMethod === "gift" &&
      existing.lifecycle === "lifetime"
    ) {
      byWallet.set(key, {
        ...existing,
        stripeCustomerId:
          stripeRow.stripeCustomerId ?? existing.stripeCustomerId,
        stripeSubscriptionId:
          stripeRow.stripeSubscriptionId ?? existing.stripeSubscriptionId,
      });
      continue;
    }

    byWallet.set(key, {
      ...stripeRow,
      displayName: existing.displayName ?? stripeRow.displayName,
      profileSlug: existing.profileSlug ?? stripeRow.profileSlug,
      twitterUsername: existing.twitterUsername ?? stripeRow.twitterUsername,
      totalSpendUsd: Math.max(existing.totalSpendUsd, stripeRow.totalSpendUsd),
    });
  }

  return [...byWallet.values()].sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
}
