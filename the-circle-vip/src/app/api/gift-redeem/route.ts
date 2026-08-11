import { NextResponse } from "next/server";
import { z } from "zod";

import { redeemCompGift } from "@/lib/comp-gifts.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  giftId: z
    .string()
    .trim()
    .regex(/^gf_[a-zA-Z0-9]+$/),
  telegramUsername: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^@?[a-zA-Z0-9_]{2,64}$/),
  email: z.string().trim().email().optional().or(z.literal("")),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid Telegram username." },
      { status: 400 },
    );
  }

  try {
    const result = await redeemCompGift({
      giftId: parsed.data.giftId,
      telegramUsername: parsed.data.telegramUsername,
      email: parsed.data.email || undefined,
    });
    return NextResponse.json({
      ok: true,
      inviteLink: result.inviteLink,
      member: result.member,
      telegramNote: result.telegramNote,
    });
  } catch (error) {
    console.error("[gift-redeem]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not redeem this gift.",
      },
      { status: 400 },
    );
  }
}
