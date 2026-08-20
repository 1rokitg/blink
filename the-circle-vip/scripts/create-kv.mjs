/**
 * Create / refresh the CRYPTO_PAYMENTS KV namespace and patch wrangler.jsonc.
 * Requires `wrangler login` (or CLOUDFLARE_API_TOKEN).
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const wranglerPath = path.join(root, "wrangler.jsonc");

function run(cmd) {
  return execSync(cmd, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function extractId(output) {
  const match = output.match(/([a-f0-9]{32})/i);
  if (!match) {
    throw new Error(`Could not parse KV id from:\n${output}`);
  }
  return match[1];
}

console.log("Creating CRYPTO_PAYMENTS KV namespaces…");
const prodOut = run("pnpm exec wrangler kv namespace create CRYPTO_PAYMENTS");
const previewOut = run(
  "pnpm exec wrangler kv namespace create CRYPTO_PAYMENTS --preview",
);

const id = extractId(prodOut);
const previewId = extractId(previewOut);

let raw = readFileSync(wranglerPath, "utf8");
raw = raw.replace(
  /("binding"\s*:\s*"CRYPTO_PAYMENTS"[\s\S]*?"id"\s*:\s*")[^"]+(")/,
  `$1${id}$2`,
);
raw = raw.replace(
  /("binding"\s*:\s*"CRYPTO_PAYMENTS"[\s\S]*?"preview_id"\s*:\s*")[^"]+(")/,
  `$1${previewId}$2`,
);

writeFileSync(wranglerPath, raw);
console.log("Updated wrangler.jsonc");
console.log(`  id:         ${id}`);
console.log(`  preview_id: ${previewId}`);
