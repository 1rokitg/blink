import { NextResponse } from "next/server";
import { z } from "zod";

import { grantCryptoMembership } from "@/lib/crypto-membership.server";
import {
  addManualMember,
  refreshMemberInvite,
  revokeMembership,
  transferMembership,
} from "@/lib/membership-admin.server";
import { getInternalDashboardStats } from "@/lib/internal-stats.server";
import { PLAN_ORDER } from "@/lib/plans";
import { getPaidTelegramWhitelist } from "@/lib/telegram-paid-whitelist.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [stats, paidTelegram] = await Promise.all([
    getInternalDashboardStats(),
    getPaidTelegramWhitelist(),
  ]);
  return NextResponse.json({
    members: stats.members,
    paidTelegramWhitelist: paidTelegram,
    stripeConfigured: stats.stripeConfigured,
    generatedAt: stats.generatedAt,
  });
}

const postSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("add"),
    planId: z.enum(["month", "quarter", "year"]),
    telegramUsername: z.string().trim().min(2).max(64),
    telegramUserId: z.string().trim().max(64).optional(),
    email: z.union([z.string().trim().email(), z.literal("")]).optional(),
    note: z.string().trim().max(200).optional(),
  }),
  z.object({
    action: z.literal("crypto_grant"),
    planId: z.enum(["month", "quarter", "year"]),
    email: z.string().trim().email().max(200),
    name: z.string().trim().min(1).max(120),
    telegramUsername: z.string().trim().min(2).max(64),
    telegramUserId: z.string().trim().max(64).optional(),
    discordUsername: z.string().trim().max(64).optional().nullable(),
    walletAddress: z.string().trim().min(8).max(128),
    walletBrand: z.string().trim().max(64).optional().nullable(),
    chainId: z.enum(["ethereum", "base", "arbitrum", "solana"]),
    txHash: z.string().trim().min(16).max(128),
    amountUsdc: z.number().positive().max(1_000_000),
    accessEndsAt: z.string().datetime().optional(),
    note: z.string().trim().max(500).optional(),
    skipChainVerify: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("transfer"),
    subscriptionId: z.string().trim().min(3),
    toTelegramUsername: z.string().trim().min(2).max(64),
    toTelegramUserId: z.string().trim().max(64).optional(),
  }),
  z.object({
    action: z.literal("revoke"),
    subscriptionId: z.string().trim().min(3),
    immediate: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("refresh_invite"),
    subscriptionId: z.string().trim().min(3),
  }),
]);

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid membership payload." },
      { status: 400 },
    );
  }

  try {
    if (parsed.data.action === "add") {
      if (!PLAN_ORDER.includes(parsed.data.planId)) {
        return NextResponse.json({ error: "Unknown plan." }, { status: 400 });
      }
      const result = await addManualMember({
        planId: parsed.data.planId,
        telegramUsername: parsed.data.telegramUsername,
        telegramUserId: parsed.data.telegramUserId,
        email: parsed.data.email || undefined,
        note: parsed.data.note,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    if (parsed.data.action === "crypto_grant") {
      const result = await grantCryptoMembership({
        planId: parsed.data.planId,
        email: parsed.data.email,
        name: parsed.data.name,
        telegramUsername: parsed.data.telegramUsername,
        telegramUserId: parsed.data.telegramUserId,
        discordUsername: parsed.data.discordUsername,
        walletAddress: parsed.data.walletAddress,
        walletBrand: parsed.data.walletBrand,
        chainId: parsed.data.chainId,
        txHash: parsed.data.txHash,
        amountUsdc: parsed.data.amountUsdc,
        accessEndsAt: parsed.data.accessEndsAt,
        note: parsed.data.note,
        skipChainVerify: parsed.data.skipChainVerify,
        updatedBy: "internal_memberships",
      });
      return NextResponse.json({ ok: true, ...result });
    }

    if (parsed.data.action === "transfer") {
      const result = await transferMembership({
        subscriptionId: parsed.data.subscriptionId,
        toTelegramUsername: parsed.data.toTelegramUsername,
        toTelegramUserId: parsed.data.toTelegramUserId,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    if (parsed.data.action === "revoke") {
      const result = await revokeMembership({
        subscriptionId: parsed.data.subscriptionId,
        immediate: parsed.data.immediate,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    const result = await refreshMemberInvite(parsed.data.subscriptionId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Membership update failed.",
      },
      { status: 500 },
    );
  }
}
