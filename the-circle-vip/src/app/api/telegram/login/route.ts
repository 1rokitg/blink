import { NextResponse } from "next/server";
import { z } from "zod";

import {
  isTelegramLoginConfigured,
  verifyTelegramLogin,
  type TelegramAuthPayload,
} from "@/lib/telegram";
import { setTelegramSession } from "@/lib/telegram-session";

export const runtime = "nodejs";

const schema = z.object({
  id: z.coerce.number().int().positive(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  photo_url: z.string().optional(),
  auth_date: z.coerce.number().int().positive(),
  hash: z.string().min(16),
});

export async function POST(request: Request) {
  if (!isTelegramLoginConfigured()) {
    return NextResponse.json(
      { error: "Telegram Login is not configured." },
      { status: 500 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid Telegram login payload." },
      { status: 400 },
    );
  }

  const payload = parsed.data as TelegramAuthPayload;
  if (!verifyTelegramLogin(payload)) {
    return NextResponse.json(
      { error: "Telegram login verification failed." },
      { status: 401 },
    );
  }

  await setTelegramSession({
    id: String(payload.id),
    username: payload.username ?? null,
    firstName: payload.first_name ?? null,
    photoUrl: payload.photo_url ?? null,
  });

  return NextResponse.json({
    ok: true,
    telegram: {
      id: String(payload.id),
      username: payload.username ?? null,
      firstName: payload.first_name ?? null,
    },
  });
}
