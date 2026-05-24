import { NextResponse } from "next/server";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@acme/db/client";
import { ReferralCode } from "@acme/db/schema";

export const runtime = "nodejs";

const bodySchema = z.object({
  walletAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  /** Preferred code slug — defaults to first 8 chars of wallet if omitted */
  code: z.string().min(3).max(32).regex(/^[a-zA-Z0-9._-]+$/).optional(),
});

/**
 * POST /api/referrals/code
 * Upserts a referral code for a wallet.
 * If the wallet already has a code, returns it.
 * If a custom code is provided and not taken, uses that.
 * Otherwise generates one from the wallet address.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { walletAddress, code: preferredCode } = parsed.data;
  const wallet = walletAddress.toLowerCase();

  // Already has a code → return it
  const existing = await db
    .select()
    .from(ReferralCode)
    .where(eq(ReferralCode.walletAddress, wallet))
    .limit(1);

  if (existing[0]) {
    return NextResponse.json({ code: existing[0].code, created: false });
  }

  // Pick the code slug
  const slug =
    preferredCode?.toLowerCase() ??
    `${wallet.slice(2, 6)}${wallet.slice(-4)}`.toLowerCase();

  // Check if slug is taken
  const taken = await db
    .select({ id: ReferralCode.id })
    .from(ReferralCode)
    .where(eq(ReferralCode.code, slug))
    .limit(1);

  const finalSlug = taken.length > 0
    ? `${slug}-${wallet.slice(-3)}` // append suffix to de-conflict
    : slug;

  await db.insert(ReferralCode).values({ walletAddress: wallet, code: finalSlug });

  return NextResponse.json({ code: finalSlug, created: true });
}
