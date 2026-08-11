import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createClaimLink,
  listClaimLinks,
  publicClaimUrl,
  revokeClaimLink,
  toPublicClaimView,
} from "@/lib/claim-links.server";
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

  const links = await listClaimLinks(100);
  return NextResponse.json({
    links: links.map((link) => ({
      ...link,
      url: publicClaimUrl(link.id),
      amountUsd: link.amountUsdCents / 100,
      public: toPublicClaimView(link),
    })),
  });
}

const createSchema = z.object({
  amountUsd: z.number().min(0.5).max(10_000),
  interval: z.enum(["month", "year"]).optional(),
  intervalCount: z.number().int().min(1).max(36).optional(),
  planId: z.enum(["month", "quarter", "year"]).optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
  telegramUsername: z
    .string()
    .trim()
    .max(64)
    .regex(/^@?[a-zA-Z0-9_]{0,64}$/)
    .optional()
    .or(z.literal("")),
  note: z.string().trim().max(280).optional().or(z.literal("")),
  label: z.string().trim().max(120).optional().or(z.literal("")),
  expiresInDays: z.number().int().min(1).max(90).optional(),
});

const revokeSchema = z.object({
  action: z.literal("revoke"),
  id: z.string().trim().min(8).max(80),
});

export async function POST(request: Request) {
  const session = await requireApiSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);

  if (body && typeof body === "object" && "action" in body) {
    const parsed = revokeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid revoke payload." }, { status: 400 });
    }
    try {
      const link = await revokeClaimLink(parsed.data.id);
      return NextResponse.json({
        ok: true,
        link: { ...link, url: publicClaimUrl(link.id) },
      });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Failed to revoke link.",
        },
        { status: 400 },
      );
    }
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid claim link payload." },
      { status: 400 },
    );
  }

  try {
    const link = await createClaimLink({
      amountUsd: parsed.data.amountUsd,
      interval: parsed.data.interval,
      intervalCount: parsed.data.intervalCount,
      planId: parsed.data.planId,
      email: parsed.data.email || undefined,
      telegramUsername: parsed.data.telegramUsername || undefined,
      note: parsed.data.note || undefined,
      label: parsed.data.label || undefined,
      expiresInDays: parsed.data.expiresInDays,
      createdBy: session.username,
    });
    return NextResponse.json({
      ok: true,
      link: {
        ...link,
        url: publicClaimUrl(link.id),
        amountUsd: link.amountUsdCents / 100,
      },
    });
  } catch (error) {
    console.error("[claim-links] create failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create claim link.",
      },
      { status: 500 },
    );
  }
}
