import type { LeadMeta } from "@/lib/substack-meta";

export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "member"
  | "lost";

/** Human-readable status for the CRM board (first-look clarity). */
export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  member: "Paid member",
  lost: "Lost",
};

/** Map legacy stored values (`won`) onto the current status enum. */
export function normalizeLeadStatus(value: string | null | undefined): LeadStatus {
  if (value === "won" || value === "member") return "member";
  if (
    value === "new" ||
    value === "contacted" ||
    value === "qualified" ||
    value === "lost"
  ) {
    return value;
  }
  return "new";
}

export type LeadRecord = {
  id: string;
  email: string | null;
  telegramUsername: string | null;
  name: string | null;
  /** UI / form placement (landing-hero, waitlist, …) — not the ad channel. */
  source: string | null;
  /** First-touch sales channel (twitter, instagram, direct, …). */
  channel: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  referrer: string | null;
  note: string | null;
  status: LeadStatus;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  /** Dataset-specific enrichment (Substack plan/revenue, …). */
  meta?: LeadMeta | null;
};
