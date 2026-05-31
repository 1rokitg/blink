/** Generated manually; run `pnpm --filter @acme/nextjs cf-typegen` after updating wrangler.toml. */
interface CloudflareEnv {
  ASSETS: Fetcher;
  HYPERDRIVE: Hyperdrive;
  WORKER_SELF_REFERENCE: Fetcher;
}

interface Hyperdrive {
  connectionString: string;
}
