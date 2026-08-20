import { NextResponse } from "next/server";

import {
  createInternalSessionToken,
  internalSessionCookie,
  isInternalAuthConfigured,
  verifyInternalCredentials,
} from "@/lib/internal-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isInternalAuthConfigured()) {
    return NextResponse.json({ error: "Unavailable." }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as {
    username?: string;
    password?: string;
  } | null;
  const username = body?.username?.trim() ?? "";
  const password = body?.password ?? "";

  if (!verifyInternalCredentials(username, password)) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  const token = await createInternalSessionToken(username);
  const response = NextResponse.json({ ok: true });
  response.headers.set("Set-Cookie", internalSessionCookie(token));
  return response;
}
