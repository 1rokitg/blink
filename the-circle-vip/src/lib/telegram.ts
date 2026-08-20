import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const TELEGRAM_API = "https://api.telegram.org";

export type TelegramAuthPayload = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
};

export function getTelegramBotToken() {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
}

export function getTelegramBotUsername() {
  return process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.trim().replace(
    /^@/,
    "",
  );
}

export function getTelegramChatId() {
  return process.env.TELEGRAM_CHAT_ID?.trim() ?? "";
}

export function isTelegramBotConfigured() {
  return Boolean(getTelegramBotToken() && getTelegramChatId());
}

export function isTelegramLoginConfigured() {
  return Boolean(getTelegramBotToken() && getTelegramBotUsername());
}

/** Verify Telegram Login Widget payload. */
export function verifyTelegramLogin(
  payload: TelegramAuthPayload,
  maxAgeSeconds = 60 * 60 * 24,
): boolean {
  const token = getTelegramBotToken();
  if (!token || !payload.hash) {
    return false;
  }

  const authDate = Number(payload.auth_date);
  if (!Number.isFinite(authDate)) {
    return false;
  }
  if (Date.now() / 1000 - authDate > maxAgeSeconds) {
    return false;
  }

  const checkString = Object.entries(payload)
    .filter(([key]) => key !== "hash")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = createHash("sha256").update(token).digest();
  const computed = createHmac("sha256", secretKey)
    .update(checkString)
    .digest("hex");

  try {
    return timingSafeEqual(
      Buffer.from(computed, "utf8"),
      Buffer.from(payload.hash, "utf8"),
    );
  } catch {
    return false;
  }
}

async function telegramCall<T>(
  method: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const token = getTelegramBotToken();
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not set.");
  }

  const response = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = (await response.json()) as {
    ok: boolean;
    description?: string;
    result: T;
  };

  if (!json.ok) {
    throw new Error(json.description ?? `Telegram API ${method} failed`);
  }

  return json.result;
}

/**
 * Create a single-use invite link for the VIP Telegram group/channel.
 * Bot must be admin with invite permission.
 */
export async function createVipInviteLink(label: string) {
  if (!isTelegramBotConfigured()) {
    console.info(
      `[telegram] Bot not configured — would create invite for ${label}`,
    );
    return { inviteLink: null as string | null, skipped: true as const };
  }

  const chatId = getTelegramChatId();
  const result = await telegramCall<{ invite_link: string }>(
    "createChatInviteLink",
    {
      chat_id: chatId,
      name: label.slice(0, 32),
      member_limit: 1,
      // Expire in 7 days if unused
      expire_date: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
    },
  );

  return { inviteLink: result.invite_link, skipped: false as const };
}

/** Kick member when subscription ends. Requires numeric Telegram user id. */
export async function revokeVipAccess(telegramUserId: string) {
  if (!isTelegramBotConfigured()) {
    console.info(
      `[telegram] Bot not configured — would revoke access for ${telegramUserId}`,
    );
    return { ok: true as const, skipped: true as const };
  }

  if (!/^\d+$/.test(telegramUserId)) {
    console.warn(
      `[telegram] Cannot revoke without numeric user id (got ${telegramUserId})`,
    );
    return { ok: false as const, skipped: true as const };
  }

  const chatId = getTelegramChatId();
  const userId = Number(telegramUserId);

  try {
    await telegramCall("banChatMember", {
      chat_id: chatId,
      user_id: userId,
    });
    // Unban so they can rejoin later via a new paid invite
    await telegramCall("unbanChatMember", {
      chat_id: chatId,
      user_id: userId,
      only_if_banned: true,
    });
    console.info(`[telegram] Revoked VIP access for ${telegramUserId}`);
    return { ok: true as const, skipped: false as const };
  } catch (error) {
    console.error(`[telegram] Revoke failed for ${telegramUserId}`, error);
    return {
      ok: false as const,
      skipped: false as const,
      error: error instanceof Error ? error.message : "revoke_failed",
    };
  }
}

export async function ensureVipAccess(telegramUserId: string) {
  if (!isTelegramBotConfigured()) {
    console.info(
      `[telegram] Bot not configured — would ensure access for ${telegramUserId}`,
    );
    return { ok: true as const, skipped: true as const };
  }

  if (!/^\d+$/.test(telegramUserId)) {
    return { ok: true as const, skipped: true as const };
  }

  // Unban if previously kicked so a fresh invite works
  try {
    await telegramCall("unbanChatMember", {
      chat_id: getTelegramChatId(),
      user_id: Number(telegramUserId),
      only_if_banned: true,
    });
  } catch {
    // ignore — user may never have been banned
  }

  return { ok: true as const, skipped: false as const };
}
