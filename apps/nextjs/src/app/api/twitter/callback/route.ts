import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "@acme/db/client";
import { TwitterConnection } from "@acme/db/schema";
import { env } from "~/env";
import { sendDiscordProfileVerificationSighting } from "~/lib/blink/discord.server";
import {
  DEFAULT_TWITTER_RETURN_TO,
  TWITTER_CLAIM_CONTEXT_COOKIE,
  TWITTER_OAUTH_STATE_COOKIE,
  TWITTER_PKCE_VERIFIER_COOKIE,
  sanitizeTwitterReturnTo,
} from "~/lib/blink/twitter-ownership";

export const runtime = "nodejs";

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

function parseClaimContext(value?: string) {
  if (!value) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as {
      returnTo?: string;
      walletAddress?: string;
    };

    if (!parsed.returnTo || !parsed.walletAddress) {
      return null;
    }

    return {
      returnTo: sanitizeTwitterReturnTo(parsed.returnTo),
      walletAddress: parsed.walletAddress.toLowerCase(),
    };
  } catch {
    return null;
  }
}

function clearTwitterCookies(response: NextResponse) {
  response.cookies.delete(TWITTER_CLAIM_CONTEXT_COOKIE);
  response.cookies.delete(TWITTER_OAUTH_STATE_COOKIE);
  response.cookies.delete(TWITTER_PKCE_VERIFIER_COOKIE);
}

function buildReturnRedirect(params: {
  appUrl: string;
  returnTo?: string;
  searchParams: Record<string, string>;
}) {
  const redirectUrl = new URL(
    params.returnTo ?? DEFAULT_TWITTER_RETURN_TO,
    params.appUrl,
  );

  for (const [key, value] of Object.entries(params.searchParams)) {
    redirectUrl.searchParams.set(key, value);
  }

  return redirectUrl;
}

function getCanonicalAppUrl() {
  return env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
}

/**
 * GET /api/twitter/callback?code=...&state=...
 *
 * Twitter redirects here after the user authorizes the app.
 * We exchange the code for an access token, fetch the user's profile,
 * store the connection in DB, then redirect back to the profile page.
 */
export async function GET(req: NextRequest) {
  const appUrl = getCanonicalAppUrl();
  const redirectUri = `${appUrl}/api/twitter/callback`;
  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const claimContext = parseClaimContext(
    req.cookies.get(TWITTER_CLAIM_CONTEXT_COOKIE)?.value,
  );
  const returnTo = claimContext?.returnTo ?? DEFAULT_TWITTER_RETURN_TO;

  const failRedirect = (reason: string) => {
    const response = NextResponse.redirect(
      buildReturnRedirect({
        appUrl,
        returnTo,
        searchParams: { twitter_error: reason },
      }),
    );
    clearTwitterCookies(response);
    return response;
  };

  if (error) return failRedirect(error);
  if (!code || !state) return failRedirect("missing_params");
  if (!claimContext?.walletAddress)
    return failRedirect("claim_session_expired");
  if (!env.TWITTER_CLIENT_ID || !env.TWITTER_CLIENT_SECRET) {
    return failRedirect("twitter_client_not_configured");
  }

  const expectedState = req.cookies.get(TWITTER_OAUTH_STATE_COOKIE)?.value;
  if (!expectedState || expectedState !== state) {
    return failRedirect("invalid_state");
  }

  const codeVerifier = req.cookies.get(TWITTER_PKCE_VERIFIER_COOKIE)?.value;
  if (!codeVerifier) return failRedirect("session_expired");

  // ── Exchange code for token ───────────────────────────────────────────────

  const basicAuth = Buffer.from(
    `${env.TWITTER_CLIENT_ID}:${env.TWITTER_CLIENT_SECRET}`,
  ).toString("base64");

  const tokenRes = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      code,
      grant_type: "authorization_code",
      client_id: env.TWITTER_CLIENT_ID,
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

  const existingClaim = await db
    .select({
      twitterId: TwitterConnection.twitterId,
      walletAddress: TwitterConnection.walletAddress,
    })
    .from(TwitterConnection)
    .where(eq(TwitterConnection.twitterId, twitterUser.id))
    .limit(1);

  if (
    existingClaim[0] &&
    existingClaim[0].walletAddress !== claimContext.walletAddress
  ) {
    return failRedirect("twitter_account_already_claimed");
  }

  await db
    .insert(TwitterConnection)
    .values({
      walletAddress: claimContext.walletAddress,
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

  await sendDiscordProfileVerificationSighting({
    walletAddress: claimContext.walletAddress,
    twitterName: twitterUser.name,
    twitterUsername: twitterUser.username,
  }).catch((error) => {
    console.warn(
      "[discord] failed to post profile verification sighting",
      error,
    );
  });

  const response = NextResponse.redirect(
    buildReturnRedirect({
      appUrl,
      returnTo,
      searchParams: { twitter_connected: "1" },
    }),
  );
  clearTwitterCookies(response);
  return response;
}
