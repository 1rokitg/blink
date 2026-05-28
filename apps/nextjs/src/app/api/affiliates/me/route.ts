import { NextResponse } from "next/server";

import { and, eq, inArray } from "drizzle-orm";

import { db } from "@acme/db/client";
import { BuilderApproval, MetricEvent, Referral, ReferralCode } from "@acme/db/schema";

import { getAffiliateProfile, isAffiliateWallet } from "~/lib/blink/affiliate-program";
import { BLINK_WEB_AGENT_NAME } from "~/lib/blink/blink-agent";

export const runtime = "nodejs";

/**
 * GET /api/affiliates/me?address=0x...
 * Public-facing affiliate metrics surface for /rewards.
 * Only returns data for wallets in affiliate allowlist.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address")?.toLowerCase();

  if (!address) {
    return NextResponse.json({ error: "Missing address" }, { status: 400 });
  }

  if (!isAffiliateWallet(address)) {
    return NextResponse.json(
      { isAffiliate: false, error: "Wallet is not an affiliate" },
      { status: 403 },
    );
  }

  const profile = getAffiliateProfile(address);
  if (!profile) {
    return NextResponse.json({ isAffiliate: false }, { status: 404 });
  }

  const [codeRow, referrals] = await Promise.all([
    db
      .select()
      .from(ReferralCode)
      .where(eq(ReferralCode.walletAddress, address))
      .limit(1),
    db.select().from(Referral).where(eq(Referral.referrerAddress, address)),
  ]);

  const referredWallets = referrals.map((row) => row.referredAddress.toLowerCase());

  let builderApproved = 0;
  let firstTrade = 0;
  let proStarted = 0;

  if (referredWallets.length > 0) {
    const [approvals, firstTradeRows, proRows] = await Promise.all([
      db
        .select({ walletAddress: BuilderApproval.walletAddress })
        .from(BuilderApproval)
        .where(
          and(
            inArray(BuilderApproval.walletAddress, referredWallets),
            eq(BuilderApproval.agentName, BLINK_WEB_AGENT_NAME),
          ),
        ),
      db
        .select({ walletAddress: MetricEvent.walletAddress })
        .from(MetricEvent)
        .where(
          and(
            inArray(MetricEvent.walletAddress, referredWallets),
            eq(MetricEvent.eventType, "first_trade"),
          ),
        ),
      db
        .select({ walletAddress: MetricEvent.walletAddress })
        .from(MetricEvent)
        .where(
          and(
            inArray(MetricEvent.walletAddress, referredWallets),
            eq(MetricEvent.eventType, "pro_checkout_started"),
          ),
        ),
    ]);

    builderApproved = new Set(approvals.map((row) => row.walletAddress.toLowerCase())).size;
    firstTrade = new Set(
      firstTradeRows
        .map((row) => row.walletAddress)
        .filter((wallet): wallet is string => Boolean(wallet))
        .map((wallet) => wallet.toLowerCase()),
    ).size;
    proStarted = new Set(
      proRows
        .map((row) => row.walletAddress)
        .filter((wallet): wallet is string => Boolean(wallet))
        .map((wallet) => wallet.toLowerCase()),
    ).size;
  }

  const referralCount = referrals.length;
  const signupToApprovalPct =
    referralCount > 0 ? (builderApproved / referralCount) * 100 : 0;
  const approvalToTradePct =
    builderApproved > 0 ? (firstTrade / builderApproved) * 100 : 0;
  const signupToTradePct = referralCount > 0 ? (firstTrade / referralCount) * 100 : 0;
  const tradeToProPct = firstTrade > 0 ? (proStarted / firstTrade) * 100 : 0;

  return NextResponse.json({
    isAffiliate: true,
    profile,
    code: codeRow[0]?.code ?? profile.boostedCode,
    metrics: {
      referrals: referralCount,
      builderApproved,
      firstTrade,
      proStarted,
      signupToApprovalPct,
      approvalToTradePct,
      signupToTradePct,
      tradeToProPct,
    },
  });
}

