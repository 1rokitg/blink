import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  INTERNAL_SESSION_COOKIE,
  readInternalSession,
} from "@/lib/internal-auth";
import { buildInternalSearchIndex } from "@/lib/internal-search.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireApiSession() {
  const jar = await cookies();
  return readInternalSession(jar.get(INTERNAL_SESSION_COOKIE)?.value);
}

export async function GET() {
  const session = await requireApiSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const index = await buildInternalSearchIndex();
    return NextResponse.json(index, {
      headers: {
        "Cache-Control": "private, max-age=30",
      },
    });
  } catch (error) {
    console.error("[search] index failed", error);
    return NextResponse.json(
      { error: "Search index unavailable." },
      { status: 500 },
    );
  }
}
