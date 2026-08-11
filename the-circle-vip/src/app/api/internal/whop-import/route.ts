import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  INTERNAL_SESSION_COOKIE,
  readInternalSession,
} from "@/lib/internal-auth";
import { runWhopImport } from "@/lib/whop-import.server";
import { syncWhopPersonsToPeople } from "@/lib/whop-persons-sync.server";
import {
  getWhopStripeTotals,
  listWhopMembersFromStripe,
  listWhopPaymentsFromStripe,
} from "@/lib/whop-stripe.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function requireApiSession() {
  const jar = await cookies();
  return readInternalSession(jar.get(INTERNAL_SESSION_COOKIE)?.value);
}

/** Stripe is the source of truth for Whop-migrated customers + paid history. */
export async function GET() {
  const session = await requireApiSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [totals, members, payments] = await Promise.all([
    getWhopStripeTotals(),
    listWhopMembersFromStripe(100),
    listWhopPaymentsFromStripe(100),
  ]);

  return NextResponse.json({
    sourceOfTruth: "stripe",
    counts: totals,
    members: members.slice(0, 50),
    payments: payments.slice(0, 50),
  });
}

const postSchema = z.object({
  action: z.enum(["import_stripe", "sync_persons"]).optional(),
  dryRun: z.boolean().optional(),
  /** One-time migration into Stripe. Defaults false — prefer reading Stripe. */
  syncStripe: z.boolean().optional(),
});

export async function POST(request: Request) {
  const session = await requireApiSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const action = parsed.data.action ?? "import_stripe";

  try {
    if (action === "sync_persons") {
      const result = await syncWhopPersonsToPeople({
        dryRun: parsed.data.dryRun,
        updatedBy: session.username,
      });
      return NextResponse.json({
        ok: result.ok,
        action: "sync_persons",
        result,
      });
    }

    // Migration writes INTO Stripe only. Dashboard reads always come from Stripe.
    const result = await runWhopImport({
      dryRun: parsed.data.dryRun,
      syncStripe: parsed.data.syncStripe !== false,
      createdBy: session.username,
    });
    const totals = await getWhopStripeTotals();
    return NextResponse.json({
      ok: result.ok,
      action: "import_stripe",
      sourceOfTruth: "stripe",
      result,
      stripe: totals,
    });
  } catch (error) {
    console.error("[whop-import]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Whop import failed.",
      },
      { status: 500 },
    );
  }
}
