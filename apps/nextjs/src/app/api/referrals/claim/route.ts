import { NextResponse } from "next/server";

import { checkBotId } from "botid/server";
import { count, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@acme/db/client";
import { Referral, ReferralCode } from "@acme/db/schema";
import { trackMetricEvent } from "~/lib/blink/internal-metrics.server";

export const runtime = "nodejs";

const bodySchema = z.object({
  /** The wallet that was referred (the new user). */
  referredAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  /** The referral code that was used. */
  code: z.string().min(1),
});

/**
 * POST /api/referrals/claim
 * Records a referral relationship.
 * Safe to call multiple times — idempotent (referredAddress is unique).
 */
export async function POST(request: Request) {
  const verification = await checkBotId();
  if (verification.isBot) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { referredAddress, code } = parsed.data;
  const referred = referredAddress.toLowerCase();
  const slug = code.toLowerCase();

  // Resolve referrer from code
  const codeRow = await db
    .select()
    .from(ReferralCode)
    .where(eq(ReferralCode.code, slug))
    .limit(1);

  if (!codeRow[0]) {
    return NextResponse.json({ error: "Invalid referral code" }, { status: 404 });
  }

  const referrer = codeRow[0].walletAddress;

  // Can't refer yourself
  if (referrer === referred) {
    return NextResponse.json({ error: "Cannot refer yourself" }, { status: 400 });
  }

  // ── Hard cap: max 10 referrals per referrer ──────────────────────────────
  const [countRow] = await db
    .select({ total: count() })
    .from(Referral)
    .where(eq(Referral.referrerAddress, referrer));

  if ((countRow?.total ?? 0) >= 10) {
    return NextResponse.json({ error: "Referral limit reached" }, { status: 429 });
  }

  // Idempotent upsert — referredAddress has a UNIQUE constraint
  const existing = await db
    .select({ id: Referral.id })
    .from(Referral)
    .where(eq(Referral.referredAddress, referred))
    .limit(1);

  if (existing[0]) {
    // Already claimed — not an error, just a no-op
    return NextResponse.json({ status: "already_claimed" });
  }

  await db.insert(Referral).values({
    referrerAddress: referrer,
    referredAddress: referred,
    code: slug,
  });

  await trackMetricEvent({
    eventType: "referral_claimed",
    walletAddress: referred,
    source: "referral",
    metadata: {
      referrerAddress: referrer,
      code: slug,
    },
  });

  return NextResponse.json({ status: "claimed", referrer });
}
