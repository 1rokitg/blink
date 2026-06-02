export type MembershipLifecycle =
  | "active"
  | "trial"
  | "expires_soon"
  | "gift"
  | "lifetime"
  | "ended"
  | "inactive";

export type InternalMembershipRow = {
  walletAddress: string;
  displayName: string | null;
  profileSlug: string | null;
  twitterUsername: string | null;
  tier: string;
  productLabel: string;
  status: string;
  lifecycle: MembershipLifecycle;
  statusLabel: string;
  paymentMethod: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  totalSpendUsd: number;
  createdAt: string;
  currentPeriodEnd: string | null;
  updatedAt: string | null;
  canceledAt: string | null;
  isActive: boolean;
  isTrial: boolean;
};

export type InternalMembershipSummary = {
  total: number;
  active: number;
  paying: number;
  trials: number;
  gifted: number;
  mrrUsd: number;
};

export type MembershipForecastScenario = {
  id: "conservative" | "base" | "upside";
  label: string;
  horizonLabel: string;
  trialConversionRate: number;
  projectedMrrUsd: number;
  upliftUsd: number;
};

export type MembershipForecastTierRow = {
  tier: string;
  label: string;
  payingCount: number;
  trialCount: number;
  mrrUsd: number;
  pipelineMrrUsd: number;
};

export type InternalMembershipRevenueForecast = {
  currentMrrUsd: number;
  arrUsd: number;
  trialPipelineMrrUsd: number;
  trialsEndingWithin7d: number;
  pipelineEndingWithin7dMrrUsd: number;
  mrrByTier: MembershipForecastTierRow[];
  scenarios: MembershipForecastScenario[];
  assumptions: string[];
  /** When set, headline MRR/ARR come from live Stripe subscription data. */
  stripeMrrUsd?: number;
  stripeArrUsd?: number;
  stripeTrialMrrUsd?: number;
};

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
  recentTransactions: StripeBillingTransaction[];
};

export type StripeMembershipSyncSummary = {
  scanned: number;
  upserted: number;
  skippedGift: number;
  skippedNoWallet: number;
  errors: number;
};
