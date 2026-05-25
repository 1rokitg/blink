import { NextResponse } from "next/server";

import { checkBotId } from "botid/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@acme/db/client";
import { ReferralCode } from "@acme/db/schema";

export const runtime = "nodejs";

const FOUNDER_WALLET = "0xc7bcb2eee9bbfbf875499960746bc52b2e1a75c6";
const FOUNDER_REFERRAL_CODE = "rokitg";

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
  const verification = await checkBotId();
  if (verification.isBot) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { walletAddress, code: preferredCode } = parsed.data;
  const wallet = walletAddress.toLowerCase();
  const isFounderWallet = wallet === FOUNDER_WALLET;

  // Already has a code → return it
  const existing = await db
    .select()
    .from(ReferralCode)
    .where(eq(ReferralCode.walletAddress, wallet))
    .limit(1);

  if (existing[0]) {
    if (isFounderWallet && existing[0].code !== FOUNDER_REFERRAL_CODE) {
      const founderCodeOwner = await db
        .select({ walletAddress: ReferralCode.walletAddress })
        .from(ReferralCode)
        .where(eq(ReferralCode.code, FOUNDER_REFERRAL_CODE))
        .limit(1);

      if (founderCodeOwner[0] && founderCodeOwner[0].walletAddress !== wallet) {
        return NextResponse.json(
          { error: "Founder referral code is currently assigned to another wallet." },
          { status: 409 },
        );
      }

      await db
        .update(ReferralCode)
        .set({ code: FOUNDER_REFERRAL_CODE })
        .where(eq(ReferralCode.walletAddress, wallet));

      return NextResponse.json({ code: FOUNDER_REFERRAL_CODE, created: false });
    }

    return NextResponse.json({ code: existing[0].code, created: false });
  }

  // Pick the code slug
  const slug =
    (isFounderWallet
      ? FOUNDER_REFERRAL_CODE
      : preferredCode?.toLowerCase()) ??
    `${wallet.slice(2, 6)}${wallet.slice(-4)}`.toLowerCase();

  // Check if slug is taken
  const taken = await db
    .select({ id: ReferralCode.id, walletAddress: ReferralCode.walletAddress })
    .from(ReferralCode)
    .where(eq(ReferralCode.code, slug))
    .limit(1);

  if (isFounderWallet && taken[0] && taken[0].walletAddress !== wallet) {
    return NextResponse.json(
      { error: "Founder referral code is currently assigned to another wallet." },
      { status: 409 },
    );
  }

  const finalSlug = taken.length > 0
    ? isFounderWallet
      ? FOUNDER_REFERRAL_CODE
      : `${slug}-${wallet.slice(-3)}` // append suffix to de-conflict
    : slug;

  await db.insert(ReferralCode).values({ walletAddress: wallet, code: finalSlug });

  return NextResponse.json({ code: finalSlug, created: true });
}
