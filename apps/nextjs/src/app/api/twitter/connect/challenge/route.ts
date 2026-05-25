import crypto from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import {
  TWITTER_CLAIM_CONTEXT_COOKIE,
  sanitizeTwitterReturnTo,
} from "~/lib/blink/twitter-ownership";

export const runtime = "nodejs";

const bodySchema = z.object({
  walletAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  returnTo: z.string().optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const walletAddress = parsed.data.walletAddress.toLowerCase();
  const nonce = crypto.randomBytes(16).toString("hex");
  const returnTo = sanitizeTwitterReturnTo(parsed.data.returnTo);

  const response = NextResponse.json({ nonce });

  response.cookies.set(
    TWITTER_CLAIM_CONTEXT_COOKIE,
    Buffer.from(
      JSON.stringify({
        nonce,
        returnTo,
        walletAddress,
      }),
    ).toString("base64url"),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    },
  );

  return response;
}
