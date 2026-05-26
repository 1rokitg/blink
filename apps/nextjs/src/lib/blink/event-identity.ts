import { createHash, randomUUID } from "node:crypto";

const VISITOR_COOKIE = "blink_vid";
const SESSION_COOKIE = "blink_sid";

type IdentityHeaders = Headers;

function sha256(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

function normalize(input: string | null | undefined) {
  return (input ?? "").trim().toLowerCase();
}

function firstHeader(headers: Headers, names: string[]) {
  for (const name of names) {
    const value = headers.get(name);
    if (value) return value;
  }
  return null;
}

function parseCookie(cookiesHeader: string | null, key: string) {
  if (!cookiesHeader) return null;
  const parts = cookiesHeader.split(";").map((part) => part.trim());
  for (const part of parts) {
    if (!part.startsWith(`${key}=`)) continue;
    const value = part.slice(key.length + 1).trim();
    return value || null;
  }
  return null;
}

export function getBotSignals(headers: IdentityHeaders) {
  const botId = firstHeader(headers, [
    "x-vercel-bot-id",
    "x-bot-id",
    "x-bot-name",
  ]);
  const botTag = firstHeader(headers, ["x-vercel-bot-tag", "x-bot-tag"]);
  const firewallAction = firstHeader(headers, [
    "x-vercel-sc-action",
    "x-vercel-firewall-action",
  ]);
  const isBot =
    normalize(headers.get("x-vercel-bot")) === "1" ||
    normalize(headers.get("x-bot")) === "1" ||
    Boolean(botId) ||
    Boolean(botTag);
  return { isBot, botId, botTag, firewallAction };
}

export function resolveEventIdentity(headers: IdentityHeaders) {
  const cookies = headers.get("cookie");
  const cookieVisitorId = parseCookie(cookies, VISITOR_COOKIE);
  const cookieSessionId = parseCookie(cookies, SESSION_COOKIE);

  const clientVisitorId = headers.get("x-blink-visitor-id");
  const clientSessionId = headers.get("x-blink-session-id");
  const requestId = firstHeader(headers, ["x-vercel-id", "x-request-id"]);

  const ua = normalize(headers.get("user-agent"));
  const lang = normalize(headers.get("accept-language"));
  const country = normalize(headers.get("x-vercel-ip-country"));
  const region = normalize(headers.get("x-vercel-ip-country-region"));
  const city = normalize(headers.get("x-vercel-ip-city"));
  const referer = headers.get("referer");
  const origin = headers.get("origin");
  const ip = normalize(
    firstHeader(headers, [
      "x-real-ip",
      "x-forwarded-for",
      "cf-connecting-ip",
    ])?.split(",")[0] ?? null,
  );

  const fingerprintBase = [ua, lang, country, city, ip]
    .filter(Boolean)
    .join("|");
  const fingerprint = fingerprintBase
    ? `v1_${sha256(fingerprintBase).slice(0, 40)}`
    : null;

  const visitorId =
    normalize(clientVisitorId) ||
    normalize(cookieVisitorId) ||
    fingerprint ||
    `v1_${randomUUID().replaceAll("-", "")}`;

  const sessionId =
    normalize(clientSessionId) ||
    normalize(cookieSessionId) ||
    `s1_${randomUUID().replaceAll("-", "")}`;

  const { isBot, botId, botTag, firewallAction } = getBotSignals(headers);

  return {
    visitorId,
    sessionId,
    requestId,
    bot: {
      isBot,
      botId,
      botTag,
      firewallAction,
    },
    requestContext: {
      city: city || null,
      country: country || null,
      fingerprint,
      ipAddress: ip || null,
      language: lang || null,
      origin: origin || null,
      referer: referer || null,
      region: region || null,
      userAgent: ua || null,
    },
    setCookies: [
      `${VISITOR_COOKIE}=${visitorId}; Path=/; Max-Age=31536000; SameSite=Lax; Secure; HttpOnly`,
      `${SESSION_COOKIE}=${sessionId}; Path=/; Max-Age=2592000; SameSite=Lax; Secure; HttpOnly`,
    ],
  };
}
