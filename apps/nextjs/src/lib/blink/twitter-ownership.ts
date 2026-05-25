export const TWITTER_CLAIM_CONTEXT_COOKIE = "tw_claim_context";
export const TWITTER_OAUTH_STATE_COOKIE = "tw_oauth_state";
export const TWITTER_PKCE_VERIFIER_COOKIE = "tw_pkce_verifier";
export const DEFAULT_TWITTER_RETURN_TO = "/profile";

export function sanitizeTwitterReturnTo(returnTo?: string) {
  if (!returnTo?.startsWith("/") || returnTo.startsWith("//")) {
    return DEFAULT_TWITTER_RETURN_TO;
  }

  try {
    const url = new URL(returnTo, "https://blink.lat");
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return DEFAULT_TWITTER_RETURN_TO;
  }
}

export function createTwitterOwnershipMessage(params: {
  walletAddress: string;
  nonce: string;
}) {
  return [
    "Sign this message to verify wallet ownership for your Blink X claim.",
    "",
    `Wallet: ${params.walletAddress.toLowerCase()}`,
    `Nonce: ${params.nonce}`,
    "",
    "This request will not trigger a blockchain transaction or cost gas.",
  ].join("\n");
}
