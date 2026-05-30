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
};
