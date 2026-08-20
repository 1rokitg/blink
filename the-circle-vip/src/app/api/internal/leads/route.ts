import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createLead,
  listLeads,
  updateLeadStatus,
} from "@/lib/leads.server";
import {
  INTERNAL_SESSION_COOKIE,
  readInternalSession,
} from "@/lib/internal-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireApiSession() {
  const jar = await cookies();
  return readInternalSession(jar.get(INTERNAL_SESSION_COOKIE)?.value);
}

export async function GET() {
  const session = await requireApiSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const leads = await listLeads(200);
  return NextResponse.json({ leads });
}

const postSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    email: z.string().trim().email().optional().or(z.literal("")),
    telegramUsername: z
      .string()
      .trim()
      .max(64)
      .regex(/^@?[a-zA-Z0-9_]{0,64}$/)
      .optional()
      .or(z.literal("")),
    name: z.string().trim().max(120).optional().or(z.literal("")),
    source: z.string().trim().max(64).optional().or(z.literal("")),
    note: z.string().trim().max(400).optional().or(z.literal("")),
  }),
  z.object({
    action: z.literal("set_status"),
    id: z.string().trim().min(8).max(80),
    status: z.enum(["new", "contacted", "qualified", "member", "lost"]),
  }),
]);

export async function POST(request: Request) {
  const session = await requireApiSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid lead payload." }, { status: 400 });
  }

  try {
    if (parsed.data.action === "set_status") {
      const lead = await updateLeadStatus(parsed.data.id, parsed.data.status);
      return NextResponse.json({ ok: true, lead });
    }

    const lead = await createLead({
      email: parsed.data.email || undefined,
      telegramUsername: parsed.data.telegramUsername || undefined,
      name: parsed.data.name || undefined,
      source: parsed.data.source || undefined,
      note: parsed.data.note || undefined,
      createdBy: session.username,
    });
    return NextResponse.json({ ok: true, lead });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to save lead.",
      },
      { status: 400 },
    );
  }
}
