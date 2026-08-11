import type { StripeMemberRow } from "@/lib/internal-stats-types";

/** Season Pass was billed monthly on Whop — used only as a due-date estimate. */
export const WHOP_BILLING_CYCLE_DAYS = 30;

export type DueHorizonDays = 7 | 14 | 30;

export type MemberDueStatus = "overdue" | "due_soon" | "ok" | "unknown";

export function addDaysIso(iso: string, days: number): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  return new Date(ms + days * 86_400_000).toISOString();
}

export function memberDueAt(member: StripeMemberRow): string | null {
  return member.dueAt ?? member.currentPeriodEnd ?? null;
}

export function memberDueStatus(
  member: StripeMemberRow,
  horizonDays: DueHorizonDays = 14,
  nowMs = Date.now(),
): MemberDueStatus {
  if (member.status === "past_due" || member.status === "unpaid") {
    return "overdue";
  }
  if (!["active", "trialing", "past_due", "unpaid"].includes(member.status)) {
    return "unknown";
  }
  const due = memberDueAt(member);
  if (!due) return "unknown";
  const dueMs = Date.parse(due);
  if (!Number.isFinite(dueMs)) return "unknown";
  const delta = dueMs - nowMs;
  if (delta < 0) return "overdue";
  if (delta <= horizonDays * 86_400_000) return "due_soon";
  return "ok";
}

export function listMembersNeedingPaymentWarn(
  members: StripeMemberRow[],
  horizonDays: DueHorizonDays = 14,
  nowMs = Date.now(),
): StripeMemberRow[] {
  return members
    .filter((member) => {
      const status = memberDueStatus(member, horizonDays, nowMs);
      return status === "overdue" || status === "due_soon";
    })
    .sort((a, b) => {
      const aDue = memberDueAt(a);
      const bDue = memberDueAt(b);
      const aMs = aDue ? Date.parse(aDue) : Number.POSITIVE_INFINITY;
      const bMs = bDue ? Date.parse(bDue) : Number.POSITIVE_INFINITY;
      // Stripe past_due without a date still floats to top via status ranking.
      const aRank =
        a.status === "past_due" || a.status === "unpaid" ? -1 : aMs;
      const bRank =
        b.status === "past_due" || b.status === "unpaid" ? -1 : bMs;
      return aRank - bRank;
    });
}

export function formatDueRelative(
  dueIso: string | null,
  nowMs = Date.now(),
): string {
  if (!dueIso) return "No due date";
  const dueMs = Date.parse(dueIso);
  if (!Number.isFinite(dueMs)) return "No due date";
  const days = Math.round((dueMs - nowMs) / 86_400_000);
  if (days < 0) {
    const n = Math.abs(days);
    return n === 0 ? "Due today" : `${n}d overdue`;
  }
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days}d`;
}
