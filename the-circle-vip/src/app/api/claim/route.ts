import { NextResponse } from "next/server";
import { z } from "zod";

import { SITE } from "@/lib/site";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().trim().email().max(320),
  telegramUsername: z.string().trim().max(64).optional(),
  whopReceipt: z.string().trim().max(200).optional(),
});

type ClaimBackendResponse = {
  inviteLink?: string;
  invite_link?: string;
  message?: string;
  error?: string;
};

function getClaimBackendUrl() {
  return process.env.CLAIM_BACKEND_URL?.trim() || "";
}

function getClaimBackendKey() {
  return process.env.CLAIM_BACKEND_API_KEY?.trim() || "";
}

/**
 * Proxies Whop → Circle membership claims to the proprietary claim backend.
 * Expected backend contract:
 *   POST CLAIM_BACKEND_URL
 *   { email, telegramUsername?, whopReceipt? }
 *   → { inviteLink: string, message?: string } | { error: string }
 */
export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid email from your Whop membership." },
      { status: 400 },
    );
  }

  const backendUrl = getClaimBackendUrl();
  if (!backendUrl) {
    // Soft fallback until the proprietary verifier is wired.
    return NextResponse.json(
      {
        error:
          "Claim verification is not online yet. Message @rokitgg with your Whop email and we’ll send your invite.",
        fallback: SITE.telegramInvite,
      },
      { status: 503 },
    );
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const apiKey = getClaimBackendKey();
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  try {
    const upstream = await fetch(backendUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        email: parsed.data.email.toLowerCase(),
        telegramUsername: parsed.data.telegramUsername || undefined,
        whopReceipt: parsed.data.whopReceipt || undefined,
        source: "the-circle-vip",
      }),
    });

    const data = (await upstream.json().catch(() => ({}))) as ClaimBackendResponse;
    if (!upstream.ok) {
      return NextResponse.json(
        {
          error:
            data.error ??
            "We couldn’t verify that Whop membership. Double-check the email or message @rokitgg.",
        },
        { status: upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502 },
      );
    }

    const inviteLink = data.inviteLink ?? data.invite_link;
    if (!inviteLink) {
      return NextResponse.json(
        {
          error:
            "Membership found, but no invite was returned. Message @rokitgg for a manual link.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      inviteLink,
      message: data.message ?? "You’re all set — welcome back to The Circle.",
    });
  } catch {
    return NextResponse.json(
      { error: "Claim service unreachable. Try again shortly or message @rokitgg." },
      { status: 502 },
    );
  }
}
