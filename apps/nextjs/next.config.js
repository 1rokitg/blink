import { fileURLToPath } from "node:url";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import createJiti from "jiti";
import { withBotId } from "botid/next/config";

// Import env files to validate at build time. Use jiti so we can load .ts files in here.
createJiti(fileURLToPath(import.meta.url))("./src/env");

/** @type {import("next").NextConfig} */
const config = {
  /** Expose git commit SHA to the client for version display + deploy detection */
  env: {
    NEXT_PUBLIC_COMMIT_SHA: (
      process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_SHA ?? "dev"
    ).slice(0, 7),
  },

  /** Enables hot reloading for local packages without a build step */
  transpilePackages: [
    "@acme/api",
    "@acme/auth",
    "@acme/db",
    "@acme/ui",
    "@acme/validators",
  ],

  /** We already do linting and typechecking as separate tasks in CI */
  typescript: { ignoreBuildErrors: true },
};

export default withBotId(config);

initOpenNextCloudflareForDev();
