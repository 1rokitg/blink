import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  INTERNAL_SESSION_COOKIE,
  readInternalSession,
} from "@/lib/internal-auth";
import { getTrafficLiveSnapshot } from "@/lib/traffic-live.server";
import type { TrafficLiveWindow } from "@/lib/traffic-live-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseWindow(value: string | null): TrafficLiveWindow {
  const n = Number(value);
  if (n === 5 || n === 30 || n === 60) return n;
  return 60;
}

export async function GET(request: Request) {
  const jar = await cookies();
  const session = readInternalSession(
    jar.get(INTERNAL_SESSION_COOKIE)?.value,
  );
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const windowMinutes = parseWindow(
    new URL(request.url).searchParams.get("window"),
  );
  const snapshot = await getTrafficLiveSnapshot(windowMinutes);
  return NextResponse.json(snapshot);
}
