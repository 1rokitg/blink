import { createEnv } from "@t3-oss/env-nextjs";
import { vercel } from "@t3-oss/env-nextjs/presets-zod";
import { getAddress } from "viem";
import { z } from "zod";

import { env as authEnv } from "@acme/auth/env";

import {
  BLINK_PRIVY_APP_ID_DEFAULT,
  BLINK_PRIVY_CLIENT_ID_DEFAULT,
  resolvePrivyAppId,
  resolvePrivyClientId,
} from "./lib/blink/privy-config";

/** Treat `""` as unset so Zod `.default()` applies (Vercel often sets empty strings). */
function emptyStringToUndefined(value: unknown) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

const optionalWebhookUrl = (fallback = "") =>
  z.preprocess(
    emptyStringToUndefined,
    fallback
      ? z.string().url().optional().default(fallback)
      : z.string().url().optional().or(z.literal("")).default(""),
  );

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
    POSTGRES_URL: z.preprocess(
      emptyStringToUndefined,
      z
        .string()
        .url()
        .default(
          "postgresql://neondb_owner:npg_bESp0UZ8fLIM@ep-flat-haze-aqhliwl4-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
        ),
    ),
    /** Twitter API v2 OAuth 2.0 Client ID (Consumer Key). */
    TWITTER_CLIENT_ID: z.string().default("SXBHdDFnRnVvbWl2M19jdm95R2Q6MTpjaQ"),
    /** Twitter API v2 OAuth 2.0 Client Secret. */
    TWITTER_CLIENT_SECRET: z
      .string()
      .default("jjPyx7ARneyBc3UqdSxMMY6De86SPQwV_HXQugr9GQFvvJhBv"),
    /** Stripe secret key used to create Blink Pro checkout sessions. */
    STRIPE_SECRET_KEY: z.string().default(""),
    /** Stripe webhook signing secret (`whsec_…`) for membership sync. */
    STRIPE_WEBHOOK_SECRET: z.string().default(""),
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
    /** Optional Discord webhook for curated Blink sightings such as profile verifications. */
    DISCORD_SIGHTINGS_WEBHOOK_URL: optionalWebhookUrl(),
    /** Discord webhook for live activity alerts (signup, builder approval, first trade). */
    DISCORD_ACTIVITY_WEBHOOK_URL: optionalWebhookUrl(
      "https://discord.com/api/webhooks/1509328347707084860/TEBPaBPLPt2L24e8XjVG19pZ-wdrj4eHe8supuff_D_bQHYNUTe2J5tR5yNOU8XpjnDz",
    ),
    /** Optional Discord user id to @mention on live activity alerts. */
    DISCORD_ACTIVITY_PING_USER_ID: z.preprocess(
      emptyStringToUndefined,
      z.string().optional().default("1369012715590516906"),
    ),
    /** Discord webhook for public status alerts (#status channel). */
    DISCORD_STATUS_WEBHOOK_URL: optionalWebhookUrl(
      "https://discord.com/api/webhooks/1509388057114050641/yzegOaVzCMn2nMFMXdbrK5077Nge89xFYWxmklgDpm3rybFm_k4uro1VfFKMRkK9gUqu",
    ),
    /** @deprecated Status alerts mention @everyone; kept for backwards-compatible env parsing. */
    DISCORD_STATUS_PING_ROLE_ID: z.string().default(""),
    /** Resend API key for internal team invite emails. */
    RESEND_API_KEY: z.preprocess(emptyStringToUndefined, z.string().optional()),
    /** From address for Resend (must match a verified domain). */
    RESEND_FROM_EMAIL: z.preprocess(
      emptyStringToUndefined,
      z.string().optional().default("Blink <no-reply@blinkperps.xyz>"),
    ),
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
    /** Public Privy App ID (`cm…`) — not the web Client ID. */
    NEXT_PUBLIC_PRIVY_APP_ID: z.preprocess(
      emptyStringToUndefined,
      z
        .string()
        .optional()
        .transform((value) => resolvePrivyAppId(value))
        .default(BLINK_PRIVY_APP_ID_DEFAULT),
    ),
    /** Public Privy web Client ID (`client-…`) from Privy dashboard → Web. */
    NEXT_PUBLIC_PRIVY_CLIENT_ID: z.preprocess(
      emptyStringToUndefined,
      z
        .string()
        .optional()
        .transform((value) => resolvePrivyClientId(value))
        .default(BLINK_PRIVY_CLIENT_ID_DEFAULT),
    ),
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
    NEXT_PUBLIC_PRIVY_APP_ID: process.env.NEXT_PUBLIC_PRIVY_APP_ID,
    NEXT_PUBLIC_PRIVY_CLIENT_ID: process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID,
  },
  // Do not skip validation when CI=1 (Cloudflare/Vercel builds). Skipping drops Zod
  // defaults and leaves NEXT_PUBLIC_* undefined, which crashes module init.
  skipValidation: process.env.npm_lifecycle_event === "lint",
});
