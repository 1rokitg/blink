import { spawnSync } from "node:child_process";

/**
 * OpenNext runs `pnpm build` internally. When BLINK_OPENNEXT_BUILD=1 we must
 * only run `next build` or we recurse forever.
 */
function run(command, args, env = process.env) {
  const result = spawnSync(command, args, { stdio: "inherit", env });
  process.exit(result.status ?? 1);
}

if (process.env.BLINK_OPENNEXT_BUILD === "1") {
  run("pnpm", ["exec", "next", "build"], {
    ...process.env,
    // Align with apps/nextjs env.ts default so t3 env + OG routes skip DB at build.
    POSTGRES_URL:
      process.env.POSTGRES_URL ??
      "postgresql://build:build@127.0.0.1:5432/blink_build",
  });
}

const isCloudflareCi =
  process.env.WORKERS_CI === "1" || process.env.CF_PAGES === "1";

if (isCloudflareCi) {
  run("pnpm", ["exec", "opennextjs-cloudflare", "build"], {
    ...process.env,
    BLINK_OPENNEXT_BUILD: "1",
  });
}

run("pnpm", ["exec", "next", "build"]);
