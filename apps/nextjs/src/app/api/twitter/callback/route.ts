import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";

import { db } from "@acme/db/client";
import { TwitterConnection } from "@acme/db/schema";

const CLIENT_ID = process.env.TWITTER_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET ?? "";

interface TwitterTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

interface TwitterUserResponse {
  data?: {
    id: string;
    name: string;
    username: string;
  };
  errors?: { message: string }[];
}

/**
 * GET /api/twitter/callback?code=...&state=...
 *
 * Twitter redirects here after the user authorizes the app.
 * We exchange the code for an access token, fetch the user's profile,
 * store the connection in DB, then redirect back to the profile page.
 */
export async function GET(req: NextRequest) {
  const appUrl = req.nextUrl.origin;
  const redirectUri = `${appUrl}/api/twitter/callback`;

  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const failRedirect = (reason: string) =>
    NextResponse.redirect(`${appUrl}/profile?twitter_error=${encodeURIComponent(reason)}`);

  if (error) return failRedirect(error);
  if (!code || !state) return failRedirect("missing_params");

  // Retrieve code_verifier from cookie
  const cookieStore = await cookies();
  const codeVerifier = cookieStore.get("tw_pkce_verifier")?.value;
  if (!codeVerifier) return failRedirect("session_expired");

  // Decode wallet address from state
  let walletAddress: string;
  try {
    walletAddress = Buffer.from(state, "base64url").toString();
    if (!walletAddress.startsWith("0x")) throw new Error("bad wallet");
  } catch {
    return failRedirect("invalid_state");
  }

  // ── Exchange code for token ───────────────────────────────────────────────

  const basicAuth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");

  const tokenRes = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      code,
      grant_type: "authorization_code",
      client_id: CLIENT_ID,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }).toString(),
  });

  const tokenData = (await tokenRes.json()) as TwitterTokenResponse;

  if (!tokenRes.ok || !tokenData.access_token) {
    return failRedirect(tokenData.error ?? "token_exchange_failed");
  }

  // ── Fetch Twitter user profile ────────────────────────────────────────────

  const userRes = await fetch(
    "https://api.twitter.com/2/users/me?user.fields=name,username",
    {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    },
  );

  const userData = (await userRes.json()) as TwitterUserResponse;
  const twitterUser = userData.data;

  if (!twitterUser?.id) {
    return failRedirect("user_fetch_failed");
  }

  // ── Upsert connection in DB ───────────────────────────────────────────────

  await db
    .insert(TwitterConnection)
    .values({
      walletAddress,
      twitterId: twitterUser.id,
      twitterUsername: twitterUser.username,
      twitterName: twitterUser.name,
    })
    .onConflictDoUpdate({
      target: TwitterConnection.walletAddress,
      set: {
        twitterId: twitterUser.id,
        twitterUsername: twitterUser.username,
        twitterName: twitterUser.name,
        connectedAt: new Date(),
      },
    });

  // ── Clean up cookie and redirect ─────────────────────────────────────────

  cookieStore.delete("tw_pkce_verifier");

  return NextResponse.redirect(
    `${appUrl}/profile/${twitterUser.username}?twitter_connected=1`,
  );
}
