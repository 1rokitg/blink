import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getEmailBoard } from "@/lib/email-board.server";
import { sendTestEmail } from "@/lib/email.server";
import {
  INTERNAL_SESSION_COOKIE,
  readInternalSession,
} from "@/lib/internal-auth";
import { importProprLeads } from "@/lib/propr-leads.server";
import { importSubstackLeads } from "@/lib/substack-leads.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireApiSession() {
  const jar = await cookies();
  return readInternalSession(jar.get(INTERNAL_SESSION_COOKIE)?.value);
}

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("test_send"),
    campaignId: z.enum([
      "whop_migration",
      "circle_convert",
      "store_convert",
      "propr_intro",
      "substack_convert",
    ]),
    senderId: z.enum(["info", "members", "hello"]).optional(),
    to: z.string().trim().email().max(254),
  }),
  z.object({
    action: z.literal("import_propr"),
  }),
  z.object({
    action: z.literal("import_substack"),
  }),
]);

export async function GET() {
  const session = await requireApiSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const board = await getEmailBoard();
  return NextResponse.json({ board });
}

export async function POST(request: Request) {
  const session = await requireApiSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  try {
    if (parsed.data.action === "import_propr") {
      const result = await importProprLeads();
      return NextResponse.json(result);
    }
    if (parsed.data.action === "import_substack") {
      const result = await importSubstackLeads();
      return NextResponse.json(result);
    }

    const result = await sendTestEmail({
      to: parsed.data.to,
      campaignId: parsed.data.campaignId,
      senderId: parsed.data.senderId,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, id: result.id });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Email action failed.",
      },
      { status: 400 },
    );
  }
}
