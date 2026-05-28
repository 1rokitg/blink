import { NextResponse } from "next/server";

import { and, eq, inArray } from "drizzle-orm";

import { db } from "@acme/db/client";
import {
  BuilderApproval,
  MetricEvent,
  Referral,
  ReferralCode,
  TwitterConnection,
} from "@acme/db/schema";
import {
  getAffiliateProfile,
  isAffiliateWallet,
} from "~/lib/blink/affiliate-program";
import { BLINK_WEB_AGENT_NAME } from "~/lib/blink/blink-agent";

export const runtime = "nodejs";

type ReferredRow = {
  walletAddress: string;
  joinedAt: string;
  code: string;
  builderApproved: boolean;
  firstTrade: boolean;
  proStarted: boolean;
  signupSource: string | null;
  signupCountry: string | null;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address")?.toLowerCase();

  if (!address) {
    return NextResponse.json({ error: "Missing address" }, { status: 400 });
  }

  if (!isAffiliateWallet(address)) {
    return NextResponse.json(
      { error: "Wallet is not in affiliate program", reason: "not_affiliate" },
      { status: 403 },
    );
  }

  const profile = getAffiliateProfile(address);
  if (!profile) {
    return NextResponse.json(
      { error: "Affiliate profile unavailable", reason: "profile_missing" },
      { status: 404 },
    );
  }

  const [twitterConnection, codeRow, referrals] = await Promise.all([
    db
      .select({
        connectedAt: TwitterConnection.connectedAt,
        twitterUsername: TwitterConnection.twitterUsername,
      })
      .from(TwitterConnection)
      .where(eq(TwitterConnection.walletAddress, address))
      .limit(1),
    db
      .select({ code: ReferralCode.code })
      .from(ReferralCode)
      .where(eq(ReferralCode.walletAddress, address))
      .limit(1),
    db
      .select({
        code: Referral.code,
        createdAt: Referral.createdAt,
        referredAddress: Referral.referredAddress,
      })
      .from(Referral)
      .where(eq(Referral.referrerAddress, address)),
  ]);

  if (!twitterConnection[0]) {
    return NextResponse.json(
      {
        error: "Affiliate wallet must be verified first",
        reason: "not_verified",
      },
      { status: 403 },
    );
  }

  const referredWallets = referrals.map((row) =>
    row.referredAddress.toLowerCase(),
  );

  let builderApprovedSet = new Set<string>();
  let firstTradeSet = new Set<string>();
  let proStartedSet = new Set<string>();
  let signupByWallet = new Map<
    string,
    { source: string | null; country: string | null }
  >();

  if (referredWallets.length > 0) {
    const [approvals, firstTradeRows, proRows, signupRows] = await Promise.all([
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
      db
        .select({
          createdAt: MetricEvent.createdAt,
          metadata: MetricEvent.metadata,
          source: MetricEvent.source,
          walletAddress: MetricEvent.walletAddress,
        })
        .from(MetricEvent)
        .where(
          and(
            inArray(MetricEvent.walletAddress, referredWallets),
            eq(MetricEvent.eventType, "signup"),
          ),
        ),
    ]);

    builderApprovedSet = new Set(
      approvals.map((row) => row.walletAddress.toLowerCase()),
    );
    firstTradeSet = new Set(
      firstTradeRows
        .map((row) => row.walletAddress)
        .filter((wallet): wallet is string => Boolean(wallet))
        .map((wallet) => wallet.toLowerCase()),
    );
    proStartedSet = new Set(
      proRows
        .map((row) => row.walletAddress)
        .filter((wallet): wallet is string => Boolean(wallet))
        .map((wallet) => wallet.toLowerCase()),
    );

    signupByWallet = signupRows
      .sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
      )
      .reduce((map, row) => {
        const wallet = row.walletAddress?.toLowerCase();
        if (!wallet || map.has(wallet)) return map;
        const metadata = (row.metadata ?? {}) as Record<string, unknown>;
        map.set(wallet, {
          source: row.source ? String(row.source) : null,
          country:
            typeof metadata.country === "string" ? metadata.country : null,
        });
        return map;
      }, new Map<string, { source: string | null; country: string | null }>());
  }

  const referredUsers: ReferredRow[] = referrals
    .map((row) => {
      const walletAddress = row.referredAddress.toLowerCase();
      const signup = signupByWallet.get(walletAddress);

      return {
        walletAddress,
        joinedAt: row.createdAt.toISOString(),
        code: row.code,
        builderApproved: builderApprovedSet.has(walletAddress),
        firstTrade: firstTradeSet.has(walletAddress),
        proStarted: proStartedSet.has(walletAddress),
        signupSource: signup?.source ?? null,
        signupCountry: signup?.country ?? null,
      };
    })
    .sort((left, right) => right.joinedAt.localeCompare(left.joinedAt));

  const metrics = {
    referrals: referredUsers.length,
    builderApproved: referredUsers.filter((row) => row.builderApproved).length,
    firstTrade: referredUsers.filter((row) => row.firstTrade).length,
    proStarted: referredUsers.filter((row) => row.proStarted).length,
  };

  const conversion = {
    approvalToTradePct:
      metrics.builderApproved > 0
        ? (metrics.firstTrade / metrics.builderApproved) * 100
        : 0,
    signupToApprovalPct:
      metrics.referrals > 0
        ? (metrics.builderApproved / metrics.referrals) * 100
        : 0,
    signupToTradePct:
      metrics.referrals > 0
        ? (metrics.firstTrade / metrics.referrals) * 100
        : 0,
    tradeToProPct:
      metrics.firstTrade > 0
        ? (metrics.proStarted / metrics.firstTrade) * 100
        : 0,
  };

  return NextResponse.json({
    affiliate: {
      ...profile,
      code: codeRow[0]?.code ?? profile.boostedCode,
      verifiedAt: twitterConnection[0].connectedAt.toISOString(),
      verifiedUsername: twitterConnection[0].twitterUsername,
      walletAddress: address,
    },
    conversion,
    metrics,
    referredUsers,
  });
}
