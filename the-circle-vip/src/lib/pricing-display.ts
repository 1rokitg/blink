import { formatEur, type Plan, type PlanId } from "@/lib/plans";

/**
 * Display-only "was" / compare-at prices for SaaS-style discount framing.
 * Uses EUR card amounts for public display.
 */
export function monthsCovered(plan: Plan): number {
  if (plan.interval === "year") return 12 * plan.intervalCount;
  return Math.max(1, plan.intervalCount);
}

/** Fake list price — typically 2× or monthly×months, whichever looks steeper. */
export function compareAtEur(plan: Plan, monthlyEur: number): number {
  const double = plan.amountEur * 2;
  if (plan.id === "month") {
    return Math.round(double);
  }
  const fullMonthlyRun = monthlyEur * monthsCovered(plan);
  return Math.round(Math.max(double, fullMonthlyRun));
}

/** @deprecated Use compareAtEur — kept for transitional call sites. */
export function compareAtUsd(plan: Plan, monthlyAmount: number): number {
  return compareAtEur(plan, monthlyAmount);
}

export function savePercent(plan: Plan, monthlyEur: number): number | null {
  const was = compareAtEur(plan, monthlyEur);
  if (was <= plan.amountEur) return null;
  return Math.round((1 - plan.amountEur / was) * 100);
}

export function perMonthEur(plan: Plan): number {
  return plan.amountEur / monthsCovered(plan);
}

/** @deprecated Use perMonthEur */
export function perMonthUsd(plan: Plan): number {
  return perMonthEur(plan);
}

export function monthlyPlan(plans: Plan[]): Plan | undefined {
  return plans.find((p) => p.id === "month");
}

export function yearlyPlan(plans: Plan[]): Plan | undefined {
  return plans.find((p) => p.id === "year");
}

export type BillingInterval = "month" | "year";

export function planIdForInterval(interval: BillingInterval): PlanId {
  return interval === "year" ? "year" : "month";
}

export function formatEurWhole(amount: number) {
  if (!Number.isFinite(amount)) return "€0";
  const rounded = Math.round(amount);
  return `€${rounded.toLocaleString("en-IE")}`;
}

/** @deprecated Use formatEurWhole / formatEur */
export function formatUsdWhole(amount: number) {
  return formatEurWhole(amount);
}

export { formatEur };
