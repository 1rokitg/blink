export const DAY_MS = 24 * 60 * 60 * 1000;

/** First billing period length for Stripe checkout trials (`trial_period_days: 7`). */
const STRIPE_TRIAL_MIN_DAYS = 4;
const STRIPE_TRIAL_MAX_DAYS = 10;

export function isStripeTrialMembership(membership: {
  status: string;
  paymentMethod: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  createdAt: Date;
  currentPeriodEnd: Date | null;
}) {
  if (membership.paymentMethod === "gift") return false;

  const normalizedStatus = membership.status.trim().toLowerCase();
  if (normalizedStatus === "trialing") return true;

  const periodEnd = membership.currentPeriodEnd;
  if (!periodEnd || normalizedStatus !== "active") return false;

  const hasStripe =
    Boolean(membership.stripeSubscriptionId) ||
    Boolean(membership.stripeCustomerId);
  if (!hasStripe) return false;

  const periodDays =
    (periodEnd.getTime() - membership.createdAt.getTime()) / DAY_MS;

  return (
    periodDays >= STRIPE_TRIAL_MIN_DAYS &&
    periodDays <= STRIPE_TRIAL_MAX_DAYS &&
    periodEnd.getTime() > Date.now()
  );
}

export function isMembershipEntitledStatus(status: string) {
  const normalized = status.trim().toLowerCase();
  return normalized === "active" || normalized === "trialing";
}
