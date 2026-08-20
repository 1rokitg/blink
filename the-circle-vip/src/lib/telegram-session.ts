import "server-only";

import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

export type TelegramSession = {
  id: string;
  username: string | null;
  firstName: string | null;
  photoUrl: string | null;
};

const COOKIE_NAME = "circle_telegram_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function getSessionSecret() {
  return (
    process.env.SESSION_SECRET?.trim() ||
    process.env.TELEGRAM_BOT_TOKEN?.trim() ||
    "dev-only-circle-vip-session-secret"
  );
}

function sign(payload: string) {
  return createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("base64url");
}

export function encodeTelegramSession(session: TelegramSession) {
  const payload = Buffer.from(JSON.stringify(session), "utf8").toString(
    "base64url",
  );
  return `${payload}.${sign(payload)}`;
}

export function decodeTelegramSession(value: string): TelegramSession | null {
  const [payload, signature] = value.split(".");
  if (!payload || !signature) {
    return null;
  }

  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as TelegramSession;
    if (!parsed?.id) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function getTelegramSession(): Promise<TelegramSession | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE_NAME)?.value;
  if (!raw) {
    return null;
  }
  return decodeTelegramSession(raw);
}

export async function setTelegramSession(session: TelegramSession) {
  const jar = await cookies();
  jar.set(COOKIE_NAME, encodeTelegramSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearTelegramSession() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}
