import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  CompGiftRecord,
  PublicCompGiftView,
} from "@/lib/comp-gifts-types";
import { addManualMember } from "@/lib/membership-admin.server";
import { getAppUrl } from "@/lib/stripe";

export type {
  CompGiftRecord,
  CompGiftStatus,
  PublicCompGiftView,
} from "@/lib/comp-gifts-types";

const GIFT_KEY_PREFIX = "gift:";
const GIFTS_INDEX_KEY = "gifts:recent";
const GIFTS_INDEX_CAP = 200;

function giftKey(id: string) {
  return `${GIFT_KEY_PREFIX}${id}`;
}

function fileStorePath() {
  return path.join(process.cwd(), ".data", "comp-gifts.json");
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

async function readFileStore(): Promise<Record<string, CompGiftRecord>> {
  try {
    const raw = await readFile(fileStorePath(), "utf8");
    return JSON.parse(raw) as Record<string, CompGiftRecord>;
  } catch {
    return {};
  }
}

async function writeFileStore(store: Record<string, CompGiftRecord>) {
  const file = fileStorePath();
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(store, null, 2), "utf8");
}

function newGiftId() {
  return `gf_${crypto.randomUUID().replaceAll("-", "")}`;
}

function normalizeUsername(value: string | undefined) {
  const trimmed = value?.trim().replace(/^@/, "") ?? "";
  return trimmed || null;
}

function normalizeEmail(value: string | undefined) {
  const trimmed = value?.trim().toLowerCase() ?? "";
  return trimmed || null;
}

function isExpired(record: CompGiftRecord, now = Date.now()) {
  if (!record.expiresAt) return false;
  return new Date(record.expiresAt).getTime() <= now;
}

export function publicGiftUrl(id: string) {
  return `${getAppUrl()}/gift/${id}`;
}

export function mailtoForGift(input: {
  email: string;
  giftUrl?: string | null;
  inviteLink?: string | null;
  label?: string | null;
}) {
  const subject = encodeURIComponent(
    input.label || "Your complimentary Circle membership",
  );
  const lines = [
    "Hey — you've been gifted 1 free month of The Circle.",
    "",
  ];
  if (input.inviteLink) {
    lines.push("Open your private Telegram invite:", input.inviteLink, "");
  }
  if (input.giftUrl) {
    lines.push("Claim it here:", input.giftUrl, "");
  }
  lines.push("See you inside,", "The Circle");
  const body = encodeURIComponent(lines.join("\n"));
  return `mailto:${encodeURIComponent(input.email)}?subject=${subject}&body=${body}`;
}

async function putGift(record: CompGiftRecord) {
  const kv = await getKv();
  if (kv) {
    await kv.put(giftKey(record.id), JSON.stringify(record));
    const index =
      (await kv.get<{ ids: string[] }>(GIFTS_INDEX_KEY, "json")) ?? {
        ids: [],
      };
    const ids = [record.id, ...index.ids.filter((id) => id !== record.id)].slice(
      0,
      GIFTS_INDEX_CAP,
    );
    await kv.put(GIFTS_INDEX_KEY, JSON.stringify({ ids }));
    return;
  }

  const store = await readFileStore();
  store[record.id] = record;
  await writeFileStore(store);
}

export async function getCompGift(id: string): Promise<CompGiftRecord | null> {
  const safeId = id.trim();
  if (!safeId.startsWith("gf_")) return null;

  const kv = await getKv();
  let record: CompGiftRecord | null = null;
  if (kv) {
    record = await kv.get<CompGiftRecord>(giftKey(safeId), "json");
  } else {
    const store = await readFileStore();
    record = store[safeId] ?? null;
  }

  if (!record) return null;

  if (
    record.status !== "redeemed" &&
    record.status !== "revoked" &&
    isExpired(record)
  ) {
    if (record.status !== "expired") {
      record = { ...record, status: "expired" };
      await putGift(record);
    }
  }

  return record;
}

export async function listCompGifts(limit = 50): Promise<CompGiftRecord[]> {
  const kv = await getKv();
  if (kv) {
    const index =
      (await kv.get<{ ids: string[] }>(GIFTS_INDEX_KEY, "json")) ?? {
        ids: [],
      };
    const rows: CompGiftRecord[] = [];
    for (const id of index.ids.slice(0, limit)) {
      const row = await getCompGift(id);
      if (row) rows.push(row);
    }
    return rows;
  }

  const store = await readFileStore();
  return Object.values(store)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export async function createCompGiftLink(input: {
  email?: string;
  telegramUsername?: string;
  note?: string;
  label?: string;
  expiresInDays?: number;
  createdBy: string;
}): Promise<CompGiftRecord> {
  const now = new Date();
  const expiresInDays = Math.max(1, Math.min(90, input.expiresInDays ?? 14));
  const expiresAt = new Date(now);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + expiresInDays);

  const record: CompGiftRecord = {
    id: newGiftId(),
    planId: "month",
    email: normalizeEmail(input.email),
    telegramUsername: normalizeUsername(input.telegramUsername),
    note: input.note?.trim().slice(0, 280) || null,
    label: input.label?.trim().slice(0, 120) || "Complimentary month",
    status: "pending",
    inviteLink: null,
    subscriptionId: null,
    createdAt: now.toISOString(),
    createdBy: input.createdBy.slice(0, 64),
    expiresAt: expiresAt.toISOString(),
    redeemedAt: null,
  };

  await putGift(record);
  return record;
}

export async function revokeCompGift(id: string): Promise<CompGiftRecord> {
  const record = await getCompGift(id);
  if (!record) throw new Error("Gift link not found.");
  if (record.status === "redeemed") {
    throw new Error("Redeemed gifts cannot be revoked.");
  }
  const next: CompGiftRecord = { ...record, status: "revoked" };
  await putGift(next);
  return next;
}

/** Instant complimentary month + Telegram invite (existing Stripe trial grant). */
export async function grantCompMonth(input: {
  telegramUsername: string;
  telegramUserId?: string;
  email?: string;
  note?: string;
  createdBy: string;
}) {
  const result = await addManualMember({
    planId: "month",
    telegramUsername: input.telegramUsername,
    telegramUserId: input.telegramUserId,
    email: input.email,
    note: input.note
      ? `comp · ${input.note}`
      : `comp gift by ${input.createdBy}`,
  });

  return result;
}

export async function redeemCompGift(input: {
  giftId: string;
  telegramUsername: string;
  email?: string;
}) {
  const record = await getCompGift(input.giftId);
  if (!record) throw new Error("This gift link is invalid.");
  if (record.status === "revoked") {
    throw new Error("This gift link was revoked.");
  }
  if (record.status === "expired" || isExpired(record)) {
    throw new Error("This gift link has expired.");
  }
  if (record.status === "redeemed") {
    throw new Error("This gift was already claimed.");
  }

  const telegramUsername =
    normalizeUsername(input.telegramUsername) || record.telegramUsername;
  if (!telegramUsername) {
    throw new Error("Telegram username is required.");
  }

  const email = normalizeEmail(input.email) || record.email;
  const result = await addManualMember({
    planId: "month",
    telegramUsername,
    email: email || undefined,
    note: record.note
      ? `comp link · ${record.note}`
      : `comp link ${record.id}`,
  });

  const redeemed: CompGiftRecord = {
    ...record,
    status: "redeemed",
    email,
    telegramUsername,
    inviteLink: result.inviteLink,
    subscriptionId: result.member.id,
    redeemedAt: new Date().toISOString(),
  };
  await putGift(redeemed);

  return { gift: redeemed, ...result };
}

export function toPublicCompGiftView(
  record: CompGiftRecord,
): PublicCompGiftView {
  return {
    id: record.id,
    label: record.label,
    note: record.note,
    email: record.email,
    telegramUsername: record.telegramUsername,
    status: record.status,
    expiresAt: record.expiresAt,
    usable: record.status === "pending" && !isExpired(record),
  };
}
