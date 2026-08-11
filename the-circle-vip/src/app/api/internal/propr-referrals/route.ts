import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  INTERNAL_SESSION_COOKIE,
  readInternalSession,
} from "@/lib/internal-auth";
import {
  getProprReferralSyncStatus,
  syncProprReferrals,
} from "@/lib/propr-referrals.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireApiSession() {
  const jar = await cookies();
  return readInternalSession(jar.get(INTERNAL_SESSION_COOKIE)?.value);
}

const postSchema = z.object({
  action: z.literal("sync"),
  token: z.string().trim().min(20).max(4000).optional(),
  persistToken: z.boolean().optional(),
});

export async function GET() {
  const session = await requireApiSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const status = await getProprReferralSyncStatus();
  return NextResponse.json(status);
}

export async function POST(request: Request) {
  const session = await requireApiSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  try {
    const result = await syncProprReferrals({
      token: parsed.data.token,
      persistToken: parsed.data.persistToken,
    });
    return NextResponse.json({
      ok: true,
      tokenPersisted: result.tokenPersisted,
      tokenExpiresAt: result.tokenExpiresAt,
      summary: result.summary,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Propr sync failed.",
      },
      { status: 400 },
    );
  }
}
