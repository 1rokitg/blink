"use server";

import { z } from "zod";

import { getWalletRoleFromDb } from "~/lib/blink/admin-roles.server";
import {
  type InternalMembershipRevenueForecast,
  type InternalMembershipRow,
  type InternalMembershipSummary,
  type StripeBillingSnapshot,
  type StripeMembershipSyncSummary,
  listInternalMembershipRows,
} from "~/lib/blink/internal-memberships.server";
import { fetchStripeBillingSnapshot } from "~/lib/blink/stripe-billing-metrics.server";
import { syncStripeSubscriptionsToDatabase } from "~/lib/blink/stripe-membership-sync.server";
import { isStripeConfigured } from "~/lib/blink/stripe.server";

const inputSchema = z.object({
  actingWalletAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
});

export type InternalMembershipsPayload = {
  rows: InternalMembershipRow[];
  summary: InternalMembershipSummary;
  forecast: InternalMembershipRevenueForecast;
  syncedAt: string;
  stripe: StripeBillingSnapshot | null;
  stripeSync: StripeMembershipSyncSummary | null;
};

export async function getInternalMemberships(
  input: unknown,
): Promise<InternalMembershipsPayload> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("Invalid memberships query.");
  }

  const actingWalletAddress = parsed.data.actingWalletAddress.toLowerCase();
  const role = await getWalletRoleFromDb(actingWalletAddress);
  if (role !== "admin" && role !== "superuser") {
    throw new Error("Unauthorized");
  }

  let stripeSync: StripeMembershipSyncSummary | null = null;
  let stripe: StripeBillingSnapshot | null = null;

  if (isStripeConfigured()) {
    try {
      stripeSync = await syncStripeSubscriptionsToDatabase();
    } catch (error) {
      console.error("[memberships] Stripe subscription sync failed", error);
    }

    try {
      stripe = await fetchStripeBillingSnapshot();
    } catch (error) {
      console.error("[memberships] Stripe billing snapshot failed", error);
    }
  }

  const { rows, summary, forecast } = await listInternalMembershipRows({
    customerSpendUsd: stripe?.customerSpendUsd,
    stripeMrrUsd: stripe?.mrrUsd,
    stripeTrialMrrUsd: stripe?.trialMrrUsd,
  });

  return {
    rows,
    summary,
    forecast,
    syncedAt: stripe?.syncedAt ?? new Date().toISOString(),
    stripe: stripe
      ? {
          syncedAt: stripe.syncedAt,
          mrrUsd: stripe.mrrUsd,
          trialMrrUsd: stripe.trialMrrUsd,
          arrUsd: stripe.arrUsd,
          revenue30dUsd: stripe.revenue30dUsd,
          revenueLifetimeUsd: stripe.revenueLifetimeUsd,
          activeSubscriptions: stripe.activeSubscriptions,
          trialingSubscriptions: stripe.trialingSubscriptions,
          pastDueSubscriptions: stripe.pastDueSubscriptions,
          canceledSubscriptions: stripe.canceledSubscriptions,
          totalCustomers: stripe.totalCustomers,
          unlinkedSubscriptions: stripe.unlinkedSubscriptions,
          recentTransactions: stripe.recentTransactions,
        }
      : null,
    stripeSync,
  };
}
