import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_COOKIE,
  SPANISH_COUNTRIES,
  type Locale,
} from "@/lib/i18n/config";

export type LocaleSource =
  | "query"
  | "cookie"
  | "accept-language"
  | "cf-country"
  | "default";

export type LocaleDecision = {
  locale: Locale;
  source: LocaleSource;
  country: string | null;
};

/** Parse `Accept-Language` for en/es preference (browser / UA language). */
export function localeFromAcceptLanguage(
  header: string | null,
): Locale | null {
  if (!header) return null;

  const tags = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const qParam = params.find((p) => p.trim().startsWith("q="));
      const q = qParam ? Number.parseFloat(qParam.trim().slice(2)) : 1;
      return { tag: tag.trim().toLowerCase(), q: Number.isFinite(q) ? q : 0 };
    })
    .filter((item) => item.tag && item.q > 0)
    .sort((a, b) => b.q - a.q);

  for (const { tag } of tags) {
    if (tag === "*" ) continue;
    if (tag === "es" || tag.startsWith("es-")) return "es";
    if (tag === "en" || tag.startsWith("en-")) return "en";
  }
  return null;
}

export function localeFromCountry(country: string | null | undefined): Locale | null {
  if (!country) return null;
  const code = country.trim().toUpperCase();
  if (!code || code === "XX" || code === "T1") return null;
  return SPANISH_COUNTRIES.has(code) ? "es" : null;
}

/**
 * Resolve locale for a visitor.
 * Priority: explicit query → cookie → Accept-Language → CF IP country → English.
 *
 * Cloudflare signals used:
 * - `CF-IPCountry` / `request.cf.country` — IP geolocation at the edge
 * - `Accept-Language` — browser language preferences (UA-driven)
 * - Cookie — sticky preference / language switcher
 */
export function detectLocale(input: {
  queryLang?: string | null;
  cookieLang?: string | null;
  acceptLanguage?: string | null;
  country?: string | null;
}): LocaleDecision {
  const country = input.country?.trim().toUpperCase() || null;

  if (isLocale(input.queryLang)) {
    return { locale: input.queryLang, source: "query", country };
  }

  if (isLocale(input.cookieLang)) {
    return { locale: input.cookieLang, source: "cookie", country };
  }

  const fromHeader = localeFromAcceptLanguage(input.acceptLanguage ?? null);
  if (fromHeader) {
    return { locale: fromHeader, source: "accept-language", country };
  }

  const fromCountry = localeFromCountry(country);
  if (fromCountry) {
    return { locale: fromCountry, source: "cf-country", country };
  }

  return { locale: DEFAULT_LOCALE, source: "default", country };
}

export function readLocaleCookie(
  cookieHeader: string | null | undefined,
): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]+)`),
  );
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}
