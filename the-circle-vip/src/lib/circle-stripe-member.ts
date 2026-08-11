import type { StripeMemberRow } from "@/lib/internal-stats-types";

const WHOP_SOURCES = new Set(["whop", "whop_member", "whop_import"]);

const CIRCLE_STRIPE_SOURCES = new Set([
  "claim_link",
  "manual_grant",
  "checkout",
  "stripe_checkout",
  "join",
  "crypto",
  "transfer",
]);

/**
 * True when this membership is billed on The Circle's own Stripe account
 * (claim links, join checkout, manual grants) — not a Whop migrant stub.
 */
export function isCircleStripeMember(member: StripeMemberRow): boolean {
  const source = member.source?.trim().toLowerCase() || "";
  if (WHOP_SOURCES.has(source) || member.dueKind === "whop_estimate") {
    return false;
  }
  if (CIRCLE_STRIPE_SOURCES.has(source)) return true;
  // Real Stripe subscription id with no Whop tagging = Circle-native.
  return member.id.startsWith("sub_");
}

export function circleStripeSourceLabel(source: string | null | undefined) {
  const raw = source?.trim() || "";
  if (raw === "claim_link") return "Claim link";
  if (raw === "manual_grant") return "Manual grant";
  if (raw === "checkout" || raw === "stripe_checkout") return "Checkout";
  if (raw === "join") return "Join";
  if (raw === "crypto") return "Crypto";
  if (raw === "transfer") return "Transfer";
  return raw || "Circle Stripe";
}
