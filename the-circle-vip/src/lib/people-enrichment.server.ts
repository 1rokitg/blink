import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  type PersonEnrichment,
  type PersonKind,
  personEnrichmentId,
} from "@/lib/people-types";

export type { PersonEnrichment, PersonKind } from "@/lib/people-types";
export { personEnrichmentId } from "@/lib/people-types";

const KEY_PREFIX = "person:";
const INDEX_KEY = "people:enrichments";
const INDEX_CAP = 500;

function recordKey(id: string) {
  return `${KEY_PREFIX}${id}`;
}

function fileStorePath() {
  return path.join(process.cwd(), ".data", "people-enrichments.json");
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

async function readFileStore(): Promise<Record<string, PersonEnrichment>> {
  try {
    const raw = await readFile(fileStorePath(), "utf8");
    return JSON.parse(raw) as Record<string, PersonEnrichment>;
  } catch {
    return {};
  }
}

async function writeFileStore(store: Record<string, PersonEnrichment>) {
  const file = fileStorePath();
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(store, null, 2), "utf8");
}

function normalizeUsername(value: string | null | undefined) {
  const trimmed = value?.trim().replace(/^@/, "") ?? "";
  return trimmed || null;
}

function normalizeEmail(value: string | null | undefined) {
  const trimmed = value?.trim().toLowerCase() ?? "";
  return trimmed || null;
}

function normalizePhone(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

function normalizeWallets(value: unknown): string[] {
  if (Array.isArray(value)) {
    return [
      ...new Set(
        value
          .map((row) => String(row).trim().toLowerCase())
          .filter((row) => row.length >= 8 && row.length <= 128),
      ),
    ].slice(0, 20);
  }
  if (typeof value === "string") {
    return normalizeWallets(
      value
        .split(/[\n,]+/)
        .map((row) => row.trim())
        .filter(Boolean),
    );
  }
  return [];
}

const MAX_PHOTOS = 6;
/** ~350KB base64 keeps KV rows sane for face reference shots. */
const MAX_DATA_URL_CHARS = 480_000;

function normalizePhotoUrls(value: unknown): string[] {
  const raw = Array.isArray(value)
    ? value.map((row) => String(row).trim())
    : typeof value === "string"
      ? value
          .split(/[\n,]+/)
          .map((row) => row.trim())
          .filter(Boolean)
      : [];

  const out: string[] = [];
  for (const item of raw) {
    if (!item) continue;
    if (/^https:\/\//i.test(item) && item.length <= 2_000) {
      out.push(item);
      continue;
    }
    if (
      /^data:image\/(jpeg|jpg|png|webp|gif);base64,/i.test(item) &&
      item.length <= MAX_DATA_URL_CHARS
    ) {
      out.push(item);
    }
  }
  return [...new Set(out)].slice(0, MAX_PHOTOS);
}

function hydrateEnrichment(row: PersonEnrichment): PersonEnrichment {
  return {
    ...row,
    photoUrls: Array.isArray(row.photoUrls) ? row.photoUrls : [],
  };
}

function emptyEnrichment(
  kind: PersonKind,
  entityId: string,
  updatedBy: string,
): PersonEnrichment {
  const now = new Date().toISOString();
  const id = personEnrichmentId(kind, entityId);
  return {
    id,
    kind,
    memberId: kind === "member" ? entityId : null,
    visitorId: kind === "visitor" ? entityId : null,
    name: null,
    email: null,
    phone: null,
    telegramUsername: null,
    discordUsername: null,
    xUsername: null,
    instagramUsername: null,
    pfpUrl: null,
    photoUrls: [],
    paymentMethods: null,
    wallets: [],
    note: null,
    linkedMemberId: null,
    linkedVisitorId: null,
    createdAt: now,
    updatedAt: now,
    updatedBy,
  };
}

async function putEnrichment(record: PersonEnrichment) {
  const kv = await getKv();
  if (kv) {
    await kv.put(recordKey(record.id), JSON.stringify(record));
    const index =
      (await kv.get<{ ids: string[] }>(INDEX_KEY, "json")) ?? { ids: [] };
    const ids = [
      record.id,
      ...index.ids.filter((id) => id !== record.id),
    ].slice(0, INDEX_CAP);
    await kv.put(INDEX_KEY, JSON.stringify({ ids }));
    return;
  }

  const store = await readFileStore();
  store[record.id] = record;
  await writeFileStore(store);
}

/** Bulk write enrichments with a single index update (keeps Workers subrequests low). */
export async function putPersonEnrichmentsBulk(
  records: PersonEnrichment[],
): Promise<void> {
  if (records.length === 0) return;
  const kv = await getKv();
  if (kv) {
    await Promise.all(
      records.map((record) =>
        kv.put(recordKey(record.id), JSON.stringify(record)),
      ),
    );
    const index =
      (await kv.get<{ ids: string[] }>(INDEX_KEY, "json")) ?? { ids: [] };
    const nextIds = [
      ...records.map((row) => row.id),
      ...index.ids.filter((id) => !records.some((row) => row.id === id)),
    ].slice(0, INDEX_CAP);
    await kv.put(INDEX_KEY, JSON.stringify({ ids: nextIds }));
    return;
  }

  const store = await readFileStore();
  for (const record of records) store[record.id] = record;
  await writeFileStore(store);
}

export async function getPersonEnrichment(
  id: string,
): Promise<PersonEnrichment | null> {
  const safeId = id.trim();
  if (!safeId.startsWith("pe_")) return null;
  const kv = await getKv();
  if (kv) {
    const row = await kv.get<PersonEnrichment>(recordKey(safeId), "json");
    return row ? hydrateEnrichment(row) : null;
  }
  const store = await readFileStore();
  const row = store[safeId];
  return row ? hydrateEnrichment(row) : null;
}

export async function getPersonEnrichmentForEntity(
  kind: PersonKind,
  entityId: string,
): Promise<PersonEnrichment | null> {
  return getPersonEnrichment(personEnrichmentId(kind, entityId));
}

export async function listPersonEnrichments(
  limit = 300,
): Promise<PersonEnrichment[]> {
  const kv = await getKv();
  if (kv) {
    const index =
      (await kv.get<{ ids: string[] }>(INDEX_KEY, "json")) ?? { ids: [] };
    const rows: PersonEnrichment[] = [];
    for (const id of index.ids.slice(0, limit)) {
      const row = await getPersonEnrichment(id);
      if (row) rows.push(row);
    }
    return rows;
  }

  const store = await readFileStore();
  return Object.values(store)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit);
}

export async function upsertPersonEnrichment(input: {
  kind: PersonKind;
  entityId: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  telegramUsername?: string | null;
  discordUsername?: string | null;
  xUsername?: string | null;
  instagramUsername?: string | null;
  pfpUrl?: string | null;
  photoUrls?: string[] | string | null;
  paymentMethods?: string | null;
  wallets?: string[] | string | null;
  note?: string | null;
  linkedMemberId?: string | null;
  linkedVisitorId?: string | null;
  updatedBy: string;
}): Promise<PersonEnrichment> {
  const entityId = input.entityId.trim();
  if (!entityId) throw new Error("Missing person id.");

  const existing =
    (await getPersonEnrichmentForEntity(input.kind, entityId)) ??
    emptyEnrichment(input.kind, entityId, input.updatedBy);

  // pfpUrl stores an optional avatar.vercel.sh seed (not a remote image URL).
  const pfpUrl = input.pfpUrl?.trim() || null;
  if (pfpUrl && /^https?:\/\//i.test(pfpUrl)) {
    throw new Error(
      "Use an avatar.vercel.sh seed (name/email/id), not an image URL. Put face photos in Photos.",
    );
  }

  const next: PersonEnrichment = {
    ...existing,
    name: input.name !== undefined ? input.name?.trim() || null : existing.name,
    email:
      input.email !== undefined
        ? normalizeEmail(input.email)
        : existing.email,
    phone:
      input.phone !== undefined
        ? normalizePhone(input.phone)
        : existing.phone,
    telegramUsername:
      input.telegramUsername !== undefined
        ? normalizeUsername(input.telegramUsername)
        : existing.telegramUsername,
    discordUsername:
      input.discordUsername !== undefined
        ? normalizeUsername(input.discordUsername)
        : existing.discordUsername,
    xUsername:
      input.xUsername !== undefined
        ? normalizeUsername(input.xUsername)
        : existing.xUsername,
    instagramUsername:
      input.instagramUsername !== undefined
        ? normalizeUsername(input.instagramUsername)
        : existing.instagramUsername,
    pfpUrl: input.pfpUrl !== undefined ? pfpUrl : existing.pfpUrl,
    photoUrls:
      input.photoUrls !== undefined
        ? normalizePhotoUrls(input.photoUrls)
        : existing.photoUrls ?? [],
    paymentMethods:
      input.paymentMethods !== undefined
        ? input.paymentMethods?.trim() || null
        : existing.paymentMethods,
    wallets:
      input.wallets !== undefined
        ? normalizeWallets(input.wallets)
        : existing.wallets,
    note:
      input.note !== undefined ? input.note?.trim() || null : existing.note,
    linkedMemberId:
      input.linkedMemberId !== undefined
        ? input.linkedMemberId?.trim() || null
        : existing.linkedMemberId,
    linkedVisitorId:
      input.linkedVisitorId !== undefined
        ? input.linkedVisitorId?.trim() || null
        : existing.linkedVisitorId,
    updatedAt: new Date().toISOString(),
    updatedBy: input.updatedBy,
  };

  await putEnrichment(next);
  return next;
}
