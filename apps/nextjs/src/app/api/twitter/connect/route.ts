import crypto from "node:crypto";

import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { getAddress, recoverMessageAddress } from "viem";
import { z } from "zod";

import { env } from "~/env";
import { trackMetricEvent } from "~/lib/blink/internal-metrics.server";
import {
  TWITTER_CLAIM_CONTEXT_COOKIE,
  TWITTER_OAUTH_STATE_COOKIE,
  TWITTER_PKCE_VERIFIER_COOKIE,
  createTwitterOwnershipMessage,
} from "~/lib/blink/twitter-ownership";

export const runtime = "nodejs";

const bodySchema = z.object({
  walletAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/),
});

const SCOPES = "tweet.read users.read";

// ── PKCE helpers ─────────────────────────────────────────────────────────────

function generateCodeVerifier() {
  return crypto.randomBytes(32).toString("base64url");
}

function generateCodeChallenge(verifier: string) {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

function parseClaimContext(value?: string) {
  if (!value) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as {
      nonce?: string;
      returnTo?: string;
      walletAddress?: string;
    };

    if (!parsed.nonce || !parsed.returnTo || !parsed.walletAddress) {
      return null;
    }

    return {
      nonce: parsed.nonce,
      returnTo: parsed.returnTo,
      walletAddress: parsed.walletAddress,
    };
  } catch {
    return null;
  }
}

function getCanonicalAppUrl() {
  return env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
}

async function trackTwitterConnectIssue(params: {
  code: string;
  walletAddress?: string | null;
  stage: string;
}) {
  await trackMetricEvent({
    eventType: "issue_auto",
    walletAddress: params.walletAddress ?? null,
    source: "twitter-connect",
    metadata: {
      category: "x-verification",
      summary: "Twitter connect bootstrap failed.",
      code: params.code,
      step: params.stage,
    },
  });
}

// ── Route handler ─────────────────────────────────────────────────────────────

/**
 * POST /api/twitter/connect
 *
 * Verifies the wallet signature for an ownership claim, then initiates the
 * Twitter OAuth 2.0 PKCE flow.
 */
export async function POST(req: NextRequest) {
  if (!env.TWITTER_CLIENT_ID) {
    await trackTwitterConnectIssue({
      code: "twitter_client_not_configured",
      stage: "bootstrap",
    });
    return NextResponse.json(
      { error: "twitter_client_not_configured" },
      { status: 500 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);

  if (!parsed.success) {
    await trackTwitterConnectIssue({
      code: "invalid_payload",
      stage: "payload",
    });
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const walletAddress = parsed.data.walletAddress.toLowerCase();
  const cookieStore = await cookies();
  const claimContext = parseClaimContext(
    cookieStore.get(TWITTER_CLAIM_CONTEXT_COOKIE)?.value,
  );

  if (!claimContext) {
    await trackTwitterConnectIssue({
      code: "claim_session_expired",
      walletAddress,
      stage: "claim-context",
    });
    return NextResponse.json(
      { error: "claim_session_expired" },
      { status: 400 },
    );
  }

  if (claimContext.walletAddress !== walletAddress) {
    await trackTwitterConnectIssue({
      code: "claim_wallet_mismatch",
      walletAddress,
      stage: "claim-context",
    });
    return NextResponse.json(
      { error: "claim_wallet_mismatch" },
      { status: 400 },
    );
  }

  const recoveredAddress = await recoverMessageAddress({
    message: createTwitterOwnershipMessage({
      walletAddress,
      nonce: claimContext.nonce,
    }),
    signature: parsed.data.signature as `0x${string}`,
  }).catch(() => null);

  if (!recoveredAddress) {
    await trackTwitterConnectIssue({
      code: "invalid_signature",
      walletAddress,
      stage: "signature",
    });
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  if (getAddress(recoveredAddress).toLowerCase() !== walletAddress) {
    await trackTwitterConnectIssue({
      code: "wallet_verification_failed",
      walletAddress,
      stage: "signature",
    });
    return NextResponse.json(
      { error: "wallet_verification_failed" },
      { status: 401 },
    );
  }

  const appUrl = getCanonicalAppUrl();
  const redirectUri = `${appUrl}/api/twitter/callback`;
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = crypto.randomBytes(16).toString("base64url");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: env.TWITTER_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  const response = NextResponse.json({
    authorizeUrl: `https://twitter.com/i/oauth2/authorize?${params.toString()}`,
  });

  response.cookies.set(TWITTER_PKCE_VERIFIER_COOKIE, codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  response.cookies.set(TWITTER_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  return response;
}
