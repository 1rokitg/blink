import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createCompGiftLink,
  grantCompMonth,
  listCompGifts,
  mailtoForGift,
  publicGiftUrl,
  revokeCompGift,
} from "@/lib/comp-gifts.server";
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

  const gifts = await listCompGifts(50);
  return NextResponse.json({
    gifts: gifts.map((gift) => ({
      ...gift,
      url: publicGiftUrl(gift.id),
      mailto: gift.email
        ? mailtoForGift({
            email: gift.email,
            giftUrl: publicGiftUrl(gift.id),
            inviteLink: gift.inviteLink,
            label: gift.label,
          })
        : null,
    })),
  });
}

const postSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("instant"),
    telegramUsername: z
      .string()
      .trim()
      .min(2)
      .max(64)
      .regex(/^@?[a-zA-Z0-9_]{2,64}$/),
    telegramUserId: z.string().trim().max(64).optional().or(z.literal("")),
    email: z.string().trim().email().optional().or(z.literal("")),
    note: z.string().trim().max(200).optional().or(z.literal("")),
  }),
  z.object({
    action: z.literal("create_link"),
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
  }),
  z.object({
    action: z.literal("revoke"),
    id: z.string().trim().min(8).max(80),
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
    return NextResponse.json({ error: "Invalid comp payload." }, { status: 400 });
  }

  try {
    if (parsed.data.action === "revoke") {
      const gift = await revokeCompGift(parsed.data.id);
      return NextResponse.json({
        ok: true,
        gift: { ...gift, url: publicGiftUrl(gift.id) },
      });
    }

    if (parsed.data.action === "create_link") {
      const gift = await createCompGiftLink({
        email: parsed.data.email || undefined,
        telegramUsername: parsed.data.telegramUsername || undefined,
        note: parsed.data.note || undefined,
        label: parsed.data.label || undefined,
        expiresInDays: parsed.data.expiresInDays,
        createdBy: session.username,
      });
      const url = publicGiftUrl(gift.id);
      return NextResponse.json({
        ok: true,
        gift: {
          ...gift,
          url,
          mailto: gift.email
            ? mailtoForGift({
                email: gift.email,
                giftUrl: url,
                label: gift.label,
              })
            : null,
        },
      });
    }

    const granted = await grantCompMonth({
      telegramUsername: parsed.data.telegramUsername,
      telegramUserId: parsed.data.telegramUserId || undefined,
      email: parsed.data.email || undefined,
      note: parsed.data.note || undefined,
      createdBy: session.username,
    });

    const email = parsed.data.email?.trim() || "";
    const mailto = email
      ? mailtoForGift({
          email,
          inviteLink: granted.inviteLink,
          label: "Your complimentary Circle membership",
        })
      : null;

    return NextResponse.json({
      ok: true,
      member: granted.member,
      inviteLink: granted.inviteLink,
      telegramNote: granted.telegramNote,
      mailto,
    });
  } catch (error) {
    console.error("[comp]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to gift membership.",
      },
      { status: 500 },
    );
  }
}
