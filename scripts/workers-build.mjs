import { spawnSync } from "node:child_process";

/** Cloudflare Workers Builds sets WORKERS_CI=1; Pages sets CF_PAGES=1. */
const isCloudflareCi =
  process.env.WORKERS_CI === "1" || process.env.CF_PAGES === "1";

const args = isCloudflareCi
  ? ["run", "build:cloudflare"]
  : ["exec", "turbo", "run", "build"];

const result = spawnSync("pnpm", args, { stdio: "inherit" });
process.exit(result.status ?? 1);
