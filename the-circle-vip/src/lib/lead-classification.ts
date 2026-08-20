import type { LeadRecord, LeadStatus } from "@/lib/leads-types";
import type { StripeMemberRow } from "@/lib/internal-stats-types";

/** Whop cash comps imported with this display name — not conversion pipeline. */
export function isInPersonCustomer(name: string | null | undefined) {
  return (name ?? "").trim().toLowerCase() === "in-person customer";
}

/**
 * Conversion leads = trialing members who still need to pay,
 * excluding in-person customers (comps / cash handled offline).
 *
 * Covers:
 * - Stripe / manual_grant trials
 * - Whop migrants with no paid invoice (status synthetic `trialing`)
 */
export function isMemberConversionLead(
  member: Pick<
    StripeMemberRow,
    "status" | "name" | "source" | "lastPaidAt" | "mrr"
  >,
) {
  if (isInPersonCustomer(member.name)) return false;
  if (member.status === "trialing") return true;
  // Belt-and-suspenders for Whop unpaid if status ever drifts.
  if (
    member.source === "whop_member" &&
    !member.lastPaidAt &&
    (member.mrr ?? 0) <= 0
  ) {
    return true;
  }
  return false;
}

export function leadStatusForConversionMember(
  member: Pick<StripeMemberRow, "status" | "name" | "lastPaidAt" | "mrr">,
): LeadStatus {
  if (isInPersonCustomer(member.name)) return "member";
  if (member.lastPaidAt || (member.mrr ?? 0) > 0) return "member";
  if (member.status === "canceled" || member.status === "unpaid") {
    return member.status === "canceled" ? "lost" : "new";
  }
  if (member.status === "trialing") return "new";
  return "new";
}

export function memberToLeadRecord(
  member: StripeMemberRow,
  status: LeadStatus = "new",
): LeadRecord {
  const key = member.id.replace(/[^a-zA-Z0-9_]/g, "");
  const idPrefix =
    member.source === "whop_member" ? "ld_whop_" : "ld_trial_";
  const now = new Date().toISOString();
  return {
    id: `${idPrefix}${key}`.slice(0, 80),
    email: member.email,
    telegramUsername: member.telegramUsername,
    name: member.name,
    source: member.source || "trialing",
    channel: null,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    referrer: null,
    note: [
      member.status === "trialing" ? "Trialing — needs conversion" : null,
      member.source === "whop_member" && !member.lastPaidAt
        ? "Whop member with no paid invoice"
        : null,
      member.planLabel,
      member.note,
    ]
      .filter(Boolean)
      .join(" · ")
      .slice(0, 400),
    status,
    createdAt: member.created,
    createdBy: `member:${member.source || "stripe"}`,
    updatedAt: now,
  };
}
