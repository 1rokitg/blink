import type { StripeMemberRow } from "@/lib/internal-stats-types";
import type { LeadRecord } from "@/lib/leads-types";

/** Pull `cus_…` from Whop lead notes (`Stripe cus_…`). */
export function extractStripeCustomerId(note: string | null | undefined) {
  const match = note?.match(/\b(cus_[a-zA-Z0-9]+)\b/);
  return match?.[1] ?? null;
}

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() || null;
}

function normalizeTelegram(value: string | null | undefined) {
  const trimmed = value?.trim().replace(/^@/, "").toLowerCase() ?? "";
  return trimmed || null;
}

/**
 * Resolve the People member entity id for a CRM lead.
 * Paid Stripe members usually skip the Leads→People deep-link, but CRM-only
 * rows (`ld_*` Substack / Propr / Whop stubs) stay profileable forever so you
 * can attach phone, photos, and notes without a visitor fingerprint.
 */
export function peopleMemberIdForLead(
  lead: LeadRecord,
  members: StripeMemberRow[],
): string | null {
  const isCrmLead = lead.id.startsWith("ld_");
  if (
    (lead.status === "member" || lead.status === "lost") &&
    !isCrmLead
  ) {
    return null;
  }

  if (lead.id.startsWith("ld_trial_")) {
    return lead.id.slice("ld_trial_".length) || null;
  }

  const fromNote = extractStripeCustomerId(lead.note);
  if (fromNote) return fromNote;

  const email = normalizeEmail(lead.email);
  const telegram = normalizeTelegram(lead.telegramUsername);
  const match = members.find((member) => {
    if (email && normalizeEmail(member.email) === email) return true;
    if (
      telegram &&
      normalizeTelegram(member.telegramUsername) === telegram
    ) {
      return true;
    }
    return false;
  });
  if (match) return match.id;

  // CRM-only lead — profile against the lead id itself.
  return lead.id;
}

export function peopleHrefForLead(
  lead: LeadRecord,
  members: StripeMemberRow[],
): string | null {
  const id = peopleMemberIdForLead(lead, members);
  if (!id) return null;
  const params = new URLSearchParams({
    kind: "member",
    id,
    tab: "leads",
  });
  return `/internal/people?${params.toString()}`;
}

/** Synthetic People row so CRM-only leads can be enriched like visitors. */
export function leadToMemberStub(lead: LeadRecord): StripeMemberRow {
  return {
    id: lead.id,
    customerId: extractStripeCustomerId(lead.note),
    email: lead.email,
    name: lead.name,
    telegramUsername: lead.telegramUsername,
    telegramUserId: null,
    planId: null,
    planLabel: null,
    status: "trialing",
    mrr: 0,
    created: lead.createdAt,
    cancelAtPeriodEnd: false,
    inviteLink: null,
    source: lead.source || "lead",
    currentPeriodEnd: null,
    dueAt: null,
    dueKind: null,
    lastPaidAt: null,
    note: lead.note,
    tags: [],
  };
}

/**
 * CRM leads (including paid Substack / Propr / Whop stubs) that are not already
 * represented in `members` become stub People rows so `/internal/people?id=ld_…`
 * can open a profiler with phone, photos, and notes — no visitor required.
 */
export function mergeLeadStubsIntoMembers(
  members: StripeMemberRow[],
  leads: LeadRecord[],
): StripeMemberRow[] {
  const byId = new Map(members.map((member) => [member.id, member]));
  for (const lead of leads) {
    const isCrmLead = lead.id.startsWith("ld_");
    if (
      (lead.status === "member" || lead.status === "lost") &&
      !isCrmLead
    ) {
      continue;
    }
    const entityId = peopleMemberIdForLead(lead, members);
    if (!entityId || byId.has(entityId)) continue;
    const stub = leadToMemberStub(lead);
    stub.id = entityId;
    if (
      (lead.source === "whop_person" ||
        lead.source === "substack" ||
        lead.source === "propr") &&
      lead.status === "member"
    ) {
      stub.status = "active";
      stub.source = lead.source;
    } else if (
      (lead.source === "whop_person" || lead.source === "substack") &&
      lead.status === "lost"
    ) {
      stub.status = "canceled";
      stub.source = lead.source;
    }
    byId.set(entityId, stub);
  }
  return [...byId.values()];
}
