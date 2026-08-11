import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { getCloudflareContext } from "@opennextjs/cloudflare";

import {
  fetchProprReferralSummaryFromApi,
  readBearerExpiryMs,
} from "@/lib/propr-referrals-api.server";
import bundled from "@/lib/propr-referrals-seed.json";
import type { ProprReferralSummary } from "@/lib/propr-referrals-types";

const SUMMARY_KEY = "propr:referrals:summary";
const TOKEN_KEY = "propr:referrals:bearer";
/** Re-hit Propr when cached live summary is older than this. */
const STALE_MS = 15 * 60 * 1000;

export type ProprReferralSyncStatus = {
  hasToken: boolean;
  tokenExpiresAt: string | null;
  tokenSource: "env" | "kv" | null;
  summarySource: ProprReferralSummary["liveSource"] | "none";
  liveSyncedAt: string | null;
  summary: ProprReferralSummary | null;
};

async function getKv(): Promise<KVNamespace | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return (env as CloudflareEnv | undefined)?.CRYPTO_PAYMENTS ?? null;
  } catch {
    return null;
  }
}

function envBearerToken(): string {
  return (
    process.env.PROPR_BEARER_TOKEN?.trim() ||
    process.env.PROPR_API_TOKEN?.trim() ||
    ""
  );
}

async function readKvSummary(): Promise<ProprReferralSummary | null> {
  const kv = await getKv();
  if (!kv) return null;
  try {
    const raw = await kv.get(SUMMARY_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ProprReferralSummary;
  } catch {
    return null;
  }
}

async function writeKvSummary(summary: ProprReferralSummary) {
  const kv = await getKv();
  if (!kv) return;
  await kv.put(SUMMARY_KEY, JSON.stringify(summary));
}

async function readKvBearer(): Promise<{
  token: string;
  expiresAt: string | null;
} | null> {
  const kv = await getKv();
  if (!kv) return null;
  try {
    const raw = await kv.get(TOKEN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      token?: string;
      expiresAt?: string | null;
    };
    if (!parsed.token?.trim()) return null;
    if (parsed.expiresAt && Date.parse(parsed.expiresAt) <= Date.now()) {
      await kv.delete(TOKEN_KEY);
      return null;
    }
    return {
      token: parsed.token.trim(),
      expiresAt: parsed.expiresAt ?? null,
    };
  } catch {
    return null;
  }
}

async function writeKvBearer(token: string, expiresAtMs: number | null) {
  const kv = await getKv();
  if (!kv) return;
  const expiresAt =
    expiresAtMs != null ? new Date(expiresAtMs).toISOString() : null;
  const ttlSeconds =
    expiresAtMs != null
      ? Math.max(60, Math.floor((expiresAtMs - Date.now()) / 1000))
      : 30 * 60;
  await kv.put(
    TOKEN_KEY,
    JSON.stringify({
      token: token.trim().replace(/^Bearer\s+/i, ""),
      expiresAt,
      savedAt: new Date().toISOString(),
    }),
    { expirationTtl: ttlSeconds },
  );
}

async function resolveBearer(): Promise<{
  token: string;
  source: "env" | "kv";
  expiresAt: string | null;
} | null> {
  const fromEnv = envBearerToken();
  if (fromEnv) {
    const exp = readBearerExpiryMs(fromEnv);
    return {
      token: fromEnv,
      source: "env",
      expiresAt: exp ? new Date(exp).toISOString() : null,
    };
  }
  const fromKv = await readKvBearer();
  if (fromKv) {
    return {
      token: fromKv.token,
      source: "kv",
      expiresAt: fromKv.expiresAt,
    };
  }
  return null;
}

async function readFromDisk(): Promise<ProprReferralSummary | null> {
  const candidates = [
    path.join(process.cwd(), "data/propr/referrals-summary.json"),
    path.join(process.cwd(), "the-circle-vip/data/propr/referrals-summary.json"),
  ];
  for (const file of candidates) {
    try {
      const raw = await readFile(file, "utf8");
      const parsed = JSON.parse(raw) as ProprReferralSummary;
      return {
        ...parsed,
        liveSource: parsed.liveSource ?? "disk",
      };
    } catch {
      // try next
    }
  }
  return null;
}

function seedSummary(): ProprReferralSummary | null {
  const parsed = bundled as ProprReferralSummary;
  if (!parsed) return null;
  return {
    ...parsed,
    liveSource: parsed.liveSource ?? "csv_seed",
  };
}

function isStale(summary: ProprReferralSummary | null): boolean {
  if (!summary?.liveSyncedAt) return true;
  const synced = Date.parse(summary.liveSyncedAt);
  if (!Number.isFinite(synced)) return true;
  return Date.now() - synced > STALE_MS;
}

/**
 * Sync Propr referral stats from the live partner API into KV.
 * Session JWTs expire ~30m — pass a fresh Bearer token (optionally persist to KV).
 */
export async function syncProprReferrals(options?: {
  token?: string;
  persistToken?: boolean;
}): Promise<{
  summary: ProprReferralSummary;
  tokenPersisted: boolean;
  tokenExpiresAt: string | null;
}> {
  const previous = (await readKvSummary()) ?? seedSummary();
  const provided = options?.token?.trim() || "";
  const resolved = provided
    ? {
        token: provided,
        expiresAtMs: readBearerExpiryMs(provided),
      }
    : await (async () => {
        const auth = await resolveBearer();
        if (!auth) return null;
        return {
          token: auth.token,
          expiresAtMs: auth.expiresAt
            ? Date.parse(auth.expiresAt)
            : readBearerExpiryMs(auth.token),
        };
      })();

  if (!resolved?.token) {
    throw new Error(
      "No Propr Bearer token. Paste a session token from app.propr.xyz (Authorization header) or set PROPR_BEARER_TOKEN.",
    );
  }

  const summary = await fetchProprReferralSummaryFromApi(
    resolved.token,
    previous,
  );
  await writeKvSummary(summary);

  let tokenPersisted = false;
  const persist = options?.persistToken !== false && Boolean(provided);
  if (persist) {
    await writeKvBearer(resolved.token, resolved.expiresAtMs);
    tokenPersisted = true;
  }

  return {
    summary,
    tokenPersisted,
    tokenExpiresAt: resolved.expiresAtMs
      ? new Date(resolved.expiresAtMs).toISOString()
      : null,
  };
}

export async function getProprReferralSyncStatus(): Promise<ProprReferralSyncStatus> {
  const auth = await resolveBearer();
  const summary = await getProprReferralSummary({ allowLiveRefresh: false });
  return {
    hasToken: Boolean(auth),
    tokenExpiresAt: auth?.expiresAt ?? null,
    tokenSource: auth?.source ?? null,
    summarySource: summary?.liveSource ?? "none",
    liveSyncedAt: summary?.liveSyncedAt ?? null,
    summary,
  };
}

/**
 * Prefer KV (live sync) → auto-refresh when token available & stale →
 * disk CSV → bundled seed.
 */
export async function getProprReferralSummary(options?: {
  allowLiveRefresh?: boolean;
}): Promise<ProprReferralSummary | null> {
  const allowLiveRefresh = options?.allowLiveRefresh !== false;
  const cached = await readKvSummary();
  if (cached && (!allowLiveRefresh || !isStale(cached))) {
    return {
      ...cached,
      liveSource: cached.liveSource ?? "kv",
    };
  }

  if (allowLiveRefresh) {
    const auth = await resolveBearer();
    if (auth) {
      try {
        const summary = await fetchProprReferralSummaryFromApi(
          auth.token,
          cached ?? seedSummary(),
        );
        await writeKvSummary(summary);
        return summary;
      } catch {
        // Fall through to last-known / seed when token is dead.
      }
    }
  }

  if (cached) {
    return {
      ...cached,
      liveSource: cached.liveSource ?? "kv",
    };
  }

  const fromDisk = await readFromDisk();
  if (fromDisk) return fromDisk;
  return seedSummary();
}
