#!/usr/bin/env node
/**
 * Point apex rokitg.com at Doorfee via Cloudflare CNAME flattening.
 *
 * Requires CLOUDFLARE_API_TOKEN with Zone.DNS edit on rokitg.com.
 * Deploy the Worker WITHOUT the apex custom domain first (see wrangler.jsonc),
 * otherwise Cloudflare will refuse a conflicting record.
 *
 * Usage: node scripts/point-apex-to-doorfee.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const wrangler = readFileSync(join(root, "wrangler.jsonc"), "utf8");
const zoneId =
  process.env.CF_ZONE_ID?.trim() ||
  wrangler.match(/"CF_ZONE_ID":\s*"([^"]+)"/)?.[1];
const accountId =
  process.env.CLOUDFLARE_ACCOUNT_ID?.trim() ||
  process.env.CF_ACCOUNT_ID?.trim() ||
  wrangler.match(/"account_id":\s*"([^"]+)"/)?.[1];
const token = process.env.CLOUDFLARE_API_TOKEN?.trim();

const TARGET = "doorfee.io";
const APEX = "rokitg.com";

if (!token) {
  console.error("Set CLOUDFLARE_API_TOKEN (Zone.DNS edit on rokitg.com).");
  process.exit(1);
}
if (!zoneId) {
  console.error("Missing CF_ZONE_ID.");
  process.exit(1);
}

async function cf(path, init = {}) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const body = await res.json();
  if (!body.success) {
    const msg = JSON.stringify(body.errors || body, null, 2);
    throw new Error(`Cloudflare API ${path}: ${msg}`);
  }
  return body.result;
}

const records = await cf(
  `/zones/${zoneId}/dns_records?name=${encodeURIComponent(APEX)}&per_page=100`,
);

console.log(`Account ${accountId || "(n/a)"} · zone ${zoneId}`);
console.log(`Existing apex records (${records.length}):`);
for (const r of records) {
  console.log(`  ${r.type} ${r.name} → ${r.content} (${r.id}) proxied=${r.proxied}`);
}

const cname = records.find(
  (r) => r.type === "CNAME" && r.name === APEX && r.content === TARGET,
);
const conflicting = records.filter(
  (r) =>
    r.name === APEX &&
    !(r.type === "CNAME" && r.content === TARGET) &&
    (r.type === "A" || r.type === "AAAA" || r.type === "CNAME"),
);

for (const r of conflicting) {
  console.log(`Deleting conflicting ${r.type} ${r.name} → ${r.content}`);
  await cf(`/zones/${zoneId}/dns_records/${r.id}`, { method: "DELETE" });
}

if (cname) {
  if (!cname.proxied) {
    console.log("Updating existing CNAME to proxied…");
    await cf(`/zones/${zoneId}/dns_records/${cname.id}`, {
      method: "PATCH",
      body: JSON.stringify({ proxied: true }),
    });
  } else {
    console.log(`OK: CNAME ${APEX} → ${TARGET} already proxied.`);
  }
} else {
  console.log(`Creating CNAME ${APEX} → ${TARGET} (proxied)…`);
  await cf(`/zones/${zoneId}/dns_records`, {
    method: "POST",
    body: JSON.stringify({
      type: "CNAME",
      name: "@",
      content: TARGET,
      proxied: true,
      ttl: 1,
      comment: "Doorfee marketing landing (apex)",
    }),
  });
}

console.log("Done. Verify: curl -sI https://rokitg.com | head -20");
console.log("Doorfee page: https://doorfee.io/p/rokitg");
