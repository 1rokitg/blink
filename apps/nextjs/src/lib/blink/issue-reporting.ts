"use client";

type IssueEventType = "issue_auto" | "issue_feedback";

type ReportIssueEventInput = {
  eventType: IssueEventType;
  category: string;
  source: string;
  summary: string;
  walletAddress?: string | null;
  code?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown>;
};

function getCurrentPath() {
  if (typeof window === "undefined") return null;
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export function getIssueErrorCode(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  return "unknown_error";
}

export function isLikelyDismissedWalletFlow(error: unknown) {
  const message = getIssueErrorCode(error).toLowerCase();

  return [
    "cancel",
    "dismiss",
    "closed_by_user",
    "user closed",
    "user rejected",
    "rejected by user",
    "popup closed",
  ].some((token) => message.includes(token));
}

export async function reportIssueEvent(input: ReportIssueEventInput) {
  try {
    await fetch("/api/metrics/event", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        eventType: input.eventType,
        source: input.source,
        walletAddress: input.walletAddress ?? undefined,
        metadata: {
          category: input.category,
          summary: input.summary,
          ...(input.code ? { code: input.code } : {}),
          ...(input.description ? { description: input.description } : {}),
          ...(getCurrentPath() ? { path: getCurrentPath() } : {}),
          ...(input.metadata ?? {}),
        },
      }),
    });
  } catch {
    // Best-effort support signal only.
  }
}
