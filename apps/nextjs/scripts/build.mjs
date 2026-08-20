import { spawnSync } from "node:child_process";

import { ensureWranglerHyperdrive } from "./ensure-wrangler-hyperdrive.mjs";

const isWindows = process.platform === "win32";
const pnpm = isWindows ? "pnpm.cmd" : "pnpm";

/**
 * OpenNext runs `pnpm build` internally. When BLINK_OPENNEXT_BUILD=1 we must
 * only run `next build` or we recurse forever.
 */
/**
 * @param {string} command
 * @param {string[]} args
 * @param {NodeJS.ProcessEnv} env
 */
function run(command, args, env = process.env) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env,
    shell: isWindows,
  });
  if (result.error) {
    console.error(`Failed to run ${command}: ${result.error.message}`);
    process.exit(1);
  }
  process.exit(result.status ?? 1);
}

if (process.env.BLINK_OPENNEXT_BUILD === "1") {
  const buildDbStub = "postgresql://build:build@127.0.0.1:5432/blink_build";
  run(pnpm, ["exec", "next", "build"], {
    ...process.env,
    // Align with apps/nextjs env.ts default so t3 env and metadata routes skip DB at build.
    POSTGRES_URL: process.env.POSTGRES_URL ?? buildDbStub,
    // Hyperdrive local emulation (wrangler.toml binding HYPERDRIVE).
    CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE:
      process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE ??
      process.env.POSTGRES_URL ??
      buildDbStub,
  });
}

const isCloudflareCi =
  process.env.WORKERS_CI === "1" || process.env.CF_PAGES === "1";

if (isCloudflareCi) {
  run(pnpm, ["exec", "opennextjs-cloudflare", "build"], {
    ...process.env,
    BLINK_OPENNEXT_BUILD: "1",
  });
  // CI build cache can restore an old wrangler.toml; patch before deploy step runs.
  ensureWranglerHyperdrive();
}

run(pnpm, ["exec", "next", "build"]);