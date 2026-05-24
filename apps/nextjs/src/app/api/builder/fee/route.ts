import { NextResponse } from "next/server";

import { z } from "zod";

import { getBuilderFeeUnitsForWallet } from "~/lib/blink/membership.server";

export const runtime = "nodejs";

const querySchema = z.object({
  wallet: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  market: z.string().min(2).max(16).optional(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    wallet: searchParams.get("wallet"),
    market: searchParams.get("market") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid wallet address" },
      { status: 400 },
    );
  }

  const { wallet, market } = parsed.data;
  const resolved = await getBuilderFeeUnitsForWallet(wallet, market);

  return NextResponse.json({
    wallet: wallet.toLowerCase(),
    market: market?.toUpperCase() ?? null,
    feeUnits: resolved.feeUnits,
    isPro: resolved.isPro,
  });
}
