import { NextResponse } from "next/server";

import { desc, eq } from "drizzle-orm";

import { db } from "@acme/db/client";
import { Referral, ReferralCode } from "@acme/db/schema";

export const runtime = "nodejs";

/**
 * GET /api/referrals/lookup?address=0x...
 *
 * Returns the full referral record for a given wallet — who referred them,
 * when, and which code was used. Designed for retroactive campaign queries
 * and admin tooling.
 *
 * Also returns all wallets this address has referred (outbound).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address")?.toLowerCase();

  if (!address) {
    return NextResponse.json({ error: "Missing address" }, { status: 400 });
  }

  const [inbound, outbound, codeRow] = await Promise.all([
    // Who referred this wallet?
    db
      .select()
      .from(Referral)
      .where(eq(Referral.referredAddress, address))
      .limit(1),

    // Who has this wallet referred?
    db
      .select()
      .from(Referral)
      .where(eq(Referral.referrerAddress, address))
      .orderBy(desc(Referral.createdAt)),

    // Their own referral code
    db
      .select()
      .from(ReferralCode)
      .where(eq(ReferralCode.walletAddress, address))
      .limit(1),
  ]);

  return NextResponse.json({
    address,
    referredBy: inbound[0]
      ? {
          referrerAddress: inbound[0].referrerAddress,
          code: inbound[0].code,
          claimedAt: inbound[0].createdAt,
        }
      : null,
    referralCode: codeRow[0]?.code ?? null,
    referred: outbound.map((r) => ({
      address: r.referredAddress,
      code: r.code,
      joinedAt: r.createdAt,
    })),
    referredCount: outbound.length,
  });
}
