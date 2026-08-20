import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  affiliateShareUrl,
  affiliateTotals,
  createAffiliate,
  listAffiliates,
  updateAffiliateStatus,
} from "@/lib/affiliates.server";
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

export async function GET() {
  const session = await requireApiSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const affiliates = await listAffiliates(200);
  return NextResponse.json({
    affiliates: affiliates.map((row) => ({
      ...row,
      shareUrl: affiliateShareUrl(row.code),
    })),
    totals: affiliateTotals(affiliates),
  });
}

const postSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    name: z.string().trim().min(1).max(120),
    code: z.string().trim().max(32).optional(),
    email: z.string().trim().email().optional().or(z.literal("")),
    telegramUsername: z
      .string()
      .trim()
      .max(64)
      .regex(/^@?[a-zA-Z0-9_]{0,64}$/)
      .optional()
      .or(z.literal("")),
    commissionType: z.enum(["percent", "flat"]).optional(),
    commissionValue: z.number().min(0).max(10_000).optional(),
    note: z.string().trim().max(400).optional(),
  }),
  z.object({
    action: z.literal("set_status"),
    id: z.string().trim().min(3).max(80),
    status: z.enum(["active", "paused", "archived"]),
  }),
]);

export async function POST(request: Request) {
  const session = await requireApiSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid affiliate payload." }, { status: 400 });
  }

  try {
    if (parsed.data.action === "create") {
      const affiliate = await createAffiliate({
        name: parsed.data.name,
        code: parsed.data.code,
        email: parsed.data.email || undefined,
        telegramUsername: parsed.data.telegramUsername || undefined,
        commissionType: parsed.data.commissionType,
        commissionValue: parsed.data.commissionValue,
        note: parsed.data.note,
        createdBy: session.username,
      });
      return NextResponse.json({
        ok: true,
        affiliate: {
          ...affiliate,
          shareUrl: affiliateShareUrl(affiliate.code),
        },
      });
    }

    const affiliate = await updateAffiliateStatus(
      parsed.data.id,
      parsed.data.status,
    );
    return NextResponse.json({
      ok: true,
      affiliate: {
        ...affiliate,
        shareUrl: affiliateShareUrl(affiliate.code),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Affiliate update failed.",
      },
      { status: 500 },
    );
  }
}
