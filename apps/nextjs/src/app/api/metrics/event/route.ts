import { NextResponse } from "next/server";

import { z } from "zod";

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

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const h = request.headers;

  // ── Vercel geo headers (free, injected at edge) ──────────────────────────
  const country = h.get("x-vercel-ip-country") ?? h.get("cf-ipcountry") ?? "unknown";
  const region  = h.get("x-vercel-ip-country-region") ?? null;
  const city    = h.get("x-vercel-ip-city") ?? null;
  const lat     = h.get("x-vercel-ip-latitude") ?? null;
  const lon     = h.get("x-vercel-ip-longitude") ?? null;

  // ── Request context ───────────────────────────────────────────────────────
  const ua      = h.get("user-agent") ?? null;
  const lang    = h.get("accept-language")?.split(",")[0]?.trim() ?? null;
  const referer = h.get("referer") ?? "";
  const origin  = h.get("origin") ?? null;

  // Derive a clean acquisition source from referer
  const refHost = referer
    ? (() => { try { return new URL(referer).hostname.toLowerCase(); } catch { return "unknown"; } })()
    : "direct";

  // Parse UTM params from the referer URL if present
  let utmSource: string | null = null;
  let utmMedium: string | null = null;
  let utmCampaign: string | null = null;
  try {
    if (referer) {
      const u = new URL(referer);
      utmSource   = u.searchParams.get("utm_source");
      utmMedium   = u.searchParams.get("utm_medium");
      utmCampaign = u.searchParams.get("utm_campaign");
    }
  } catch { /* ignore */ }

  await trackMetricEvent({
    ...parsed.data,
    source: parsed.data.source ?? refHost,
    metadata: {
      ...(parsed.data.metadata ?? {}),
      // Geo
      country,
      ...(region   ? { region }   : {}),
      ...(city      ? { city }      : {}),
      ...(lat       ? { lat }       : {}),
      ...(lon       ? { lon }       : {}),
      // Request context
      ...(ua        ? { userAgent: ua }     : {}),
      ...(lang      ? { language: lang }    : {}),
      ...(origin    ? { origin }            : {}),
      referer,
      // UTM attribution
      ...(utmSource   ? { utmSource }   : {}),
      ...(utmMedium   ? { utmMedium }   : {}),
      ...(utmCampaign ? { utmCampaign } : {}),
    },
  });
  return NextResponse.json({ ok: true });
}
