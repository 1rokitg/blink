import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

const WHITELIST_KEY = "telegram:paid-whitelist";

export type PaidTelegramMember = {
  /** Lowercase username without @ */
  username: string;
  telegramUserId: string | null;
  subscriptionId: string | null;
  customerId: string | null;
  email: string | null;
  claimId: string | null;
  source: string | null;
  status: "active" | "inactive";
  updatedAt: string;
};

export type PaidTelegramWhitelist = {
  updatedAt: string;
  entries: PaidTelegramMember[];
};

async function getKv(): Promise<KVNamespace | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return (env as CloudflareEnv | undefined)?.CRYPTO_PAYMENTS ?? null;
  } catch {
    return null;
  }
}

function normalizeUsername(value: string | null | undefined) {
  const trimmed = value?.trim().replace(/^@/, "").toLowerCase() ?? "";
  return trimmed || null;
}

export async function getPaidTelegramWhitelist(): Promise<PaidTelegramWhitelist> {
  const kv = await getKv();
  if (!kv) {
    return { updatedAt: new Date(0).toISOString(), entries: [] };
  }
  try {
    const raw = await kv.get(WHITELIST_KEY);
    if (!raw) return { updatedAt: new Date(0).toISOString(), entries: [] };
    const parsed = JSON.parse(raw) as PaidTelegramWhitelist;
    return {
      updatedAt: parsed.updatedAt || new Date(0).toISOString(),
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
    };
  } catch {
    return { updatedAt: new Date(0).toISOString(), entries: [] };
  }
}

async function putWhitelist(next: PaidTelegramWhitelist) {
  const kv = await getKv();
  if (!kv) return;
  await kv.put(WHITELIST_KEY, JSON.stringify(next));
}

/**
 * Upsert a paying member onto the Telegram paid-members whitelist.
 * Circle Guard / access bots can read this KV key as source of truth.
 */
export async function upsertPaidTelegramMember(input: {
  username?: string | null;
  telegramUserId?: string | null;
  subscriptionId?: string | null;
  customerId?: string | null;
  email?: string | null;
  claimId?: string | null;
  source?: string | null;
  status?: "active" | "inactive";
}): Promise<PaidTelegramMember | null> {
  const username = normalizeUsername(input.username);
  const telegramUserId = input.telegramUserId?.trim() || null;
  if (!username && !telegramUserId) return null;

  const current = await getPaidTelegramWhitelist();
  const now = new Date().toISOString();
  const status = input.status ?? "active";

  const matchIndex = current.entries.findIndex((row) => {
    if (username && row.username === username) return true;
    if (
      telegramUserId &&
      row.telegramUserId &&
      row.telegramUserId === telegramUserId
    ) {
      return true;
    }
    if (
      input.subscriptionId &&
      row.subscriptionId &&
      row.subscriptionId === input.subscriptionId
    ) {
      return true;
    }
    return false;
  });

  const base: PaidTelegramMember =
    matchIndex >= 0
      ? current.entries[matchIndex]!
      : {
          username: username || `id:${telegramUserId}`,
          telegramUserId: null,
          subscriptionId: null,
          customerId: null,
          email: null,
          claimId: null,
          source: null,
          status: "active",
          updatedAt: now,
        };

  const nextEntry: PaidTelegramMember = {
    ...base,
    username: username || base.username,
    telegramUserId: telegramUserId || base.telegramUserId,
    subscriptionId: input.subscriptionId ?? base.subscriptionId,
    customerId: input.customerId ?? base.customerId,
    email: input.email?.trim().toLowerCase() || base.email,
    claimId: input.claimId ?? base.claimId,
    source: input.source ?? base.source,
    status,
    updatedAt: now,
  };

  const entries = [...current.entries];
  if (matchIndex >= 0) entries[matchIndex] = nextEntry;
  else entries.unshift(nextEntry);

  // Keep active members first, newest updates first.
  entries.sort((a, b) => {
    if (a.status !== b.status) return a.status === "active" ? -1 : 1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });

  await putWhitelist({
    updatedAt: now,
    entries: entries.slice(0, 5_000),
  });

  return nextEntry;
}

export async function deactivatePaidTelegramMember(input: {
  username?: string | null;
  telegramUserId?: string | null;
  subscriptionId?: string | null;
}) {
  return upsertPaidTelegramMember({
    ...input,
    status: "inactive",
  });
}

export function isUsernameOnPaidWhitelist(
  whitelist: PaidTelegramWhitelist,
  username: string | null | undefined,
) {
  const normalized = normalizeUsername(username);
  if (!normalized) return false;
  return whitelist.entries.some(
    (row) => row.status === "active" && row.username === normalized,
  );
}
