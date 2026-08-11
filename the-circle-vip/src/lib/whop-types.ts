export type WhopSeedMember = {
  whopMemberId: string;
  whopUserId: string;
  name: string | null;
  username: string | null;
  email: string | null;
  telegramUsername: string | null;
  telegramId: string | null;
  discordUsername: string | null;
  platformSpendUsd: number;
  productIds: string[];
  planIds: string[];
  country: string | null;
  city: string | null;
  joinedAt: string | null;
  churnedAt: string | null;
  renewalAt: string | null;
  expiringAt: string | null;
  cancelingAt: string | null;
  active: boolean;
  source: "whop_member";
};

export type WhopSeedPayment = {
  whopPaymentId: string;
  paidAt: string;
  status: "paid";
  description: string | null;
  method: string | null;
  email: string | null;
  amountUsd: number;
  feeUsd: number;
  currency: string;
  country: string | null;
  productId: string | null;
  billingReason: string | null;
  promoCode: string | null;
  source: "whop";
  tag: "Whop";
};

export type WhopSeed = {
  importedFrom: string;
  generatedAt: string;
  members: WhopSeedMember[];
  payments: WhopSeedPayment[];
  totals: {
    members: number;
    activeMembers: number;
    payments: number;
    grossUsd: number;
  };
};

export type WhopMemberRecord = WhopSeedMember & {
  leadId: string | null;
  stripeCustomerId: string | null;
  importedAt: string;
  updatedAt: string;
};

export type WhopPaymentRecord = WhopSeedPayment & {
  stripeCustomerId: string | null;
  stripeInvoiceId: string | null;
  importedAt: string;
  updatedAt: string;
};

export type WhopImportResult = {
  ok: boolean;
  dryRun: boolean;
  syncStripe: boolean;
  members: {
    total: number;
    upserted: number;
    skipped: number;
    stripeCustomersCreated: number;
    stripeCustomersUpdated: number;
    stripeSkipped: number;
  };
  payments: {
    total: number;
    upserted: number;
    skipped: number;
    stripeInvoicesCreated: number;
    stripeInvoicesSkipped: number;
  };
  leads: {
    upserted: number;
  };
  grossUsd: number;
  errors: string[];
  finishedAt: string;
};
