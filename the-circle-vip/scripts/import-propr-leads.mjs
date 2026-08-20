#!/usr/bin/env node
/**
 * Import Propr referral-activity leads into CRYPTO_PAYMENTS KV.
 *
 * Usage (from the-circle-vip/):
 *   node scripts/import-propr-leads.mjs
 *   node scripts/import-propr-leads.mjs --dry-run
 *
 * Requires CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID in env or .cf-credentials.env
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dryRun = process.argv.includes("--dry-run");
const NS = "fb433ec501b248a6b2112d7d068d16c1";
const INDEX_KEY = "leads:recent";
const INDEX_CAP = 500;

async function loadCreds() {
  try {
    const raw = await readFile(path.join(root, ".cf-credentials.env"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
    }
  } catch {
    // optional
  }
}

await loadCreds();
const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
if (!token || !accountId) {
  console.error("Missing CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID");
  process.exit(1);
}

const seed = JSON.parse(
  await readFile(path.join(root, "data/propr/leads.json"), "utf8"),
);
const leads = seed.leads ?? [];
console.log(
  `Propr seed: ${leads.length} unique users from ${seed.eventRows} events (emailable=${seed.emailable})`,
);

function toLeadRecord(row) {
  return {
    id: row.id,
    email: row.email,
    telegramUsername: row.telegramUsername,
    name: row.name,
    source: row.source || "propr",
    channel: row.channel || "propr",
    utmSource: row.utmSource || "propr",
    utmMedium: row.utmMedium || "referral",
    utmCampaign: row.utmCampaign || "partner_propr",
    referrer: row.referrer ?? null,
    note: row.note,
    status: row.status || "new",
    createdAt: row.createdAt,
    createdBy: row.createdBy || "import:propr",
    updatedAt: new Date().toISOString(),
  };
}

const records = leads.map(toLeadRecord);

if (dryRun) {
  console.log("Dry run sample:", records.slice(0, 3));
  process.exit(0);
}

async function kvGet(key) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${NS}/values/${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`KV get ${key}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function kvBulkPut(entries) {
  // Cloudflare bulk write max 10_000; we have ~55
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${NS}/bulk`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      entries.map((e) => ({
        key: e.key,
        value: typeof e.value === "string" ? e.value : JSON.stringify(e.value),
      })),
    ),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.success) {
    throw new Error(
      `KV bulk put failed: ${res.status} ${JSON.stringify(body)}`,
    );
  }
}

const index = (await kvGet(INDEX_KEY)) ?? { ids: [] };
const existingIds = Array.isArray(index.ids) ? index.ids : [];
const nextIds = [
  ...records.map((r) => r.id),
  ...existingIds.filter((id) => !records.some((r) => r.id === id)),
].slice(0, INDEX_CAP);

const entries = [
  ...records.map((r) => ({ key: `lead:${r.id}`, value: r })),
  { key: INDEX_KEY, value: { ids: nextIds } },
];

await kvBulkPut(entries);
console.log(
  `Imported ${records.length} Propr leads into KV (index now ${nextIds.length} ids).`,
);
console.log(
  "Tagged source=propr · channel=propr. None have emails — enrich before Emails campaigns.",
);
