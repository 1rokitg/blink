import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PLACEHOLDER = "REPLACE_WITH_HYPERDRIVE_CONFIG_ID";
/** Production Neon Hyperdrive config (override via Cloudflare env HYPERDRIVE_CONFIG_ID). */
const DEFAULT_HYPERDRIVE_ID = "8a4f14782e3b4871bb83ea368b886abb";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(scriptDir, "..");
const repoRoot = path.join(appDir, "../..");

function resolveHyperdriveId() {
  const fromEnv = process.env.HYPERDRIVE_CONFIG_ID?.trim();
  if (fromEnv && fromEnv !== PLACEHOLDER) return fromEnv;
  return DEFAULT_HYPERDRIVE_ID;
}

function patchWranglerFile(wranglerPath, hyperdriveId) {
  if (!fs.existsSync(wranglerPath)) return false;

  const content = fs.readFileSync(wranglerPath, "utf8");
  if (!content.includes(PLACEHOLDER)) return false;

  fs.writeFileSync(
    wranglerPath,
    content.replaceAll(PLACEHOLDER, hyperdriveId),
  );
  console.log(`[wrangler] Patched Hyperdrive ID in ${wranglerPath}`);
  return true;
}

function assertValidHyperdriveId(wranglerPath) {
  const content = fs.readFileSync(wranglerPath, "utf8");
  const match = content.match(
    /\[\[hyperdrive\]\][\s\S]*?id\s*=\s*"([^"]+)"/,
  );
  const id = match?.[1];
  if (!id || id === PLACEHOLDER) {
    throw new Error(
      `Invalid Hyperdrive ID in ${wranglerPath}. Set HYPERDRIVE_CONFIG_ID in Cloudflare or commit the real UUID.`,
    );
  }
  if (!/^[0-9a-f]{32}$/i.test(id)) {
    throw new Error(`Hyperdrive ID must be a 32-char UUID, got: ${id}`);
  }
}

export function ensureWranglerHyperdrive() {
  const hyperdriveId = resolveHyperdriveId();
  const paths = [
    path.join(appDir, "wrangler.toml"),
    path.join(repoRoot, "wrangler.toml"),
  ];

  for (const wranglerPath of paths) {
    patchWranglerFile(wranglerPath, hyperdriveId);
    if (fs.existsSync(wranglerPath)) {
      assertValidHyperdriveId(wranglerPath);
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    ensureWranglerHyperdrive();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
