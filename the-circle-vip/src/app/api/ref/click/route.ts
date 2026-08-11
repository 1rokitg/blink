import { NextResponse } from "next/server";
import { z } from "zod";

import { recordAffiliateClick } from "@/lib/affiliates.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  code: z.string().trim().min(2).max(32),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid code." }, { status: 400 });
  }

  try {
    const affiliate = await recordAffiliateClick(parsed.data.code);
    if (!affiliate) {
      return NextResponse.json({ ok: false, tracked: false });
    }
    return NextResponse.json({
      ok: true,
      tracked: true,
      code: affiliate.code,
    });
  } catch (error) {
    console.error("[ref/click]", error);
    return NextResponse.json({ ok: false, tracked: false }, { status: 200 });
  }
}

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code") ?? "";
  const parsed = schema.safeParse({ code });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid code." }, { status: 400 });
  }
  try {
    const affiliate = await recordAffiliateClick(parsed.data.code);
    return NextResponse.json({
      ok: Boolean(affiliate),
      tracked: Boolean(affiliate),
      code: affiliate?.code ?? null,
    });
  } catch {
    return NextResponse.json({ ok: false, tracked: false });
  }
}
