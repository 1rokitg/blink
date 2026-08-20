import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { getFunnelBoard } from "@/lib/funnel-stats.server";
import { normalizeRange } from "@/lib/internal-stats.server";
import {
  INTERNAL_SESSION_COOKIE,
  readInternalSession,
} from "@/lib/internal-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireApiSession() {
  const jar = await cookies();
  return readInternalSession(jar.get(INTERNAL_SESSION_COOKIE)?.value);
}

export async function GET(request: Request) {
  const session = await requireApiSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const days = normalizeRange(searchParams.get("days"));
  const board = await getFunnelBoard(days);
  return NextResponse.json({ board });
}
