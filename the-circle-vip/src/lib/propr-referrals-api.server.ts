import "server-only";

import type {
  ProprReferralActivityRow,
  ProprReferralCodeRow,
  ProprReferralCountryRow,
  ProprReferralPurchaseRow,
  ProprReferralSeriesPoint,
  ProprReferralSourceRow,
  ProprReferralSummary,
  ProprReferralUserRow,
} from "@/lib/propr-referrals-types";

const PROPR_API_BASE = "https://api.propr.xyz/v1";
const ACTIVITY_PAGE_SIZE = 100;
const ACTIVITY_PAGE_CAP = 50;

type ProprStatsCode = {
  referralCodeId?: string;
  code: string;
  type: string;
  commissionPercent?: string | number;
  totalEarnings?: string | number;
  totalSignups?: number;
  totalPurchases?: number;
  totalVolume?: string | number;
  conversionRate?: string | number;
};

type ProprStatsResponse = {
  codes?: ProprStatsCode[];
  masterAffiliateEarnings?: string | number;
};

type ProprActivityItem = {
  referralCodeId?: string;
  code: string;
  type?: string;
  userId?: string;
  username?: string;
  action: string;
  attributor?: string;
  commissionPercent?: string | number;
  amount?: string | number;
  country?: string;
  createdAt: string;
};

type ProprActivityResponse = {
  data?: ProprActivityItem[];
  total?: number;
  offset?: number;
};

function num(value: string | number | null | undefined): number {
  if (value == null || value === "") return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function dayKey(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function dayLabel(isoDay: string) {
  const d = new Date(`${isoDay}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return isoDay;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function authHeaders(token: string): HeadersInit {
  const trimmed = token.trim();
  const value = trimmed.toLowerCase().startsWith("bearer ")
    ? trimmed
    : `Bearer ${trimmed}`;
  return {
    Accept: "application/json",
    Authorization: value,
  };
}

async function proprGet<T>(
  path: string,
  token: string,
  query?: Record<string, string | number>,
): Promise<T> {
  const url = new URL(`${PROPR_API_BASE}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, String(value));
    }
  }
  const res = await fetch(url.toString(), {
    headers: authHeaders(token),
    cache: "no-store",
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error("Propr session expired or unauthorized — paste a fresh Bearer token.");
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Propr API ${path} failed (${res.status})${body ? `: ${body.slice(0, 180)}` : ""}`,
    );
  }
  return (await res.json()) as T;
}

async function fetchAllActivity(token: string): Promise<ProprActivityItem[]> {
  const rows: ProprActivityItem[] = [];
  let offset = 0;
  for (let page = 0; page < ACTIVITY_PAGE_CAP; page += 1) {
    const payload = await proprGet<ProprActivityResponse>(
      "/referral/activity",
      token,
      { limit: ACTIVITY_PAGE_SIZE, offset },
    );
    const chunk = payload.data ?? [];
    rows.push(...chunk);
    const total = payload.total ?? rows.length;
    offset += chunk.length;
    if (chunk.length === 0 || offset >= total || chunk.length < ACTIVITY_PAGE_SIZE) {
      break;
    }
  }
  return rows;
}

function buildFromLive(
  stats: ProprStatsResponse,
  activity: ProprActivityItem[],
  previous?: ProprReferralSummary | null,
): ProprReferralSummary {
  const codeStats = stats.codes ?? [];
  const commissionPercent =
    num(codeStats[0]?.commissionPercent) ||
    previous?.commissionPercent ||
    15;

  const codes: ProprReferralCodeRow[] = codeStats.map((row) => ({
    code: row.code,
    codeType: row.type || "referral",
    users: row.totalSignups ?? 0,
    signups: row.totalSignups ?? 0,
    purchases: row.totalPurchases ?? 0,
    amount: round2(num(row.totalVolume)),
    estCommission: round2(num(row.totalEarnings)),
    shareUrl: `https://app.propr.xyz/r/${row.code}`,
  }));

  const sourcesMap = new Map<string, ProprReferralSourceRow>();
  for (const row of codes) {
    const key = row.codeType || "referral";
    const existing = sourcesMap.get(key);
    if (existing) {
      existing.users += row.users;
      existing.signups += row.signups;
      existing.purchases += row.purchases;
      existing.amount = round2(existing.amount + row.amount);
      existing.estCommission = round2(existing.estCommission + row.estCommission);
    } else {
      sourcesMap.set(key, {
        source: key,
        label:
          key === "affiliate"
            ? "Affiliate"
            : key === "referral"
              ? "Referral"
              : key,
        users: row.users,
        signups: row.signups,
        purchases: row.purchases,
        amount: row.amount,
        estCommission: row.estCommission,
      });
    }
  }

  const usersMap = new Map<string, ProprReferralUserRow>();
  const countriesMap = new Map<string, ProprReferralCountryRow>();
  const seriesMap = new Map<
    string,
    { signups: number; purchases: number; amount: number; commission: number }
  >();
  const activityRows: ProprReferralActivityRow[] = [];
  const purchases: ProprReferralPurchaseRow[] = [];
  const buyerIds = new Set<string>();
  let purchasesWithAmount = 0;

  const sortedActivity = [...activity].sort(
    (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
  );

  for (const row of sortedActivity) {
    const amount = round2(num(row.amount));
    const pct = num(row.commissionPercent) || commissionPercent;
    const commission =
      row.action === "purchase" ? round2(amount * (pct / 100)) : 0;
    const country = (row.country || "XX").toUpperCase();
    const userId = row.userId || row.username || "unknown";
    const username = row.username || userId;
    const code = row.code || "—";
    const codeType = row.type || "referral";

    activityRows.push({
      createdAt: row.createdAt,
      code,
      codeType,
      userId,
      username,
      action: row.action,
      amount,
      commission,
      country,
    });

    const day = dayKey(row.createdAt);
    const seriesPoint = seriesMap.get(day) ?? {
      signups: 0,
      purchases: 0,
      amount: 0,
      commission: 0,
    };
    if (row.action === "signup") seriesPoint.signups += 1;
    if (row.action === "purchase") {
      seriesPoint.purchases += 1;
      seriesPoint.amount = round2(seriesPoint.amount + amount);
      seriesPoint.commission = round2(seriesPoint.commission + commission);
      if (amount > 0) purchasesWithAmount += 1;
      buyerIds.add(userId);
      purchases.push({
        createdAt: row.createdAt,
        code,
        codeType,
        userId,
        username,
        action: "purchase",
        amount,
        commission,
        commissionPercent: pct,
        country,
      });
    }
    seriesMap.set(day, seriesPoint);

    const user = usersMap.get(userId) ?? {
      userId,
      username,
      country,
      codes: [],
      signups: 0,
      purchases: 0,
      amount: 0,
      estCommission: 0,
      firstAt: row.createdAt,
      lastAt: row.createdAt,
    };
    user.username = username;
    user.country = country || user.country;
    if (!user.codes.includes(code)) user.codes.push(code);
    if (row.action === "signup") user.signups += 1;
    if (row.action === "purchase") {
      user.purchases += 1;
      user.amount = round2(user.amount + amount);
      user.estCommission = round2(user.estCommission + commission);
    }
    if (!user.firstAt || row.createdAt < user.firstAt) user.firstAt = row.createdAt;
    if (!user.lastAt || row.createdAt > user.lastAt) user.lastAt = row.createdAt;
    usersMap.set(userId, user);

    const countryRow = countriesMap.get(country) ?? {
      country,
      users: 0,
      signups: 0,
      purchases: 0,
      amount: 0,
      estCommission: 0,
    };
    if (row.action === "signup") countryRow.signups += 1;
    if (row.action === "purchase") {
      countryRow.purchases += 1;
      countryRow.amount = round2(countryRow.amount + amount);
      countryRow.estCommission = round2(
        countryRow.estCommission + commission,
      );
    }
    countriesMap.set(country, countryRow);
  }

  // Unique users per country (approx from user map).
  const countryUsers = new Map<string, Set<string>>();
  for (const user of usersMap.values()) {
    const set = countryUsers.get(user.country) ?? new Set<string>();
    set.add(user.userId);
    countryUsers.set(user.country, set);
  }
  for (const [country, row] of countriesMap) {
    row.users = countryUsers.get(country)?.size ?? 0;
  }

  const series: ProprReferralSeriesPoint[] = [...seriesMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, point]) => ({
      date,
      label: dayLabel(date),
      signups: point.signups,
      purchases: point.purchases,
      amount: point.amount,
      commission: point.commission,
    }));

  const signups =
    codes.reduce((sum, row) => sum + row.signups, 0) ||
    activityRows.filter((r) => r.action === "signup").length;
  const purchaseCount =
    codes.reduce((sum, row) => sum + row.purchases, 0) ||
    purchases.length;
  const grossVolume = round2(
    codes.reduce((sum, row) => sum + row.amount, 0) ||
      purchases.reduce((sum, row) => sum + row.amount, 0),
  );
  const estCommission = round2(
    codes.reduce((sum, row) => sum + row.estCommission, 0),
  );

  const dates = sortedActivity.map((r) => r.createdAt).filter(Boolean);
  const dateStart = dates[0]?.slice(0, 10) ?? previous?.dateStart ?? null;
  const dateEnd =
    dates[dates.length - 1]?.slice(0, 10) ?? previous?.dateEnd ?? null;

  const eventRows = activityRows.length;
  const conversionRate =
    signups > 0 ? purchaseCount / Math.max(signups, 1) : previous?.conversionRate;

  // Claimable isn't on /referral/stats — preserve last known value when present.
  const availableToClaim = previous?.availableToClaim;

  return {
    importedAt: new Date().toISOString().slice(0, 10),
    partner: "propr",
    sourceFile: "api.propr.xyz/v1/referral/stats+activity",
    commissionPercent,
    currency: "USD",
    dateStart,
    dateEnd,
    eventRows,
    uniqueUsers: usersMap.size || signups,
    signups,
    purchases: purchaseCount,
    purchasesWithAmount:
      purchasesWithAmount || purchases.filter((p) => p.amount > 0).length,
    buyers: buyerIds.size,
    grossVolume,
    estCommission,
    availableToClaim,
    conversionRate,
    codes,
    sources: [...sourcesMap.values()].sort(
      (a, b) => b.amount - a.amount,
    ),
    countries: [...countriesMap.values()].sort((a, b) => b.amount - a.amount),
    users: [...usersMap.values()].sort((a, b) => b.amount - a.amount),
    series,
    recentPurchases: [...purchases]
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, 40),
    activity: [...activityRows]
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, 120),
    liveSource: "propr_api",
    liveSyncedAt: new Date().toISOString(),
  };
}

/** Pull live Propr partner stats + activity and map into dashboard summary shape. */
export async function fetchProprReferralSummaryFromApi(
  token: string,
  previous?: ProprReferralSummary | null,
): Promise<ProprReferralSummary> {
  const [stats, activity] = await Promise.all([
    proprGet<ProprStatsResponse>("/referral/stats", token),
    fetchAllActivity(token),
  ]);
  return buildFromLive(stats, activity, previous);
}

/** Decode JWT exp without verifying — used only for KV TTL hints. */
export function readBearerExpiryMs(token: string): number | null {
  try {
    const raw = token.trim().replace(/^Bearer\s+/i, "");
    const parts = raw.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1]!;
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    const normalized = padded.replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(
      typeof atob === "function"
        ? atob(normalized)
        : Buffer.from(normalized, "base64").toString("utf8"),
    ) as { exp?: number };
    return typeof json.exp === "number" ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}
