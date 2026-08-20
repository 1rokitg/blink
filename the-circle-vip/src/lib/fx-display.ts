import { usdToEur as usdToEurFx, usdToEurRate } from "@/lib/fx";

/** Client-safe EUR display helpers for the Indicators storefront. */
export function usdToEur(amountUsd: number) {
  return usdToEurFx(amountUsd, usdToEurRate());
}

export function formatEur(amount: number) {
  if (!Number.isFinite(amount)) return "€0";
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(amount);
}
