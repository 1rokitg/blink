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

  const headers = request.headers;
  const country =
    headers.get("x-vercel-ip-country") ??
    headers.get("cf-ipcountry") ??
    "unknown";
  const referer = headers.get("referer") ?? "";
  const host = referer
    ? (() => {
        try {
          return new URL(referer).hostname.toLowerCase();
        } catch {
          return "unknown";
        }
      })()
    : "direct";
  await trackMetricEvent({
    ...parsed.data,
    source: parsed.data.source ?? host,
    metadata: {
      ...(parsed.data.metadata ?? {}),
      country,
      referer,
    },
  });
  return NextResponse.json({ ok: true });
}
