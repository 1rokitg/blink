export type SubstackLeadMeta = {
  kind: "substack";
  publication: string;
  /** Free | Yearly Subscriber | Monthly Subscriber | Comp | Author */
  type: string;
  /** Plan label from Substack export (not Stripe SoT). */
  stripePlan: string | null;
  /** Revenue reported in the Substack CSV export — not authoritative. */
  exportRevenue: number;
  exportRevenueLabel: string;
  exportCurrency: string | null;
  isPaidExport: boolean;
  firstPaidAt: string | null;
  paidUpgradeAt: string | null;
  cancelAt: string | null;
  expiresAt: string | null;
  startedAt: string | null;
  country: string | null;
  region: string | null;
  freeSource: string | null;
  paidSource: string | null;
  opens6mo: number;
  emailsReceived6mo: number;
  postViews: number;
  linksClicked: number;
  activity30d: number;
  sections: string | null;
  /**
   * Stripe Payments SoT for this email (Whop / Circle invoices).
   * Null when this address has no paid invoices in our Stripe account.
   * Newsletter billing itself usually stays on Substack's Stripe — so export
   * fields remain for newsletter context, while this is real Circle money.
   */
  stripe?: SubstackStripePayments | null;
};

export type SubstackStripePayments = {
  lifetimeUsd: number;
  invoiceCount: number;
  lastPaidAt: string | null;
  firstPaidAt: string | null;
  sources: string[];
  customerId: string | null;
  currency: string;
};

export type LeadMeta = SubstackLeadMeta;

export function isSubstackMeta(meta: unknown): meta is SubstackLeadMeta {
  return Boolean(
    meta &&
      typeof meta === "object" &&
      (meta as { kind?: string }).kind === "substack",
  );
}
