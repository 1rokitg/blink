import { NextResponse } from "next/server";
import { z } from "zod";

import {
  recordAffiliateConversion,
  recordAffiliateSignup,
} from "@/lib/affiliates.server";
import {
  sanitizeAttribution,
  type Attribution,
} from "@/lib/attribution";
import { recordCryptoPaymentAnalytics } from "@/lib/crypto-analytics.server";
import {
  findPaymentByTx,
  indexRecentCryptoPayment,
  recordPayment,
  verifyCryptoPayment,
} from "@/lib/crypto-verify.server";
import { CRYPTO_CHAIN_ORDER } from "@/lib/crypto-payments";
import { getPlan, type PlanId } from "@/lib/plans";
import { getPlansFromStripe } from "@/lib/stripe-catalog";
import { createVipInviteLink } from "@/lib/telegram";
import { getTelegramSession } from "@/lib/telegram-session";

export const runtime = "nodejs";

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

const schema = z.object({
  planId: z.enum(["month", "quarter", "year"]),
  chainId: z.enum(["ethereum", "base", "arbitrum", "solana"]),
  txHash: z.string().trim().min(32).max(128),
  telegramUsername: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^@?[a-zA-Z0-9_]{2,64}$/)
    .optional(),
  referralCode: z.string().trim().max(64).optional(),
  walletAddress: z.string().trim().min(4).max(128).optional(),
  walletBrand: z.string().trim().min(1).max(64).optional(),
  attribution: attributionSchema,
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid crypto payment payload." },
      { status: 400 },
    );
  }

  if (!CRYPTO_CHAIN_ORDER.includes(parsed.data.chainId)) {
    return NextResponse.json({ error: "Unsupported chain." }, { status: 400 });
  }

  const catalog = await getPlansFromStripe();
  const plan = getPlan(parsed.data.planId as PlanId, catalog);
  if (!plan) {
    return NextResponse.json({ error: "Unknown plan." }, { status: 400 });
  }

  const sessionTelegram = await getTelegramSession();
  const manualUsername = parsed.data.telegramUsername
    ?.trim()
    .replace(/^@/, "");

  const telegram = sessionTelegram
    ? {
        id: sessionTelegram.id,
        username:
          sessionTelegram.username ||
          sessionTelegram.firstName ||
          sessionTelegram.id,
      }
    : manualUsername
      ? {
          id: `manual:${manualUsername.toLowerCase()}`,
          username: manualUsername,
        }
      : {
          id: `guest:${parsed.data.txHash.slice(0, 16).toLowerCase()}`,
          username: "guest",
        };

  const existing = await findPaymentByTx(parsed.data.txHash);
  if (existing) {
    // Re-index so Monetise always sees historical verifies.
    await indexRecentCryptoPayment({
      ...existing,
      fromAddress:
        existing.fromAddress || parsed.data.walletAddress || null,
      walletBrand: existing.walletBrand || parsed.data.walletBrand || null,
    });
    return NextResponse.json({
      ok: true,
      alreadyProcessed: true,
      inviteLink: existing.inviteLink,
      redirectTo: existing.inviteLink
        ? `/success?crypto=1&invite=${encodeURIComponent(existing.inviteLink)}`
        : `/success?crypto=1`,
    });
  }

  try {
    const verified = await verifyCryptoPayment({
      chainId: parsed.data.chainId,
      txHash: parsed.data.txHash.trim(),
      expectedAmountUsdc: plan.amountUsd,
    });

    if (!verified.ok) {
      return NextResponse.json({ error: verified.error }, { status: 400 });
    }

    const label = (
      telegram.username !== "guest" ? telegram.username : plan.id
    ).slice(0, 32);
    const { inviteLink } = await createVipInviteLink(label);

    const fromAddress =
      ("fromAddress" in verified ? verified.fromAddress : null) ||
      parsed.data.walletAddress ||
      null;

    const attribution = sanitizeAttribution(
      parsed.data.attribution as Partial<Attribution> | null | undefined,
    );

    const payment = {
      txHash: parsed.data.txHash.trim(),
      chainId: parsed.data.chainId,
      planId: plan.id,
      amountUsdc: plan.amountUsd,
      telegramUserId: telegram.id,
      telegramUsername: telegram.username,
      inviteLink,
      createdAt: new Date().toISOString(),
      fromAddress,
      walletBrand: parsed.data.walletBrand ?? null,
      channel: attribution?.channel ?? null,
      utmSource: attribution?.utmSource ?? null,
      utmCampaign: attribution?.utmCampaign ?? null,
    };

    await recordPayment(payment);
    await recordCryptoPaymentAnalytics(payment);

    const referralCode = parsed.data.referralCode?.trim();
    if (referralCode) {
      try {
        const signup = await recordAffiliateSignup(referralCode);
        if (signup) {
          await recordAffiliateConversion({
            code: referralCode,
            amountUsd: plan.amountUsd,
          });
        }
      } catch (error) {
        console.error("[crypto verify] affiliate attribution", error);
      }
    }

    const redirectTo = inviteLink
      ? `/success?crypto=1&invite=${encodeURIComponent(inviteLink)}&plan=${plan.id}`
      : `/success?crypto=1&plan=${plan.id}`;

    return NextResponse.json({
      ok: true,
      inviteLink,
      redirectTo,
      amountUsdc: plan.amountUsd,
      chainId: parsed.data.chainId,
      fromAddress,
    });
  } catch (error) {
    console.error("[crypto verify]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not verify crypto payment.",
      },
      { status: 500 },
    );
  }
}
