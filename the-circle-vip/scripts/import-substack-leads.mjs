#!/usr/bin/env node
/**
 * Import Substack subscriber export into CRYPTO_PAYMENTS KV as CRM leads.
 *
 * Usage:
 *   node scripts/import-substack-leads.mjs
 *   node scripts/import-substack-leads.mjs --dry-run
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
  await readFile(path.join(root, "data/substack/leads.json"), "utf8"),
);
const leads = seed.leads ?? [];
console.log(
  `Substack seed: ${leads.length} subscribers (paid=${seed.paid} free=${seed.free} revenue=${seed.totalRevenue ?? "?"} ${seed.currency ?? ""}) from ${seed.publication}`,
);

function toLeadRecord(row) {
  return {
    id: row.id,
    email: row.email,
    telegramUsername: row.telegramUsername,
    name: row.name,
    source: "substack",
    channel: row.channel || "substack",
    utmSource: row.utmSource || "substack",
    utmMedium: row.utmMedium || "newsletter",
    utmCampaign: row.utmCampaign || "rokitgs_circle",
    referrer: row.referrer ?? null,
    note: row.note,
    status: row.status || "new",
    createdAt: row.createdAt,
    createdBy: row.createdBy || "import:substack",
    updatedAt: new Date().toISOString(),
    meta: row.meta ?? null,
  };
}

const records = leads.map(toLeadRecord);
if (dryRun) {
  console.log("Dry run sample:", records.slice(0, 2));
  process.exit(0);
}

async function kvGet(key) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${NS}/values/${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`KV get ${key}: ${res.status}`);
  return res.json();
}

async function kvBulkPut(entries) {
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
    throw new Error(`KV bulk put failed: ${res.status} ${JSON.stringify(body)}`);
  }
}

const index = (await kvGet(INDEX_KEY)) ?? { ids: [] };
const existingIds = Array.isArray(index.ids) ? index.ids : [];
const nextIds = [
  ...records.map((r) => r.id),
  ...existingIds.filter((id) => !records.some((r) => r.id === id)),
].slice(0, INDEX_CAP);

await kvBulkPut([
  ...records.map((r) => ({ key: `lead:${r.id}`, value: r })),
  { key: INDEX_KEY, value: { ids: nextIds } },
]);

console.log(
  `Imported ${records.length} Substack leads (index now ${nextIds.length}). Tagged source=substack · channel=substack.`,
);
