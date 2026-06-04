"use server";

import { z } from "zod";

import {
  assertInternalReadAccess,
  canWriteInternalTools,
} from "~/lib/blink/admin-roles.server";
import {
  type InternalMembershipRevenueForecast,
  type InternalMembershipRow,
  type InternalMembershipSummary,
  type StripeBillingSnapshot,
  type StripeMembershipSyncSummary,
  buildMembershipRevenueForecast,
  listInternalMembershipRows,
} from "~/lib/blink/internal-memberships.server";
import { fetchStripeBillingSnapshot } from "~/lib/blink/stripe-billing-metrics.server";
import {
  fetchStripeMembershipRows,
  mergeNeonAndStripeMembershipRows,
} from "~/lib/blink/stripe-membership-rows.server";
import { syncStripeSubscriptionsToDatabase } from "~/lib/blink/stripe-membership-sync.server";
import { isStripeConfigured } from "~/lib/blink/stripe.server";

const inputSchema = z.object({
  actingWalletAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  emailAddresses: z.array(z.string().email()).optional(),
});

export type StripeConnectionStatus = {
  configured: boolean;
  error: string | null;
};

export type InternalMembershipsPayload = {
  rows: InternalMembershipRow[];
  summary: InternalMembershipSummary;
  forecast: InternalMembershipRevenueForecast;
  syncedAt: string;
  stripe: StripeBillingSnapshot | null;
  stripeSync: StripeMembershipSyncSummary | null;
  stripeConnection: StripeConnectionStatus;
};

function buildSummaryFromRows(
  rows: InternalMembershipRow[],
  headlineMrrUsd: number,
): InternalMembershipSummary {
  const activeRows = rows.filter((row) => row.isActive);
  const trialRows = activeRows.filter((row) => row.isTrial);
  const payingRows = activeRows.filter(
    (row) => row.paymentMethod !== "gift" && !row.isTrial,
  );
  const giftedRows = activeRows.filter((row) => row.paymentMethod === "gift");

  return {
    total: rows.length,
    active: activeRows.length,
    paying: payingRows.length,
    trials: trialRows.length,
    gifted: giftedRows.length,
    mrrUsd: headlineMrrUsd,
  };
}

export async function getInternalMemberships(
  input: unknown,
): Promise<InternalMembershipsPayload> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("Invalid memberships query.");
  }

  const actingWalletAddress = parsed.data.actingWalletAddress.toLowerCase();
  const role = await assertInternalReadAccess({
    actingWalletAddress,
    emailAddresses: parsed.data.emailAddresses,
  });
  const allowStripeSync = canWriteInternalTools(role);

  const stripeConnection: StripeConnectionStatus = {
    configured: isStripeConfigured(),
    error: null,
  };

  let stripeSync: StripeMembershipSyncSummary | null = null;
  let billingSnapshot: Awaited<ReturnType<typeof fetchStripeBillingSnapshot>> =
    null;

  if (stripeConnection.configured) {
    if (allowStripeSync) {
      try {
        stripeSync = await syncStripeSubscriptionsToDatabase();
      } catch (error) {
        console.error("[memberships] Stripe subscription sync failed", error);
        stripeConnection.error =
          error instanceof Error ? error.message : "Stripe sync failed.";
      }
    }

    try {
      billingSnapshot = await fetchStripeBillingSnapshot();
    } catch (error) {
      console.error("[memberships] Stripe billing snapshot failed", error);
      stripeConnection.error =
        error instanceof Error
          ? error.message
          : "Stripe billing snapshot failed.";
    }
  } else {
    stripeConnection.error =
      "STRIPE_SECRET_KEY is not set on this deployment (Cloudflare → blinkperps → Settings → Variables).";
  }

  const customerSpendUsd = billingSnapshot?.customerSpendUsd ?? {};

  const neonPayload = await listInternalMembershipRows({
    customerSpendUsd,
    stripeMrrUsd: billingSnapshot?.mrrUsd,
    stripeTrialMrrUsd: billingSnapshot?.trialMrrUsd,
  });

  let rows = neonPayload.rows;
  let summary = neonPayload.summary;
  let forecast = neonPayload.forecast;

  if (stripeConnection.configured && billingSnapshot) {
    try {
      const stripeRows = await fetchStripeMembershipRows(customerSpendUsd);
      rows = mergeNeonAndStripeMembershipRows(neonPayload.rows, stripeRows);
      summary = buildSummaryFromRows(rows, billingSnapshot.mrrUsd);
      forecast = buildMembershipRevenueForecast(rows, billingSnapshot.mrrUsd);
      forecast.stripeMrrUsd = billingSnapshot.mrrUsd;
      forecast.stripeArrUsd = billingSnapshot.arrUsd;
      forecast.stripeTrialMrrUsd = billingSnapshot.trialMrrUsd;
    } catch (error) {
      console.error("[memberships] Stripe row merge failed", error);
      stripeConnection.error =
        error instanceof Error ? error.message : "Stripe row merge failed.";
    }
  }

  const stripe: StripeBillingSnapshot | null = billingSnapshot
    ? {
        syncedAt: billingSnapshot.syncedAt,
        mrrUsd: billingSnapshot.mrrUsd,
        trialMrrUsd: billingSnapshot.trialMrrUsd,
        arrUsd: billingSnapshot.arrUsd,
        revenue30dUsd: billingSnapshot.revenue30dUsd,
        revenueLifetimeUsd: billingSnapshot.revenueLifetimeUsd,
        activeSubscriptions: billingSnapshot.activeSubscriptions,
        trialingSubscriptions: billingSnapshot.trialingSubscriptions,
        pastDueSubscriptions: billingSnapshot.pastDueSubscriptions,
        canceledSubscriptions: billingSnapshot.canceledSubscriptions,
        totalCustomers: billingSnapshot.totalCustomers,
        unlinkedSubscriptions: billingSnapshot.unlinkedSubscriptions,
        recentTransactions: billingSnapshot.recentTransactions,
      }
    : null;

  return {
    rows,
    summary,
    forecast,
    syncedAt: billingSnapshot?.syncedAt ?? new Date().toISOString(),
    stripe,
    stripeSync,
    stripeConnection,
  };
}
