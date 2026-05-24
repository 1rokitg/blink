import { env } from "~/env";

export const GROWTH_ZERO_FEE_MARKETS: readonly string[] = [
  "BTC",
  "ETH",
  "SOL",
  "HYPE",
];

export function isGrowthModeEnabled() {
  return env.NEXT_PUBLIC_GROWTH_MODE === "1";
}

export function getGrowthProDiscountRate() {
  return env.BLINK_GROWTH_PRO_DISCOUNT_PCT / 100;
}

export function getGrowthReferralMultiplier() {
  return env.BLINK_GROWTH_REFERRAL_MULTIPLIER;
}
