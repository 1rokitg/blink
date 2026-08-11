import { NextResponse } from "next/server";

import { listRecentCryptoPayments } from "@/lib/crypto-verify.server";
import { CRYPTO_CHAINS, type CryptoChainId } from "@/lib/crypto-payments";
import { FALLBACK_PLANS, type PlanId } from "@/lib/plans";
import { listAllStripePayments } from "@/lib/whop-stripe.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const rail = new URL(request.url).searchParams.get("rail");

  if (
    rail === "stripe" ||
    rail === "whop" ||
    rail === "stripe-whop" ||
    rail === "stripe-payments"
  ) {
    const payments = await listAllStripePayments(300);
    const revenueUsd = payments.reduce((sum, row) => sum + row.amountUsd, 0);
    const customers = new Set(
      payments.map((row) => row.customerId).filter(Boolean),
    );
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      sourceOfTruth: "stripe",
      rail: "stripe-payments",
      label: "Stripe Payments",
      totals: {
        paid: payments.length,
        revenueUsd,
        members: customers.size,
      },
      payments,
    });
  }

  const rows = await listRecentCryptoPayments(200);
  const payments = rows.map((payment) => {
    const chain =
      payment.chainId in CRYPTO_CHAINS
        ? CRYPTO_CHAINS[payment.chainId as CryptoChainId]
        : null;
    const planLabel =
      payment.planId in FALLBACK_PLANS
        ? FALLBACK_PLANS[payment.planId as PlanId].label
        : payment.planId;

    return {
      txHash: payment.txHash,
      chainId: payment.chainId,
      chainLabel: chain?.label ?? payment.chainId,
      explorerUrl: payment.explorerUrl || chain?.explorerTx(payment.txHash) || null,
      planId: payment.planId,
      planLabel,
      amountUsdc: payment.amountUsdc,
      walletAddress: payment.fromAddress ?? null,
      walletBrand: payment.walletBrand ?? null,
      telegramUsername: payment.telegramUsername,
      telegramUserId: payment.telegramUserId,
      inviteLink: payment.inviteLink,
      createdAt: payment.createdAt,
      email: payment.email ?? null,
      name: payment.name ?? null,
      preferredPaymentMethod: payment.preferredPaymentMethod ?? "crypto",
      stripeCustomerId: payment.stripeCustomerId ?? null,
      stripeSubscriptionId: payment.stripeSubscriptionId ?? null,
      stripeInvoiceId: payment.stripeInvoiceId ?? null,
      accessEndsAt: payment.accessEndsAt ?? null,
    };
  });

  const revenueUsdc = payments.reduce((sum, row) => sum + row.amountUsdc, 0);

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    totals: {
      paid: payments.length,
      revenueUsdc,
    },
    payments,
  });
}
