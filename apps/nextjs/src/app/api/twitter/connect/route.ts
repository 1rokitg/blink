import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "node:crypto";

const CLIENT_ID =
  process.env.TWITTER_CLIENT_ID ?? "";

const SCOPES = "tweet.read users.read";

// ── PKCE helpers ─────────────────────────────────────────────────────────────

function generateCodeVerifier() {
  return crypto.randomBytes(32).toString("base64url");
}

function generateCodeChallenge(verifier: string) {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

// ── Route handler ─────────────────────────────────────────────────────────────

/**
 * GET /api/twitter/connect?wallet=0x...
 *
 * Initiates Twitter OAuth 2.0 PKCE flow.
 * Stores the code_verifier in an httpOnly cookie and the wallet address in
 * the OAuth `state` param (base64url encoded) so we can link the account
 * after the callback.
 */
export async function GET(req: NextRequest) {
  const appUrl = req.nextUrl.origin;
  const redirectUri = `${appUrl}/api/twitter/callback`;

  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet || !wallet.startsWith("0x")) {
    return NextResponse.json({ error: "wallet param required" }, { status: 400 });
  }

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = Buffer.from(wallet.toLowerCase()).toString("base64url");

  // Store verifier in a short-lived httpOnly cookie
  const cookieStore = await cookies();
  cookieStore.set("tw_pkce_verifier", codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes
  });

  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    scope: SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return NextResponse.redirect(
    `https://twitter.com/i/oauth2/authorize?${params.toString()}`,
  );
}
