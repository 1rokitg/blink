import { NextResponse } from "next/server";

import {
  isTelegramBotConfigured,
  isTelegramLoginConfigured,
} from "@/lib/telegram";
import { getTelegramSession } from "@/lib/telegram-session";
import { isStripeConfigured } from "@/lib/stripe";

export const runtime = "nodejs";

export async function GET() {
  const telegram = await getTelegramSession();
  return NextResponse.json({
    telegram,
    config: {
      stripe: isStripeConfigured(),
      telegramLogin: isTelegramLoginConfigured(),
      telegramBot: isTelegramBotConfigured(),
    },
  });
}
