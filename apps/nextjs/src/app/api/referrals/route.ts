import { NextResponse } from "next/server";

import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@acme/db/client";
import { Referral, ReferralCode } from "@acme/db/schema";

export const runtime = "nodejs";

/**
 * GET /api/referrals?address=0x...
 * Returns a user's referral code + list of people they referred.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address")?.toLowerCase();

  if (!address) {
    return NextResponse.json({ error: "Missing address" }, { status: 400 });
  }

  const [codeRow, referrals] = await Promise.all([
    db
      .select()
      .from(ReferralCode)
      .where(eq(ReferralCode.walletAddress, address))
      .limit(1),

    db
      .select()
      .from(Referral)
      .where(eq(Referral.referrerAddress, address))
      .orderBy(desc(Referral.createdAt)),
  ]);

  return NextResponse.json({
    code: codeRow[0]?.code ?? null,
    referrals: referrals.map((r) => ({
      address: r.referredAddress,
      joinedAt: r.createdAt,
    })),
    count: referrals.length,
  });
}
