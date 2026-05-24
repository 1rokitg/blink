import { NextResponse } from "next/server";

/**
 * GET /api/version
 * Returns the current deployment's commit SHA.
 * Polled by the client to detect new deployments and prompt a page refresh.
 */
export const dynamic = "force-dynamic";

export function GET() {
  const sha = (
    process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_SHA ?? "dev"
  ).slice(0, 7);

  return NextResponse.json({ sha }, {
    headers: {
      // Don't cache — we need fresh data on every poll
      "Cache-Control": "no-store",
    },
  });
}
