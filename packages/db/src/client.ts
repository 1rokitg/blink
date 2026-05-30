import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

function getPostgresUrl() {
  const url = process.env.POSTGRES_URL;
  if (!url?.trim()) {
    throw new Error(
      "POSTGRES_URL is not set. Add it in Cloudflare Worker variables (Secret) or local .env.",
    );
  }
  return url;
}

/** Reuse one pool per isolate (Workers) / process (Node dev). */
const globalForDb = globalThis as unknown as {
  postgresClient?: ReturnType<typeof postgres>;
};

function getPostgresClient() {
  if (!globalForDb.postgresClient) {
    globalForDb.postgresClient = postgres(getPostgresUrl(), {
      // Required for Supabase / Neon pooler (transaction mode).
      prepare: false,
      max: 1,
    });
  }
  return globalForDb.postgresClient;
}

export const db = drizzle({
  client: getPostgresClient(),
  schema,
  casing: "snake_case",
});
