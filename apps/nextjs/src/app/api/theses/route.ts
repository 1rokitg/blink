import { NextResponse } from "next/server";

import { checkBotId } from "botid/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@acme/db/client";
import { PositionThesis } from "@acme/db/schema";

export const runtime = "nodejs";

const walletSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/);

const upsertSchema = z.object({
  walletAddress: walletSchema,
  coin: z.string().min(1).max(64),
  thesis: z.string().trim().min(2).max(240),
  side: z.enum(["long", "short"]).optional(),
  entryPrice: z.number().positive().optional(),
});

const deleteSchema = z.object({
  walletAddress: walletSchema,
  coin: z.string().min(1).max(64),
});

function normalizeCoin(value: string) {
  return value.trim();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address")?.toLowerCase();

  if (!address || !walletSchema.safeParse(address).success) {
    return NextResponse.json({ error: "Missing address" }, { status: 400 });
  }

  const activeCoins = (searchParams.get("activeCoins") ?? "")
    .split(",")
    .map((coin) => normalizeCoin(coin))
    .filter(Boolean);
  const activeCoinSet = new Set(activeCoins);

  const rows = await db
    .select()
    .from(PositionThesis)
    .where(eq(PositionThesis.walletAddress, address));

  const staleOpenRows =
    activeCoinSet.size === 0
      ? rows.filter((row) => row.status === "open")
      : rows.filter(
          (row) => row.status === "open" && !activeCoinSet.has(row.coin),
        );

  if (staleOpenRows.length > 0) {
    await Promise.all(
      staleOpenRows.map((row) =>
        db
          .update(PositionThesis)
          .set({
            closedAt: new Date(),
            status: "closed",
            updatedAt: new Date(),
          })
          .where(eq(PositionThesis.id, row.id)),
      ),
    );
  }

  const openRows = rows
    .filter(
      (row) =>
        row.status === "open" &&
        (activeCoinSet.size === 0 || activeCoinSet.has(row.coin)),
    )
    .map((row) => ({
      coin: row.coin,
      createdAt: row.createdAt,
      entryPrice: row.entryPrice,
      side: row.side,
      thesis: row.thesis,
      updatedAt: row.updatedAt,
      walletAddress: row.walletAddress,
    }));

  return NextResponse.json({ theses: openRows });
}

export async function POST(request: Request) {
  const verification = await checkBotId();
  if (verification.isBot) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const walletAddress = parsed.data.walletAddress.toLowerCase();
  const coin = normalizeCoin(parsed.data.coin);
  const now = new Date();

  await db
    .insert(PositionThesis)
    .values({
      walletAddress,
      coin,
      thesis: parsed.data.thesis,
      side: parsed.data.side,
      entryPrice: parsed.data.entryPrice,
      status: "open",
      closedAt: null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [PositionThesis.walletAddress, PositionThesis.coin],
      set: {
        thesis: parsed.data.thesis,
        side: parsed.data.side,
        entryPrice: parsed.data.entryPrice,
        status: "open",
        closedAt: null,
        updatedAt: now,
      },
    });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const verification = await checkBotId();
  if (verification.isBot) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  await db
    .update(PositionThesis)
    .set({
      closedAt: new Date(),
      status: "closed",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(
          PositionThesis.walletAddress,
          parsed.data.walletAddress.toLowerCase(),
        ),
        eq(PositionThesis.coin, normalizeCoin(parsed.data.coin)),
      ),
    );

  return NextResponse.json({ ok: true });
}
