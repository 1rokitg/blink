import { createEnv } from "@t3-oss/env-nextjs";
import { vercel } from "@t3-oss/env-nextjs/presets-zod";
import { getAddress } from "viem";
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
    /** Twitter API v2 OAuth 2.0 Client ID (Consumer Key). */
    TWITTER_CLIENT_ID: z.string().default(""),
    /** Twitter API v2 OAuth 2.0 Client Secret. */
    TWITTER_CLIENT_SECRET: z.string().default(""),
    /** Stripe secret key used to create Blink Pro checkout sessions. */
    STRIPE_SECRET_KEY: z.string().default(""),
    /** Blink Pro reduced builder fee in HL units (1 unit = 0.001%). e.g. 7 = 0.007%. */
    BLINK_PRO_BUILDER_FEE_BPS: z.coerce.number().int().min(0).default(7),
    /** Optional comma-separated wallet allowlist for Pro fee while webhooks are rolling out. */
    BLINK_PRO_WALLET_ALLOWLIST: z.string().default(""),
    /** Extra Pro discount (%) applied during growth campaigns. e.g. 20 = additional 20% off. */
    BLINK_GROWTH_PRO_DISCOUNT_PCT: z.coerce.number().min(0).max(90).default(20),
    /** Referral reward multiplier during growth campaigns. e.g. 2 = 2x rewards messaging. */
    BLINK_GROWTH_REFERRAL_MULTIPLIER: z.coerce
      .number()
      .min(1)
      .max(10)
      .default(2),
  },

  /**
   * Specify your client-side environment variables schema here.
   * For them to be exposed to the client, prefix them with `NEXT_PUBLIC_`.
   */
  client: {
    /** Hyperliquid builder wallet address (0x…). Resolves rokitg.eth. */
    NEXT_PUBLIC_BUILDER_ADDRESS: z
      .string()
      .regex(/^0x[0-9a-fA-F]{40}$/, "Must be a valid EVM address")
      .default("0xc7BcB2EeE9BbFbf875499960746Bc52B2E1A75C6")
      .transform((addr) => getAddress(addr)),
    /** Builder fee in HL units (1 unit = 0.1bps = 0.001%). 10 = 0.01%, 100 = 0.1% (max). */
    NEXT_PUBLIC_BUILDER_FEE_BPS: z.coerce.number().int().min(0).default(10),
    /** Canonical app URL used to form OAuth redirect URIs. */
    NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
    /** Growth campaign mode toggle. When enabled, activates growth-specific perks. */
    NEXT_PUBLIC_GROWTH_MODE: z.enum(["0", "1"]).default("0"),
  },
  /**
   * Destructure all variables from `process.env` to make sure they aren't tree-shaken away.
   */
  experimental__runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_BUILDER_ADDRESS: process.env.NEXT_PUBLIC_BUILDER_ADDRESS,
    NEXT_PUBLIC_BUILDER_FEE_BPS: process.env.NEXT_PUBLIC_BUILDER_FEE_BPS,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_GROWTH_MODE: process.env.NEXT_PUBLIC_GROWTH_MODE,
  },
  skipValidation:
    !!process.env.CI || process.env.npm_lifecycle_event === "lint",
});
