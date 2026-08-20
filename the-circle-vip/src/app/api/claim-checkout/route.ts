import { NextResponse } from "next/server";
import { z } from "zod";

import { startClaimCheckout } from "@/lib/claim-links.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  claimId: z
    .string()
    .trim()
    .regex(/^cl_[a-zA-Z0-9]+$/),
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
    const result = await startClaimCheckout({
      claimId: parsed.data.claimId,
      telegramUsername: parsed.data.telegramUsername,
      email: parsed.data.email || undefined,
    });
    return NextResponse.json({
      url: result.url,
      sessionId: result.sessionId,
    });
  } catch (error) {
    console.error("[claim-checkout]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not start checkout for this claim link.",
      },
      { status: 400 },
    );
  }
}
