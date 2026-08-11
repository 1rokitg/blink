import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createStorePromo,
  getStoreCatalog,
  setStorePrice,
  updateStoreProduct,
} from "@/lib/store-config.server";
import { PLAN_ORDER } from "@/lib/plans";
import { getInternalDashboardStats } from "@/lib/internal-stats.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const stats = await getInternalDashboardStats();
  return NextResponse.json({ store: stats.store, generatedAt: stats.generatedAt });
}

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("update_product"),
    planId: z.enum(["month", "quarter", "year"]),
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(500).optional(),
  }),
  z.object({
    action: z.literal("set_price"),
    planId: z.enum(["month", "quarter", "year"]),
    amountUsd: z.number().min(1).max(100_000),
  }),
  z.object({
    action: z.literal("create_promo"),
    code: z.string().trim().min(3).max(32),
    amountOffUsd: z.number().min(1).max(10_000),
  }),
]);

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid store payload." }, { status: 400 });
  }

  try {
    if (parsed.data.action === "update_product") {
      const product = await updateStoreProduct(parsed.data);
      const store = await getStoreCatalog();
      return NextResponse.json({ ok: true, productId: product.id, store });
    }
    if (parsed.data.action === "set_price") {
      if (!PLAN_ORDER.includes(parsed.data.planId)) {
        return NextResponse.json({ error: "Unknown plan." }, { status: 400 });
      }
      const result = await setStorePrice(parsed.data);
      const store = await getStoreCatalog();
      return NextResponse.json({ ok: true, ...result, store });
    }
    const promo = await createStorePromo(parsed.data);
    return NextResponse.json({ ok: true, ...promo });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Store update failed.",
      },
      { status: 500 },
    );
  }
}
