import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getCloudflareZoneTraffic } from "@/lib/cloudflare-zone-analytics.server";
import {
  INTERNAL_SESSION_COOKIE,
  readInternalSession,
} from "@/lib/internal-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const jar = await cookies();
  const session = readInternalSession(
    jar.get(INTERNAL_SESSION_COOKIE)?.value,
  );
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const days = Number(new URL(request.url).searchParams.get("days") ?? 30);
  const snapshot = await getCloudflareZoneTraffic(days);
  return NextResponse.json(snapshot);
}
