import "server-only";

import { createRequire } from "node:module";
import { cache } from "react";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePostgresJs } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { Pool } from "pg";
import postgres from "postgres";

import * as schema from "./schema";

const require = createRequire(import.meta.url);

/** Matches apps/nextjs env.ts build default — not a real database. */
export const BUILD_STUB_POSTGRES_URL =
  "postgresql://build:build@127.0.0.1:5432/blink_build";

export type BlinkDatabase =
  | NodePgDatabase<typeof schema>
  | PostgresJsDatabase<typeof schema>;

function tryHyperdriveConnectionString(): string | null {
  try {
    const { getCloudflareContext } = require("@opennextjs/cloudflare") as {
      getCloudflareContext: (opts?: { async?: boolean }) => {
        env: { HYPERDRIVE?: { connectionString: string } };
      };
    };
    const { env } = getCloudflareContext();
    const url = env.HYPERDRIVE?.connectionString?.trim();
    if (!url || url === BUILD_STUB_POSTGRES_URL) return null;
    return url;
  } catch {
    return null;
  }
}

export async function tryHyperdriveConnectionStringAsync(): Promise<string | null> {
  try {
    const { getCloudflareContext } = require("@opennextjs/cloudflare") as {
      getCloudflareContext: (opts?: { async?: boolean }) =>
        | { env: { HYPERDRIVE?: { connectionString: string } } }
        | Promise<{ env: { HYPERDRIVE?: { connectionString: string } } }>;
    };
    const ctx = await getCloudflareContext({ async: true });
    const url = ctx.env.HYPERDRIVE?.connectionString?.trim();
    if (!url || url === BUILD_STUB_POSTGRES_URL) return null;
    return url;
  } catch {
    return null;
  }
}

export function getConfiguredPostgresUrl(): string | null {
  const url = process.env.POSTGRES_URL?.trim();
  if (!url || url === BUILD_STUB_POSTGRES_URL) return null;
  return url;
}

export function isDatabaseConfigured(): boolean {
  if (getConfiguredPostgresUrl()) return true;
  return tryHyperdriveConnectionString() !== null;
}

function createHyperdriveDb(connectionString: string): NodePgDatabase<typeof schema> {
  const pool = new Pool({
    connectionString,
    maxUses: 1,
  });
  return drizzleNodePg({ client: pool, schema, casing: "snake_case" });
}

function createDirectPostgresDb(connectionString: string): PostgresJsDatabase<typeof schema> {
  const client = postgres(connectionString, {
    prepare: false,
    max: 1,
  });
  return drizzlePostgresJs({ client, schema, casing: "snake_case" });
}

function createRequestDb(): BlinkDatabase {
  const hyperdrive = tryHyperdriveConnectionString();
  if (hyperdrive) {
    return createHyperdriveDb(hyperdrive);
  }

  const url = getConfiguredPostgresUrl();
  if (!url) {
    throw new Error(
      "Database is not configured. Set POSTGRES_URL locally, or add a Hyperdrive binding (HYPERDRIVE) in wrangler.toml for Cloudflare Workers.",
    );
  }

  return createDirectPostgresDb(url);
}

/** Per-request Drizzle client (required on Cloudflare Workers + Hyperdrive). */
export const getDb = cache(createRequestDb);

/** For ISR/SSG routes that need async Cloudflare context. */
export const getDbAsync = cache(async (): Promise<BlinkDatabase> => {
  const hyperdrive = await tryHyperdriveConnectionStringAsync();
  if (hyperdrive) {
    return createHyperdriveDb(hyperdrive);
  }

  const url = getConfiguredPostgresUrl();
  if (!url) {
    throw new Error(
      "Database is not configured. Set POSTGRES_URL locally, or add a Hyperdrive binding (HYPERDRIVE) in wrangler.toml for Cloudflare Workers.",
    );
  }

  return createDirectPostgresDb(url);
});

/** @deprecated Prefer `getDb()` — kept for existing imports. */
export const db = new Proxy({} as BlinkDatabase, {
  get(_target, prop, receiver) {
    const instance = getDb();
    const value = Reflect.get(instance as object, prop, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
