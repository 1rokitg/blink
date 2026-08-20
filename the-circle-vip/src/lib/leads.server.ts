import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  normalizeLeadStatus,
  type LeadRecord,
  type LeadStatus,
} from "@/lib/leads-types";

export type { LeadRecord, LeadStatus } from "@/lib/leads-types";

function hydrateLead(row: LeadRecord): LeadRecord {
  return {
    ...row,
    status: normalizeLeadStatus(row.status as string),
    channel: row.channel ?? null,
    utmSource: row.utmSource ?? null,
    utmMedium: row.utmMedium ?? null,
    utmCampaign: row.utmCampaign ?? null,
    referrer: row.referrer ?? null,
    meta: row.meta ?? null,
  };
}

const LEAD_KEY_PREFIX = "lead:";
const LEADS_INDEX_KEY = "leads:recent";
const LEADS_INDEX_CAP = 500;

function leadKey(id: string) {
  return `${LEAD_KEY_PREFIX}${id}`;
}

function fileStorePath() {
  return path.join(process.cwd(), ".data", "leads.json");
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

async function readFileStore(): Promise<Record<string, LeadRecord>> {
  try {
    const raw = await readFile(fileStorePath(), "utf8");
    return JSON.parse(raw) as Record<string, LeadRecord>;
  } catch {
    return {};
  }
}

async function writeFileStore(store: Record<string, LeadRecord>) {
  const file = fileStorePath();
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(store, null, 2), "utf8");
}

function normalizeUsername(value: string | undefined) {
  const trimmed = value?.trim().replace(/^@/, "") ?? "";
  return trimmed || null;
}

function normalizeEmail(value: string | undefined) {
  const trimmed = value?.trim().toLowerCase() ?? "";
  return trimmed || null;
}

async function putLead(record: LeadRecord) {
  const kv = await getKv();
  if (kv) {
    await kv.put(leadKey(record.id), JSON.stringify(record));
    const index =
      (await kv.get<{ ids: string[] }>(LEADS_INDEX_KEY, "json")) ?? {
        ids: [],
      };
    const ids = [
      record.id,
      ...index.ids.filter((id) => id !== record.id),
    ].slice(0, LEADS_INDEX_CAP);
    await kv.put(LEADS_INDEX_KEY, JSON.stringify({ ids }));
    return;
  }

  const store = await readFileStore();
  store[record.id] = record;
  await writeFileStore(store);
}

export async function getLead(id: string): Promise<LeadRecord | null> {
  const safeId = id.trim();
  if (!safeId.startsWith("ld_")) return null;
  const kv = await getKv();
  if (kv) {
    const row = await kv.get<LeadRecord>(leadKey(safeId), "json");
    return row ? hydrateLead(row) : null;
  }
  const store = await readFileStore();
  const row = store[safeId];
  return row ? hydrateLead(row) : null;
}

export async function listLeads(limit = 100): Promise<LeadRecord[]> {
  const kv = await getKv();
  if (kv) {
    const index =
      (await kv.get<{ ids: string[] }>(LEADS_INDEX_KEY, "json")) ?? {
        ids: [],
      };
    const rows: LeadRecord[] = [];
    for (const id of index.ids.slice(0, limit)) {
      const row = await getLead(id);
      if (row) rows.push(row);
    }
    return rows;
  }

  const store = await readFileStore();
  return Object.values(store)
    .map(hydrateLead)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export async function createLead(input: {
  email?: string;
  telegramUsername?: string;
  name?: string;
  source?: string;
  channel?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  referrer?: string | null;
  note?: string;
  createdBy: string;
}): Promise<LeadRecord> {
  const email = normalizeEmail(input.email);
  const telegramUsername = normalizeUsername(input.telegramUsername);
  if (!email && !telegramUsername && !input.name?.trim()) {
    throw new Error("Add at least an email, Telegram, or name.");
  }

  const now = new Date().toISOString();
  const record: LeadRecord = {
    id: `ld_${crypto.randomUUID().replaceAll("-", "")}`,
    email,
    telegramUsername,
    name: input.name?.trim().slice(0, 120) || null,
    source: input.source?.trim().slice(0, 64) || "manual",
    channel: input.channel?.trim().slice(0, 64) || null,
    utmSource: input.utmSource?.trim().slice(0, 64) || null,
    utmMedium: input.utmMedium?.trim().slice(0, 64) || null,
    utmCampaign: input.utmCampaign?.trim().slice(0, 128) || null,
    referrer: input.referrer?.trim().slice(0, 240) || null,
    note: input.note?.trim().slice(0, 400) || null,
    status: "new",
    createdAt: now,
    createdBy: input.createdBy.slice(0, 64),
    updatedAt: now,
  };

  await putLead(record);
  return record;
}

/** Look up a recent lead by normalized email (waitlist dedupe). */
export async function findLeadByEmail(
  email: string,
): Promise<LeadRecord | null> {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const leads = await listLeads(LEADS_INDEX_CAP);
  return leads.find((row) => row.email === normalized) ?? null;
}

/**
 * Public waitlist capture — upserts by email so re-submits stay idempotent.
 */
export async function captureWaitlistEmail(input: {
  email: string;
  source?: string;
  channel?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  referrer?: string | null;
  note?: string;
}): Promise<{ lead: LeadRecord; created: boolean }> {
  const email = normalizeEmail(input.email);
  if (!email) {
    throw new Error("Enter a valid email address.");
  }

  const existing = await findLeadByEmail(email);
  if (existing) {
    const next: LeadRecord = {
      ...existing,
      source: existing.source || input.source?.trim().slice(0, 64) || "waitlist",
      channel: existing.channel || input.channel?.trim().slice(0, 64) || null,
      utmSource:
        existing.utmSource || input.utmSource?.trim().slice(0, 64) || null,
      utmMedium:
        existing.utmMedium || input.utmMedium?.trim().slice(0, 64) || null,
      utmCampaign:
        existing.utmCampaign ||
        input.utmCampaign?.trim().slice(0, 128) ||
        null,
      referrer:
        existing.referrer || input.referrer?.trim().slice(0, 240) || null,
      note: existing.note || input.note?.trim().slice(0, 400) || null,
      updatedAt: new Date().toISOString(),
    };
    await putLead(next);
    return { lead: next, created: false };
  }

  const lead = await createLead({
    email,
    source: input.source?.trim().slice(0, 64) || "waitlist",
    channel: input.channel,
    utmSource: input.utmSource,
    utmMedium: input.utmMedium,
    utmCampaign: input.utmCampaign,
    referrer: input.referrer,
    note: input.note?.trim().slice(0, 400) || undefined,
    createdBy: "public-waitlist",
  });
  return { lead, created: true };
}

export async function updateLeadStatus(
  id: string,
  status: LeadStatus,
): Promise<LeadRecord> {
  const record = await getLead(id);
  if (!record) throw new Error("Lead not found.");
  const next: LeadRecord = {
    ...record,
    status,
    updatedAt: new Date().toISOString(),
  };
  await putLead(next);
  return next;
}

/** Idempotent upsert used by Whop / Propr import (deterministic `ld_*` ids). */
export async function upsertLead(input: {
  id: string;
  email?: string | null;
  telegramUsername?: string | null;
  name?: string | null;
  source?: string | null;
  channel?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  referrer?: string | null;
  note?: string | null;
  status?: LeadStatus;
  createdBy: string;
  createdAt?: string;
  meta?: LeadRecord["meta"];
}): Promise<LeadRecord> {
  const id = input.id.trim();
  if (!id.startsWith("ld_")) {
    throw new Error("Lead id must start with ld_");
  }

  const existing = await getLead(id);
  const now = new Date().toISOString();
  const record: LeadRecord = {
    id,
    email: normalizeEmail(input.email ?? undefined),
    telegramUsername: normalizeUsername(input.telegramUsername ?? undefined),
    name: input.name?.trim().slice(0, 120) || null,
    source: input.source?.trim().slice(0, 64) || "manual",
    channel:
      input.channel?.trim().slice(0, 64) || existing?.channel || null,
    utmSource:
      input.utmSource?.trim().slice(0, 64) || existing?.utmSource || null,
    utmMedium:
      input.utmMedium?.trim().slice(0, 64) || existing?.utmMedium || null,
    utmCampaign:
      input.utmCampaign?.trim().slice(0, 128) || existing?.utmCampaign || null,
    referrer:
      input.referrer?.trim().slice(0, 240) || existing?.referrer || null,
    note: input.note?.trim().slice(0, 400) || null,
    status: input.status ?? existing?.status ?? "new",
    createdAt: existing?.createdAt ?? input.createdAt ?? now,
    createdBy: existing?.createdBy ?? input.createdBy.slice(0, 64),
    updatedAt: now,
    meta: input.meta ?? existing?.meta ?? null,
  };

  await putLead(record);
  return record;
}

/** Bulk upsert for Whop / Propr import — one index write, parallel record puts. */
export async function upsertLeadsBulk(
  inputs: Array<{
    id: string;
    email?: string | null;
    telegramUsername?: string | null;
    name?: string | null;
    source?: string | null;
    channel?: string | null;
    utmSource?: string | null;
    utmMedium?: string | null;
    utmCampaign?: string | null;
    referrer?: string | null;
    note?: string | null;
    status?: LeadStatus;
    createdBy: string;
    createdAt?: string;
    meta?: LeadRecord["meta"];
  }>,
): Promise<LeadRecord[]> {
  const now = new Date().toISOString();
  const records: LeadRecord[] = inputs.map((input) => {
    const id = input.id.trim();
    if (!id.startsWith("ld_")) {
      throw new Error("Lead id must start with ld_");
    }
    return {
      id,
      email: normalizeEmail(input.email ?? undefined),
      telegramUsername: normalizeUsername(input.telegramUsername ?? undefined),
      name: input.name?.trim().slice(0, 120) || null,
      source: input.source?.trim().slice(0, 64) || "manual",
      channel: input.channel?.trim().slice(0, 64) || null,
      utmSource: input.utmSource?.trim().slice(0, 64) || null,
      utmMedium: input.utmMedium?.trim().slice(0, 64) || null,
      utmCampaign: input.utmCampaign?.trim().slice(0, 128) || null,
      referrer: input.referrer?.trim().slice(0, 240) || null,
      note: input.note?.trim().slice(0, 400) || null,
      status: input.status ?? "new",
      createdAt: input.createdAt ?? now,
      createdBy: input.createdBy.slice(0, 64),
      updatedAt: now,
      meta: input.meta ?? null,
    };
  });

  const kv = await getKv();
  if (kv) {
    await Promise.all(
      records.map((record) =>
        kv.put(leadKey(record.id), JSON.stringify(record)),
      ),
    );
    const index =
      (await kv.get<{ ids: string[] }>(LEADS_INDEX_KEY, "json")) ?? {
        ids: [],
      };
    const nextIds = [
      ...records.map((r) => r.id),
      ...index.ids.filter((id) => !records.some((r) => r.id === id)),
    ].slice(0, LEADS_INDEX_CAP);
    await kv.put(LEADS_INDEX_KEY, JSON.stringify({ ids: nextIds }));
    return records;
  }

  const store = await readFileStore();
  for (const record of records) store[record.id] = record;
  await writeFileStore(store);
  return records;
}
