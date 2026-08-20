export type AffiliateStatus = "active" | "paused" | "archived";

export type AffiliateCommissionType = "percent" | "flat";

export type AffiliateRecord = {
  id: string;
  /** Unique share code used in `?ref=` / checkout referral. */
  code: string;
  name: string;
  email: string | null;
  telegramUsername: string | null;
  status: AffiliateStatus;
  commissionType: AffiliateCommissionType;
  /** Percent (0–100) or flat USD reward per conversion. */
  commissionValue: number;
  note: string | null;
  clicks: number;
  signups: number;
  conversions: number;
  /** Gross checkout volume attributed (USD). */
  revenueAttributedUsd: number;
  /** Commission owed / accrued (USD). */
  earningsUsd: number;
  lastClickAt: string | null;
  lastConversionAt: string | null;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
};

export const AFFILIATE_STATUS_LABEL: Record<AffiliateStatus, string> = {
  active: "Active",
  paused: "Paused",
  archived: "Archived",
};
