export type ProprReferralCodeRow = {
  code: string;
  codeType: string;
  users: number;
  signups: number;
  purchases: number;
  amount: number;
  estCommission: number;
  shareUrl?: string;
};

export type ProprReferralSourceRow = {
  source: string;
  label: string;
  users: number;
  signups: number;
  purchases: number;
  amount: number;
  estCommission: number;
};

export type ProprReferralCountryRow = {
  country: string;
  users: number;
  signups: number;
  purchases: number;
  amount: number;
  estCommission: number;
};

export type ProprReferralUserRow = {
  userId: string;
  username: string;
  country: string;
  codes: string[];
  signups: number;
  purchases: number;
  amount: number;
  estCommission: number;
  firstAt: string | null;
  lastAt: string | null;
};

export type ProprReferralPurchaseRow = {
  createdAt: string;
  code: string;
  codeType: string;
  userId: string;
  username: string;
  action: "purchase";
  amount: number;
  commission?: number;
  commissionPercent: number;
  country: string;
};

export type ProprReferralActivityRow = {
  createdAt: string;
  code: string;
  codeType: string;
  userId: string;
  username: string;
  action: "signup" | "purchase" | string;
  amount: number;
  commission: number;
  country: string;
};

export type ProprReferralSeriesPoint = {
  date: string;
  label: string;
  signups: number;
  purchases: number;
  amount: number;
  commission?: number;
};

export type ProprReferralSummary = {
  importedAt: string;
  partner: string;
  sourceFile: string;
  commissionPercent: number;
  currency: string;
  dateStart: string | null;
  dateEnd: string | null;
  eventRows: number;
  uniqueUsers: number;
  signups: number;
  purchases: number;
  purchasesWithAmount: number;
  buyers: number;
  grossVolume: number;
  estCommission: number;
  availableToClaim?: number;
  conversionRate?: number;
  codes: ProprReferralCodeRow[];
  sources?: ProprReferralSourceRow[];
  countries: ProprReferralCountryRow[];
  users: ProprReferralUserRow[];
  series: ProprReferralSeriesPoint[];
  recentPurchases: ProprReferralPurchaseRow[];
  activity?: ProprReferralActivityRow[];
  /** Present when summary came from live Propr API (vs CSV seed). */
  liveSource?: "propr_api" | "csv_seed" | "disk" | "kv";
  liveSyncedAt?: string | null;
};
