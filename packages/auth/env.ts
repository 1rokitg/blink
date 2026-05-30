import { createEnv } from "@t3-oss/env-nextjs";
import { vercel } from "@t3-oss/env-nextjs/presets-zod";
import { z } from "zod";

/** Treat `""` as unset so Zod `.default()` applies (CI often sets empty strings). */
function emptyStringToUndefined(value: unknown) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export const env = createEnv({
  extends: [vercel()],
  server: {
    GITHUB_ID: z.string().min(1).default("id"),
    GITHUB_SECRET: z.string().min(1).default("supersecret"),
    BETTER_AUTH_APP_NAME: z.string().min(1).default("Ultimate Starter Kit"),
    BETTER_AUTH_URL: z.string().default("http://localhost:3000"),
    BETTER_AUTH_SECRET: z.preprocess(
      emptyStringToUndefined,
      z
        .string()
        .min(1)
        .default("dev-secret-set-BETTER_AUTH_SECRET-in-production"),
    ),
    NODE_ENV: z.enum(["development", "production"]).optional(),
    PORT: z.string().default("3000"),
  },
  client: {},
  experimental__runtimeEnv: {},
  skipValidation: process.env.npm_lifecycle_event === "lint",
});
