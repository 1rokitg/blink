import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  AffiliateCommissionType,
  AffiliateRecord,
  AffiliateStatus,
} from "@/lib/affiliates-types";
import { getAppUrl } from "@/lib/stripe";
import { SITE } from "@/lib/site";

export type {
  AffiliateCommissionType,
  AffiliateRecord,
  AffiliateStatus,
} from "@/lib/affiliates-types";

const AFFILIATE_KEY_PREFIX = "affiliate:";
const AFFILIATES_INDEX_KEY = "affiliates:recent";
const AFFILIATES_BY_CODE_PREFIX = "affiliate:code:";
const AFFILIATES_INDEX_CAP = 300;

function affiliateKey(id: string) {
  return `${AFFILIATE_KEY_PREFIX}${id}`;
}

function codeKey(code: string) {
  return `${AFFILIATES_BY_CODE_PREFIX}${code.toLowerCase()}`;
}

function fileStorePath() {
  return path.join(process.cwd(), ".data", "affiliates.json");
}

async function getKv(): Promise<KVNamespace | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    return (env as CloudflareEnv | undefined)?.CRYPTO_PAYMENTS ?? null;
  } catch {
    return null;
  }
}

async function readFileStore(): Promise<Record<string, AffiliateRecord>> {
  try {
    const raw = await readFile(fileStorePath(), "utf8");
    return JSON.parse(raw) as Record<string, AffiliateRecord>;
  } catch {
    return {};
  }
}

async function writeFileStore(store: Record<string, AffiliateRecord>) {
  const file = fileStorePath();
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(store, null, 2), "utf8");
}

function normalizeCode(value: string | undefined) {
  const trimmed = value?.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "") ?? "";
  return trimmed.slice(0, 32);
}

function normalizeUsername(value: string | undefined) {
  const trimmed = value?.trim().replace(/^@/, "") ?? "";
  return trimmed || null;
}

function normalizeEmail(value: string | undefined) {
  const trimmed = value?.trim().toLowerCase() ?? "";
  return trimmed || null;
}

function commissionForAmount(
  record: AffiliateRecord,
  amountUsd: number,
) {
  if (record.commissionType === "flat") {
    return Math.max(0, record.commissionValue);
  }
  return Math.round(amountUsd * (record.commissionValue / 100) * 100) / 100;
}

async function putAffiliate(record: AffiliateRecord) {
  const kv = await getKv();
  if (kv) {
    await kv.put(affiliateKey(record.id), JSON.stringify(record));
    await kv.put(codeKey(record.code), record.id);
    const index =
      (await kv.get<{ ids: string[] }>(AFFILIATES_INDEX_KEY, "json")) ?? {
        ids: [],
      };
    const ids = [
      record.id,
      ...index.ids.filter((id) => id !== record.id),
    ].slice(0, AFFILIATES_INDEX_CAP);
    await kv.put(AFFILIATES_INDEX_KEY, JSON.stringify({ ids }));
    return;
  }

  const store = await readFileStore();
  store[record.id] = record;
  await writeFileStore(store);
}

export function affiliateShareUrl(code: string) {
  return `${getAppUrl()}/join?ref=${encodeURIComponent(code)}`;
}

export async function getAffiliate(id: string): Promise<AffiliateRecord | null> {
  const safeId = id.trim();
  if (!safeId.startsWith("af_")) return null;
  const kv = await getKv();
  if (kv) {
    return (await kv.get<AffiliateRecord>(affiliateKey(safeId), "json")) ?? null;
  }
  const store = await readFileStore();
  return store[safeId] ?? null;
}

export async function getAffiliateByCode(
  codeInput: string,
): Promise<AffiliateRecord | null> {
  const code = normalizeCode(codeInput);
  if (!code) return null;
  const kv = await getKv();
  if (kv) {
    const id = await kv.get(codeKey(code));
    if (!id) return null;
    return getAffiliate(id);
  }
  const store = await readFileStore();
  return (
    Object.values(store).find((row) => row.code.toUpperCase() === code) ?? null
  );
}

export async function listAffiliates(limit = 100): Promise<AffiliateRecord[]> {
  const kv = await getKv();
  if (kv) {
    const index =
      (await kv.get<{ ids: string[] }>(AFFILIATES_INDEX_KEY, "json")) ?? {
        ids: [],
      };
    const rows: AffiliateRecord[] = [];
    for (const id of index.ids.slice(0, limit)) {
      const row = await getAffiliate(id);
      if (row) rows.push(row);
    }
    return rows;
  }

  const store = await readFileStore();
  return Object.values(store)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export async function createAffiliate(input: {
  code?: string;
  name: string;
  email?: string;
  telegramUsername?: string;
  commissionType?: AffiliateCommissionType;
  commissionValue?: number;
  note?: string;
  createdBy: string;
}): Promise<AffiliateRecord> {
  const name = input.name.trim().slice(0, 120);
  if (!name) throw new Error("Name is required.");

  let code = normalizeCode(input.code);
  if (!code) {
    const base = name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 8);
    code = `${base || "AFF"}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  }
  if (code.length < 3) throw new Error("Code must be at least 3 characters.");

  const existing = await getAffiliateByCode(code);
  if (existing) throw new Error(`Code ${code} is already in use.`);

  const commissionType = input.commissionType === "flat" ? "flat" : "percent";
  const defaultValue =
    commissionType === "flat" ? SITE.referralRewardUsd : 20;
  const commissionValue = Math.max(
    0,
    Number(input.commissionValue ?? defaultValue) || defaultValue,
  );
  if (commissionType === "percent" && commissionValue > 100) {
    throw new Error("Percent commission cannot exceed 100.");
  }

  const now = new Date().toISOString();
  const record: AffiliateRecord = {
    id: `af_${crypto.randomUUID().replaceAll("-", "")}`,
    code,
    name,
    email: normalizeEmail(input.email),
    telegramUsername: normalizeUsername(input.telegramUsername),
    status: "active",
    commissionType,
    commissionValue,
    note: input.note?.trim().slice(0, 400) || null,
    clicks: 0,
    signups: 0,
    conversions: 0,
    revenueAttributedUsd: 0,
    earningsUsd: 0,
    lastClickAt: null,
    lastConversionAt: null,
    createdAt: now,
    createdBy: input.createdBy.slice(0, 64),
    updatedAt: now,
  };

  await putAffiliate(record);
  return record;
}

export async function updateAffiliateStatus(
  id: string,
  status: AffiliateStatus,
): Promise<AffiliateRecord> {
  const record = await getAffiliate(id);
  if (!record) throw new Error("Affiliate not found.");
  const next: AffiliateRecord = {
    ...record,
    status,
    updatedAt: new Date().toISOString(),
  };
  await putAffiliate(next);
  return next;
}

export async function recordAffiliateClick(
  codeInput: string,
): Promise<AffiliateRecord | null> {
  const record = await getAffiliateByCode(codeInput);
  if (!record || record.status !== "active") return null;
  const next: AffiliateRecord = {
    ...record,
    clicks: record.clicks + 1,
    lastClickAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await putAffiliate(next);
  return next;
}

/** Soft signup ping when someone starts checkout with a ref code. */
export async function recordAffiliateSignup(
  codeInput: string,
): Promise<AffiliateRecord | null> {
  const record = await getAffiliateByCode(codeInput);
  if (!record || record.status !== "active") return null;
  const next: AffiliateRecord = {
    ...record,
    signups: record.signups + 1,
    updatedAt: new Date().toISOString(),
  };
  await putAffiliate(next);
  return next;
}

export async function recordAffiliateConversion(input: {
  code: string;
  amountUsd: number;
}): Promise<AffiliateRecord | null> {
  const record = await getAffiliateByCode(input.code);
  if (!record || record.status !== "active") return null;
  const amount = Math.max(0, input.amountUsd);
  const earn = commissionForAmount(record, amount);
  const next: AffiliateRecord = {
    ...record,
    conversions: record.conversions + 1,
    revenueAttributedUsd:
      Math.round((record.revenueAttributedUsd + amount) * 100) / 100,
    earningsUsd: Math.round((record.earningsUsd + earn) * 100) / 100,
    lastConversionAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await putAffiliate(next);
  return next;
}

export function affiliateTotals(rows: AffiliateRecord[]) {
  return {
    affiliates: rows.length,
    active: rows.filter((row) => row.status === "active").length,
    clicks: rows.reduce((sum, row) => sum + row.clicks, 0),
    conversions: rows.reduce((sum, row) => sum + row.conversions, 0),
    revenueAttributedUsd: rows.reduce(
      (sum, row) => sum + row.revenueAttributedUsd,
      0,
    ),
    earningsUsd: rows.reduce((sum, row) => sum + row.earningsUsd, 0),
  };
}
