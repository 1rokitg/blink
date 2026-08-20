const COOKIE = "circle_internal_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 14;

function secret() {
  return (
    process.env.SESSION_SECRET?.trim() ||
    process.env.INTERNAL_SESSION_SECRET?.trim() ||
    "dev-only-internal-secret"
  );
}

function getCredentials() {
  const username = process.env.INTERNAL_USERNAME?.trim() || "";
  const password = process.env.INTERNAL_PASSWORD?.trim() || "";
  return { username, password, configured: Boolean(username && password) };
}

export function isInternalAuthConfigured() {
  return getCredentials().configured;
}

function timingSafeEqualStr(a: string, b: string) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

export function verifyInternalCredentials(username: string, password: string) {
  const creds = getCredentials();
  if (!creds.configured) return false;
  return (
    timingSafeEqualStr(username, creds.username) &&
    timingSafeEqualStr(password, creds.password)
  );
}

async function signBase64Url(payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  const bytes = new Uint8Array(sig);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function createInternalSessionToken(username: string) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SEC;
  const body = `${username}|${exp}`;
  return `${body}|${await signBase64Url(body)}`;
}

export async function readInternalSession(
  token: string | undefined | null,
): Promise<{ username: string } | null> {
  if (!token) return null;
  const parts = token.split("|");
  if (parts.length !== 3) return null;
  const [username, expRaw, signature] = parts;
  if (!username || !expRaw || !signature) return null;
  const body = `${username}|${expRaw}`;
  const expected = await signBase64Url(body);
  if (!timingSafeEqualStr(signature, expected)) return null;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return null;
  return { username };
}

export function internalSessionCookie(token: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_SEC}${secure}`;
}

export function clearInternalSessionCookie() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export { COOKIE as INTERNAL_SESSION_COOKIE };
