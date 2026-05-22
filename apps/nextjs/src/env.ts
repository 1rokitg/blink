import { createEnv } from "@t3-oss/env-nextjs";
import { vercel } from "@t3-oss/env-nextjs/presets-zod";
import { z } from "zod";

import { env as authEnv } from "@acme/auth/env";

export const env = createEnv({
  extends: [authEnv, vercel()],
  shared: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },
  /**
   * Specify your server-side environment variables schema here.
   * This way you can ensure the app isn't built with invalid env vars.
   */
  server: {
    POSTGRES_URL: z.string().url(),
  },

  /**
   * Specify your client-side environment variables schema here.
   * For them to be exposed to the client, prefix them with `NEXT_PUBLIC_`.
   */
  client: {
    /** Hyperliquid builder wallet address (0x…). Resolves rokitg.eth. */
    NEXT_PUBLIC_BUILDER_ADDRESS: z
      .string()
      .regex(/^0x[0-9a-fA-F]{40}$/, "Must be a valid EVM address"),
    /** Builder fee in 0.1bps units. 100 = 0.01%. */
    NEXT_PUBLIC_BUILDER_FEE_BPS: z.coerce.number().int().min(0).default(100),
  },
  /**
   * Destructure all variables from `process.env` to make sure they aren't tree-shaken away.
   */
  experimental__runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_BUILDER_ADDRESS: process.env.NEXT_PUBLIC_BUILDER_ADDRESS,
    NEXT_PUBLIC_BUILDER_FEE_BPS: process.env.NEXT_PUBLIC_BUILDER_FEE_BPS,
  },
  skipValidation:
    !!process.env.CI || process.env.npm_lifecycle_event === "lint",
});
