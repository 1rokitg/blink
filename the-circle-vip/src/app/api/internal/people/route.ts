import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  INTERNAL_SESSION_COOKIE,
  readInternalSession,
} from "@/lib/internal-auth";
import {
  getPersonEnrichmentForEntity,
  listPersonEnrichments,
  upsertPersonEnrichment,
} from "@/lib/people-enrichment.server";
import { getRecentVisitors } from "@/lib/pageviews.server";

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
  const limit = Math.min(
    400,
    Math.max(1, Number(searchParams.get("limit") ?? 150) || 150),
  );
  const kind = searchParams.get("kind");
  const entityId = searchParams.get("entityId");

  if (
    (kind === "member" || kind === "visitor") &&
    entityId?.trim()
  ) {
    const enrichment = await getPersonEnrichmentForEntity(kind, entityId.trim());
    return NextResponse.json({ enrichment });
  }

  const [people, enrichments] = await Promise.all([
    getRecentVisitors(limit),
    listPersonEnrichments(400),
  ]);

  return NextResponse.json({
    people,
    count: people.length,
    enrichments,
  });
}

const upsertSchema = z.object({
  action: z.literal("upsert_enrichment"),
  kind: z.enum(["member", "visitor"]),
  entityId: z.string().trim().min(3).max(120),
  name: z.string().trim().max(120).optional().nullable(),
  email: z
    .string()
    .trim()
    .max(200)
    .optional()
    .nullable()
    .or(z.literal("")),
  phone: z.string().trim().max(40).optional().nullable(),
  telegramUsername: z.string().trim().max(64).optional().nullable(),
  discordUsername: z.string().trim().max(64).optional().nullable(),
  xUsername: z.string().trim().max(64).optional().nullable(),
  instagramUsername: z.string().trim().max(64).optional().nullable(),
  pfpUrl: z.string().trim().max(500).optional().nullable().or(z.literal("")),
  photoUrls: z
    .union([z.array(z.string()), z.string()])
    .optional()
    .nullable(),
  paymentMethods: z.string().trim().max(400).optional().nullable(),
  wallets: z.union([z.string(), z.array(z.string())]).optional().nullable(),
  note: z.string().trim().max(2000).optional().nullable(),
  linkedMemberId: z.string().trim().max(120).optional().nullable(),
  linkedVisitorId: z.string().trim().max(120).optional().nullable(),
});

export async function POST(request: Request) {
  const session = await requireApiSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid person profile payload." },
      { status: 400 },
    );
  }

  try {
    const enrichment = await upsertPersonEnrichment({
      kind: parsed.data.kind,
      entityId: parsed.data.entityId,
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      telegramUsername: parsed.data.telegramUsername,
      discordUsername: parsed.data.discordUsername,
      xUsername: parsed.data.xUsername,
      instagramUsername: parsed.data.instagramUsername,
      pfpUrl: parsed.data.pfpUrl,
      photoUrls: parsed.data.photoUrls,
      paymentMethods: parsed.data.paymentMethods,
      wallets: parsed.data.wallets,
      note: parsed.data.note,
      linkedMemberId: parsed.data.linkedMemberId,
      linkedVisitorId: parsed.data.linkedVisitorId,
      updatedBy: session.username,
    });
    return NextResponse.json({ ok: true, enrichment });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to save person profile.",
      },
      { status: 400 },
    );
  }
}
