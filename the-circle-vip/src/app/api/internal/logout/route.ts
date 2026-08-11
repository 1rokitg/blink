import { NextResponse } from "next/server";

import { clearInternalSessionCookie } from "@/lib/internal-auth";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.headers.set("Set-Cookie", clearInternalSessionCookie());
  return response;
}
