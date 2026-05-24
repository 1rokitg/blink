import { NextResponse } from "next/server";

import { z } from "zod";

import { getBuilderFeeUnitsForWallet } from "~/lib/blink/membership.server";

export const runtime = "nodejs";

const querySchema = z.object({
  wallet: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    wallet: searchParams.get("wallet"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }

  const { wallet } = parsed.data;
  const resolved = await getBuilderFeeUnitsForWallet(wallet);

  return NextResponse.json({
    wallet: wallet.toLowerCase(),
    feeUnits: resolved.feeUnits,
    isPro: resolved.isPro,
  });
}

