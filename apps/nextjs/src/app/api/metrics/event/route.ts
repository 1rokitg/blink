import { type NextRequest, NextResponse } from "next/server";

import { checkBotId } from "botid/server";
import { z } from "zod";

import { resolveEventIdentity } from "~/lib/blink/event-identity";
import { trackMetricEvent } from "~/lib/blink/internal-metrics.server";

export const runtime = "nodejs";

const bodySchema = z.object({
  eventType: z.string().min(2).max(64),
  walletAddress: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/)
    .optional(),
  source: z.string().max(64).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  const verification = await checkBotId();
  if (verification.isBot) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const h = request.headers;
  const identity = resolveEventIdentity(h);

  // ── Vercel geo headers (free, injected at edge) ──────────────────────────
  const country =
    h.get("x-vercel-ip-country") ?? h.get("cf-ipcountry") ?? "unknown";
  const region = h.get("x-vercel-ip-country-region") ?? null;
  const city = h.get("x-vercel-ip-city") ?? null;
  const lat = h.get("x-vercel-ip-latitude") ?? null;
  const lon = h.get("x-vercel-ip-longitude") ?? null;

  // ── Request context ───────────────────────────────────────────────────────
  const ua = h.get("user-agent") ?? null;
  const lang = h.get("accept-language")?.split(",")[0]?.trim() ?? null;
  const referer = h.get("referer") ?? "";
  const origin = h.get("origin") ?? null;

  // Derive a clean acquisition source from referer
  const refHost = referer
    ? (() => {
        try {
          return new URL(referer).hostname.toLowerCase();
        } catch {
          return "unknown";
        }
      })()
    : "direct";

  // Parse UTM params from the referer URL if present
  let utmSource: string | null = null;
  let utmMedium: string | null = null;
  let utmCampaign: string | null = null;
  try {
    if (referer) {
      const u = new URL(referer);
      utmSource = u.searchParams.get("utm_source");
      utmMedium = u.searchParams.get("utm_medium");
      utmCampaign = u.searchParams.get("utm_campaign");
    }
  } catch {
    /* ignore */
  }

  await trackMetricEvent({
    ...parsed.data,
    visitorId: identity.visitorId,
    sessionId: identity.sessionId,
    requestId: identity.requestId,
    isBot: identity.bot.isBot,
    botId: identity.bot.botId,
    source: parsed.data.source ?? refHost,
    metadata: {
      ...(parsed.data.metadata ?? {}),
      visitorId: identity.visitorId,
      sessionId: identity.sessionId,
      requestId: identity.requestId,
      ...(identity.bot.botTag ? { botTag: identity.bot.botTag } : {}),
      ...(identity.bot.firewallAction
        ? { firewallAction: identity.bot.firewallAction }
        : {}),
      ...(identity.requestContext.fingerprint
        ? { fingerprint: identity.requestContext.fingerprint }
        : {}),
      ...(identity.requestContext.ipAddress
        ? { ipAddress: identity.requestContext.ipAddress }
        : {}),
      // Geo
      country,
      ...(region ? { region } : {}),
      ...(city ? { city } : {}),
      ...(lat ? { lat } : {}),
      ...(lon ? { lon } : {}),
      // Request context
      ...(ua ? { userAgent: ua } : {}),
      ...(lang ? { language: lang } : {}),
      ...(origin ? { origin } : {}),
      referer,
      // UTM attribution
      ...(utmSource ? { utmSource } : {}),
      ...(utmMedium ? { utmMedium } : {}),
      ...(utmCampaign ? { utmCampaign } : {}),
    },
  });
  const response = NextResponse.json({
    ok: true,
    visitorId: identity.visitorId,
    sessionId: identity.sessionId,
  });
  for (const cookie of identity.setCookies) {
    response.headers.append("set-cookie", cookie);
  }
  return response;
}
