/** Shared money formatting for client + server. Card ledger is EUR. */

export function formatEur(amount: number) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatUsd(amount: number) {
  // Legacy name — Monetise now displays Stripe card amounts in EUR.
  return formatEur(amount);
}

export function formatMoney(amount: number, currency: string = "eur") {
  const code = currency.trim().toUpperCase() || "EUR";
  if (code === "USDC") {
    return `${Number(amount || 0).toLocaleString("en-US", {
      maximumFractionDigits: 2,
    })} USDC`;
  }
  try {
    return new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency: code === "USD" ? "EUR" : code,
      maximumFractionDigits: 2,
    }).format(Number.isFinite(amount) ? amount : 0);
  } catch {
    return formatEur(amount);
  }
}
