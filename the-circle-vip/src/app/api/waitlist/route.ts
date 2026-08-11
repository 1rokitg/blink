import { NextResponse } from "next/server";
import { z } from "zod";

import {
  sanitizeAttribution,
  type Attribution,
} from "@/lib/attribution";
import { captureWaitlistEmail } from "@/lib/leads.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const attributionSchema = z
  .object({
    channel: z.string().trim().max(64).optional(),
    utmSource: z.string().trim().max(64).optional().nullable(),
    utmMedium: z.string().trim().max(64).optional().nullable(),
    utmCampaign: z.string().trim().max(128).optional().nullable(),
    utmContent: z.string().trim().max(128).optional().nullable(),
    utmTerm: z.string().trim().max(128).optional().nullable(),
    referrer: z.string().trim().max(240).optional().nullable(),
    capturedAt: z.string().trim().max(40).optional().nullable(),
  })
  .optional()
  .nullable();

const bodySchema = z.object({
  email: z.string().trim().email().max(254),
  /** Honeypot — bots fill this; humans leave empty. */
  company: z.string().max(120).optional(),
  source: z.string().trim().max(64).optional(),
  attribution: attributionSchema,
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 },
    );
  }

  // Silent success for honeypot fills — don't tip off scrapers.
  if (parsed.data.company?.trim()) {
    return NextResponse.json({ ok: true });
  }

  const attribution = sanitizeAttribution(
    (parsed.data.attribution ?? null) as Partial<Attribution> | null,
  );

  try {
    const result = await captureWaitlistEmail({
      email: parsed.data.email,
      source: parsed.data.source || "landing",
      channel: attribution?.channel ?? null,
      utmSource: attribution?.utmSource ?? null,
      utmMedium: attribution?.utmMedium ?? null,
      utmCampaign: attribution?.utmCampaign ?? null,
      referrer: attribution?.referrer ?? null,
      note: "Marketing landing email capture",
    });
    return NextResponse.json({
      ok: true,
      created: result.created,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not save your email. Try again.",
      },
      { status: 400 },
    );
  }
}
