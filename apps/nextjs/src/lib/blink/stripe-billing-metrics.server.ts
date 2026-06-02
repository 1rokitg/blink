import type Stripe from "stripe";

import { getStripeClient, isStripeConfigured } from "./stripe.server";

export type StripeBillingTransaction = {
  id: string;
  createdAt: string;
  amountUsd: number;
  status: string;
  customerId: string | null;
  description: string | null;
};

export type StripeBillingSnapshot = {
  syncedAt: string;
  mrrUsd: number;
  trialMrrUsd: number;
  arrUsd: number;
  revenue30dUsd: number;
  revenueLifetimeUsd: number;
  activeSubscriptions: number;
  trialingSubscriptions: number;
  pastDueSubscriptions: number;
  canceledSubscriptions: number;
  totalCustomers: number;
  unlinkedSubscriptions: number;
  customerSpendUsd: Record<string, number>;
  recentTransactions: StripeBillingTransaction[];
};

function subscriptionMonthlyUsd(subscription: Stripe.Subscription) {
  let total = 0;

  for (const item of subscription.items.data) {
    const price = item.price;
    if (!price?.unit_amount) continue;

    const amount = price.unit_amount / 100;
    const interval = price.recurring?.interval ?? "month";
    const intervalCount = price.recurring?.interval_count ?? 1;

    if (interval === "year") {
      total += amount / (12 * intervalCount);
    } else if (interval === "month") {
      total += amount / intervalCount;
    } else if (interval === "week") {
      total += (amount * 52) / (12 * intervalCount);
    } else if (interval === "day") {
      total += (amount * 365) / (12 * intervalCount);
    }
  }

  return total;
}

function hasWalletMetadata(subscription: Stripe.Subscription) {
  const wallet = subscription.metadata?.walletAddress?.trim().toLowerCase() ?? "";
  if (/^0x[0-9a-f]{40}$/.test(wallet)) return true;

  const customer = subscription.customer;
  if (customer && typeof customer !== "string") {
    const fromCustomer =
      customer.metadata?.walletAddress?.trim().toLowerCase() ?? "";
    return /^0x[0-9a-f]{40}$/.test(fromCustomer);
  }

  return false;
}

export async function fetchStripeBillingSnapshot(): Promise<StripeBillingSnapshot | null> {
  if (!isStripeConfigured()) return null;

  const stripe = getStripeClient();
  const now = Date.now();
  const thirtyDaysAgo = Math.floor((now - 30 * 24 * 60 * 60 * 1000) / 1000);

  let mrrUsd = 0;
  let trialMrrUsd = 0;
  let activeSubscriptions = 0;
  let trialingSubscriptions = 0;
  let pastDueSubscriptions = 0;
  let canceledSubscriptions = 0;
  let unlinkedSubscriptions = 0;

  let startingAfter: string | undefined;
  for (;;) {
    const page = await stripe.subscriptions.list({
      limit: 100,
      starting_after: startingAfter,
      status: "all",
      expand: ["data.customer"],
    });

    for (const subscription of page.data) {
      const monthly = subscriptionMonthlyUsd(subscription);

      if (subscription.status === "active") {
        activeSubscriptions += 1;
        mrrUsd += monthly;
      } else if (subscription.status === "trialing") {
        trialingSubscriptions += 1;
        trialMrrUsd += monthly;
      } else if (subscription.status === "past_due") {
        pastDueSubscriptions += 1;
      } else if (subscription.status === "canceled") {
        canceledSubscriptions += 1;
      }

      if (!hasWalletMetadata(subscription)) {
        unlinkedSubscriptions += 1;
      }
    }

    if (!page.has_more) break;
    startingAfter = page.data.at(-1)?.id;
    if (!startingAfter) break;
  }

  const customerSpendUsd: Record<string, number> = {};
  const recentTransactions: StripeBillingTransaction[] = [];
  let revenue30dUsd = 0;
  let revenueLifetimeUsd = 0;

  let chargeStartingAfter: string | undefined;
  for (;;) {
    const page = await stripe.charges.list({
      limit: 100,
      starting_after: chargeStartingAfter,
    });

    for (const charge of page.data) {
      if (!charge.paid || charge.status !== "succeeded") continue;

      const amountUsd = charge.amount / 100;
      revenueLifetimeUsd += amountUsd;

      if (charge.created >= thirtyDaysAgo) {
        revenue30dUsd += amountUsd;
      }

      const customerId =
        typeof charge.customer === "string" ? charge.customer : charge.customer?.id ?? null;

      if (customerId) {
        customerSpendUsd[customerId] =
          (customerSpendUsd[customerId] ?? 0) + amountUsd;
      }

      if (recentTransactions.length < 12) {
        recentTransactions.push({
          id: charge.id,
          createdAt: new Date(charge.created * 1000).toISOString(),
          amountUsd,
          status: charge.status,
          customerId,
          description: charge.description,
        });
      }
    }

    if (!page.has_more) break;
    chargeStartingAfter = page.data.at(-1)?.id;
    if (!chargeStartingAfter) break;
  }

  recentTransactions.sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );

  const customerList = await stripe.customers.list({ limit: 1 });
  const totalCustomers = customerList.has_more
    ? await countStripeCustomers(stripe)
    : customerList.data.length;

  return {
    syncedAt: new Date().toISOString(),
    mrrUsd,
    trialMrrUsd,
    arrUsd: mrrUsd * 12,
    revenue30dUsd,
    revenueLifetimeUsd,
    activeSubscriptions,
    trialingSubscriptions,
    pastDueSubscriptions,
    canceledSubscriptions,
    totalCustomers,
    unlinkedSubscriptions,
    customerSpendUsd,
    recentTransactions,
  };
}

async function countStripeCustomers(stripe: ReturnType<typeof getStripeClient>) {
  let total = 0;
  let startingAfter: string | undefined;

  for (;;) {
    const page = await stripe.customers.list({
      limit: 100,
      starting_after: startingAfter,
    });
    total += page.data.length;
    if (!page.has_more) break;
    startingAfter = page.data.at(-1)?.id;
    if (!startingAfter) break;
  }

  return total;
}
