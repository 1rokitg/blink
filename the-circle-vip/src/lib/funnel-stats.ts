import type { LeadRecord, LeadStatus } from "@/lib/leads-types";
import type {
  DashboardRange,
  InternalDashboardStats,
  StripeMemberRow,
} from "@/lib/internal-stats-types";
import { peopleHrefForLead } from "@/lib/lead-people";

/** Sources / creators that count as marketing email captures. */
export const EMAIL_CAPTURE_SOURCES = new Set([
  "landing",
  "landing-hero",
  "landing-mid",
  "landing-final",
  "waitlist",
]);

export type FunnelEmailRow = {
  id: string;
  email: string;
  source: string | null;
  channel: string | null;
  utmCampaign: string | null;
  status: LeadStatus;
  note: string | null;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  /** Matched paying Stripe member id when known. */
  paidMemberId: string | null;
  paidMemberLabel: string | null;
  peopleHref: string | null;
  inRange: boolean;
};

export type FunnelSourceCount = {
  source: string;
  count: number;
};

export type FunnelChannelCount = {
  channel: string;
  count: number;
};

export type FunnelBoard = {
  rangeDays: DashboardRange;
  generatedAt: string;
  trafficSource: InternalDashboardStats["trafficSource"];
  visitors: number;
  emailsCaptured: number;
  emailsCapturedAllTime: number;
  emailsPaid: number;
  emailsOpen: number;
  visitorToEmailPct: number | null;
  emailToPaidPct: number | null;
  visitorToPaidPct: number | null;
  bySource: FunnelSourceCount[];
  byChannel: FunnelChannelCount[];
  emails: FunnelEmailRow[];
};

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() || null;
}

export function isEmailCaptureLead(lead: LeadRecord) {
  const email = normalizeEmail(lead.email);
  if (!email) return false;
  if (lead.createdBy === "public-waitlist") return true;
  if (lead.source && EMAIL_CAPTURE_SOURCES.has(lead.source)) return true;
  return false;
}

export function isPayingMember(member: StripeMemberRow) {
  if (member.status === "active") return true;
  if ((member.mrr ?? 0) > 0) return true;
  if (member.lastPaidAt) return true;
  return false;
}

function rangeStartIso(rangeDays: DashboardRange) {
  if (rangeDays === 0) return null;
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  if (rangeDays > 1) {
    start.setUTCDate(start.getUTCDate() - (rangeDays - 1));
  }
  return start.toISOString();
}

function inCreatedRange(createdAt: string, rangeDays: DashboardRange) {
  const start = rangeStartIso(rangeDays);
  if (!start) return true;
  return createdAt >= start;
}

function findPayingMember(
  email: string,
  members: StripeMemberRow[],
): StripeMemberRow | null {
  return (
    members.find(
      (member) =>
        normalizeEmail(member.email) === email && isPayingMember(member),
    ) ?? null
  );
}

function memberLabel(member: StripeMemberRow) {
  return (
    member.name ||
    member.telegramUsername ||
    member.email ||
    member.planLabel ||
    member.id
  );
}

export function formatFunnelPct(rate: number | null) {
  if (rate == null || !Number.isFinite(rate)) return "—";
  return `${(rate * 100).toFixed(1)}%`;
}

/**
 * Build the Funnel board from dashboard stats + CRM leads.
 * Visitors come from the selected traffic window; emails filter by `createdAt`.
 */
export function buildFunnelBoard(
  stats: InternalDashboardStats,
  leads: LeadRecord[],
): FunnelBoard {
  const captureLeads = leads.filter(isEmailCaptureLead);
  const emails: FunnelEmailRow[] = captureLeads
    .map((lead) => {
      const email = normalizeEmail(lead.email)!;
      const paid = findPayingMember(email, stats.members);
      const crmPaid = lead.status === "member";

      return {
        id: lead.id,
        email,
        source: lead.source,
        channel: lead.channel,
        utmCampaign: lead.utmCampaign,
        status: lead.status,
        note: lead.note,
        createdAt: lead.createdAt,
        createdBy: lead.createdBy,
        updatedAt: lead.updatedAt,
        paidMemberId: paid?.id ?? null,
        paidMemberLabel: paid
          ? memberLabel(paid)
          : crmPaid
            ? "CRM · Paid member"
            : null,
        peopleHref: peopleHrefForLead(lead, stats.members),
        inRange: inCreatedRange(lead.createdAt, stats.rangeDays),
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const inRange = emails.filter((row) => row.inRange);
  const emailsPaid = inRange.filter(
    (row) => row.status === "member" || Boolean(row.paidMemberId),
  ).length;
  const emailsOpen = inRange.filter(
    (row) =>
      row.status !== "member" &&
      row.status !== "lost" &&
      !row.paidMemberId,
  ).length;

  const visitors = stats.rangeUniques;
  const emailsCaptured = inRange.length;
  const visitorToEmailPct =
    visitors > 0 ? emailsCaptured / visitors : null;
  const emailToPaidPct =
    emailsCaptured > 0 ? emailsPaid / emailsCaptured : null;
  const visitorToPaidPct = visitors > 0 ? emailsPaid / visitors : null;

  const sourceMap = new Map<string, number>();
  const channelMap = new Map<string, number>();
  for (const row of inRange) {
    const sourceKey = row.source || "unknown";
    sourceMap.set(sourceKey, (sourceMap.get(sourceKey) ?? 0) + 1);
    const channelKey = row.channel || "direct";
    channelMap.set(channelKey, (channelMap.get(channelKey) ?? 0) + 1);
  }
  const bySource = [...sourceMap.entries()]
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);
  const byChannel = [...channelMap.entries()]
    .map(([channel, count]) => ({ channel, count }))
    .sort((a, b) => b.count - a.count);

  return {
    rangeDays: stats.rangeDays,
    generatedAt: new Date().toISOString(),
    trafficSource: stats.trafficSource,
    visitors,
    emailsCaptured,
    emailsCapturedAllTime: emails.length,
    emailsPaid,
    emailsOpen,
    visitorToEmailPct,
    emailToPaidPct,
    visitorToPaidPct,
    bySource,
    byChannel,
    emails,
  };
}
