/**
 * Privy web client credentials (public).
 * @see https://docs.privy.io — App ID (`cm…`) and Client ID (`client-…`) are different.
 */

/** Blink production Privy app id (Privy dashboard → Settings → API keys). */
export const BLINK_PRIVY_APP_ID_DEFAULT = "cmpiqa62z001u0ck2clr1ic8p";

/** Blink web client id from Privy dashboard → Web → Client ID. */
export const BLINK_PRIVY_CLIENT_ID_DEFAULT =
  "client-WY6ZYq2Ve9d4cAN4A4kvRV26jJwsodGMA8JrAk7XriopW";

const PRIVY_APP_ID_PATTERN = /^cm[a-z0-9]+$/i;
const PRIVY_CLIENT_ID_PATTERN = /^client-[A-Za-z0-9]+$/;

function normalize(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

/** App id (`cm…`) — rejects accidental `client-…` paste. */
export function resolvePrivyAppId(value: string | undefined) {
  const normalized = normalize(value);
  if (normalized && PRIVY_APP_ID_PATTERN.test(normalized)) {
    return normalized;
  }
  return BLINK_PRIVY_APP_ID_DEFAULT;
}

/** Client id (`client-…`) — rejects accidental app id in the client slot. */
export function resolvePrivyClientId(value: string | undefined) {
  const normalized = normalize(value);
  if (normalized && PRIVY_CLIENT_ID_PATTERN.test(normalized)) {
    return normalized;
  }
  return BLINK_PRIVY_CLIENT_ID_DEFAULT;
}
