/** First-touch sales-channel attribution for rokitg.com. */

export type Attribution = {
  /** Normalized channel: twitter, instagram, tiktok, direct, … */
  channel: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  referrer: string | null;
  capturedAt: string;
};

export const ATTRIBUTION_STORAGE_KEY = "circle_attribution";

const CHANNEL_ALIASES: Record<string, string> = {
  twitter: "twitter",
  x: "twitter",
  "t.co": "twitter",
  instagram: "instagram",
  ig: "instagram",
  "l.instagram.com": "instagram",
  tiktok: "tiktok",
  youtube: "youtube",
  youtu: "youtube",
  "youtu.be": "youtube",
  facebook: "facebook",
  fb: "facebook",
  "m.facebook": "facebook",
  "l.facebook": "facebook",
  linkedin: "linkedin",
  discord: "discord",
  telegram: "telegram",
  "t.me": "telegram",
  google: "google",
  googleads: "google",
  "google-ads": "google",
  reddit: "reddit",
  threads: "threads",
  snapchat: "snapchat",
  whatsapp: "whatsapp",
  email: "email",
  newsletter: "email",
  sms: "sms",
  affiliate: "affiliate",
  direct: "direct",
};

function clean(value: string | null | undefined, max = 128) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

export function normalizeChannel(raw: string | null | undefined): string {
  const value = clean(raw, 64)?.toLowerCase() ?? "";
  if (!value) return "direct";
  const compact = value.replace(/^www\./, "");
  if (CHANNEL_ALIASES[compact]) return CHANNEL_ALIASES[compact];
  for (const [alias, channel] of Object.entries(CHANNEL_ALIASES)) {
    if (compact.includes(alias)) return channel;
  }
  // Strip common TLDs / noise from host-like sources
  const hostish = compact.split(".")[0] ?? compact;
  if (CHANNEL_ALIASES[hostish]) return CHANNEL_ALIASES[hostish];
  return compact.replace(/[^a-z0-9_-]+/g, "_").slice(0, 32) || "direct";
}

export function channelFromReferrer(referrer: string | null | undefined): string | null {
  const raw = clean(referrer, 240);
  if (!raw) return null;
  try {
    const host = new URL(raw).hostname.toLowerCase().replace(/^www\./, "");
    if (
      host === "rokitg.com" ||
      host.endsWith(".rokitg.com") ||
      host.includes("localhost")
    ) {
      return null;
    }
    return normalizeChannel(host);
  } catch {
    return null;
  }
}

export function parseAttributionInput(input: {
  search?: string | null;
  referrer?: string | null;
  now?: string;
}): Attribution {
  const params = new URLSearchParams(input.search ?? "");
  const utmSource = clean(params.get("utm_source"), 64);
  const utmMedium = clean(params.get("utm_medium"), 64);
  const utmCampaign = clean(params.get("utm_campaign"), 128);
  const utmContent = clean(params.get("utm_content"), 128);
  const utmTerm = clean(params.get("utm_term"), 128);
  const ch = clean(params.get("ch") || params.get("channel"), 64);
  const referrer = clean(input.referrer, 240);

  const fromParams = ch || utmSource;
  const fromReferrer = channelFromReferrer(referrer);
  const channel = normalizeChannel(fromParams || fromReferrer || "direct");

  return {
    channel,
    utmSource,
    utmMedium,
    utmCampaign,
    utmContent,
    utmTerm,
    referrer,
    capturedAt: input.now ?? new Date().toISOString(),
  };
}

export function sanitizeAttribution(
  input: Partial<Attribution> | null | undefined,
): Attribution | null {
  if (!input || typeof input !== "object") return null;
  const channel = normalizeChannel(input.channel || input.utmSource || "direct");
  return {
    channel,
    utmSource: clean(input.utmSource, 64),
    utmMedium: clean(input.utmMedium, 64),
    utmCampaign: clean(input.utmCampaign, 128),
    utmContent: clean(input.utmContent, 128),
    utmTerm: clean(input.utmTerm, 128),
    referrer: clean(input.referrer, 240),
    capturedAt: clean(input.capturedAt, 40) || new Date().toISOString(),
  };
}

/** Stripe metadata keys (short — Stripe limits value length). */
export function attributionToStripeMetadata(
  attribution: Attribution | null | undefined,
): Record<string, string> {
  if (!attribution) return {};
  const out: Record<string, string> = {
    channel: attribution.channel,
  };
  if (attribution.utmSource) out.utm_source = attribution.utmSource;
  if (attribution.utmMedium) out.utm_medium = attribution.utmMedium;
  if (attribution.utmCampaign) out.utm_campaign = attribution.utmCampaign;
  if (attribution.utmContent) out.utm_content = attribution.utmContent;
  if (attribution.utmTerm) out.utm_term = attribution.utmTerm;
  if (attribution.referrer) out.referrer = attribution.referrer.slice(0, 200);
  return out;
}

export function formatChannelLabel(channel: string | null | undefined) {
  const value = (channel || "direct").trim() || "direct";
  if (value === "twitter") return "Twitter / X";
  if (value === "instagram") return "Instagram";
  if (value === "tiktok") return "TikTok";
  if (value === "youtube") return "YouTube";
  if (value === "facebook") return "Facebook";
  if (value === "linkedin") return "LinkedIn";
  if (value === "telegram") return "Telegram";
  if (value === "google") return "Google";
  if (value === "direct") return "Direct";
  return value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Client-only: read first-touch attribution from localStorage. */
export function readStoredAttribution(): Attribution | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    if (!raw) return null;
    return sanitizeAttribution(JSON.parse(raw) as Partial<Attribution>);
  } catch {
    return null;
  }
}

/**
 * Client-only: capture first-touch attribution from the current URL + referrer.
 * Never overwrites an existing stored touch.
 */
export function ensureStoredAttribution(): Attribution {
  const existing = readStoredAttribution();
  if (existing) return existing;

  const next = parseAttributionInput({
    search: typeof window !== "undefined" ? window.location.search : "",
    referrer: typeof document !== "undefined" ? document.referrer : "",
  });

  try {
    window.localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // private mode
  }
  return next;
}
