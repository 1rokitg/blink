export type ClaimLinkStatus =
  | "pending"
  | "claimed"
  | "completed"
  | "revoked"
  | "expired";

export type ClaimLinkRecord = {
  id: string;
  /**
   * Recurring Stripe charge in minor units.
   * New links are EUR cents; legacy links may still be USD cents.
   */
  amountUsdCents: number;
  currency: "eur" | "usd";
  /** Optional USD list price used when creating EUR claim prices. */
  baseAmountUsd?: number | null;
  interval: "month" | "year";
  intervalCount: number;
  /** Catalog plan metadata for membership sync (usually month). */
  planId: "month" | "quarter" | "year";
  priceId: string;
  productId: string;
  email: string | null;
  telegramUsername: string | null;
  note: string | null;
  label: string | null;
  status: ClaimLinkStatus;
  checkoutSessionId: string | null;
  subscriptionId: string | null;
  createdAt: string;
  createdBy: string;
  expiresAt: string | null;
  claimedAt: string | null;
  completedAt: string | null;
};

export type PublicClaimView = {
  id: string;
  amountUsd: number;
  amountLabel: string;
  interval: "month" | "year";
  intervalCount: number;
  email: string | null;
  telegramUsername: string | null;
  label: string | null;
  note: string | null;
  status: ClaimLinkStatus;
  expiresAt: string | null;
  usable: boolean;
};
