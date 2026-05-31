import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

/** Matches apps/nextjs env.ts build default — not a real database. */
export const BUILD_STUB_POSTGRES_URL =
  "postgresql://build:build@127.0.0.1:5432/blink_build";

export function getConfiguredPostgresUrl(): string | null {
  const url = process.env.POSTGRES_URL?.trim();
  if (!url || url === BUILD_STUB_POSTGRES_URL) return null;
  return url;
}

export function isDatabaseConfigured(): boolean {
  return getConfiguredPostgresUrl() !== null;
}

function requirePostgresUrl() {
  const url = getConfiguredPostgresUrl();
  if (!url) {
    throw new Error(
      "POSTGRES_URL is not set. Add it in Cloudflare Worker variables (Secret) or local .env.",
    );
  }
  return url;
}

/** Reuse one pool per isolate (Workers) / process (Node dev). */
const globalForDb = globalThis as unknown as {
  postgresClient?: ReturnType<typeof postgres>;
  drizzleDb?: PostgresJsDatabase<typeof schema>;
};

function getPostgresClient() {
  if (!globalForDb.postgresClient) {
    globalForDb.postgresClient = postgres(requirePostgresUrl(), {
      // Required for Supabase / Neon pooler (transaction mode).
      prepare: false,
      max: 1,
    });
  }
  return globalForDb.postgresClient;
}

function getDrizzleDb() {
  if (!globalForDb.drizzleDb) {
    globalForDb.drizzleDb = drizzle({
      client: getPostgresClient(),
      schema,
      casing: "snake_case",
    });
  }
  return globalForDb.drizzleDb;
}

/** Lazy proxy so importing `@acme/db/client` does not connect during Next build. */
export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    const instance = getDrizzleDb();
    const value = Reflect.get(instance as object, prop, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
