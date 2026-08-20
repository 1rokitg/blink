import { NextResponse } from "next/server";

import { clearTelegramSession } from "@/lib/telegram-session";
import { getAppUrl } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST() {
  await clearTelegramSession();
  return NextResponse.json({ ok: true });
}

export async function GET() {
  await clearTelegramSession();
  return NextResponse.redirect(getAppUrl());
}
