import { cookies, headers } from "next/headers";

import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_COOKIE,
  LOCALE_HEADER,
  type Locale,
} from "@/lib/i18n/config";
import { detectLocale } from "@/lib/i18n/detect";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionary";

/**
 * Resolve the active locale for RSC.
 * Prefers middleware-forwarded header, then cookie, then live CF/browser signals
 * (OpenNext does not always persist middleware `NextResponse.next()` cookies/headers).
 */
export async function getRequestLocale(): Promise<Locale> {
  const headerStore = await headers();
  const fromHeader = headerStore.get(LOCALE_HEADER);
  if (isLocale(fromHeader)) return fromHeader;

  const jar = await cookies();
  const decision = detectLocale({
    cookieLang: jar.get(LOCALE_COOKIE)?.value,
    acceptLanguage: headerStore.get("accept-language"),
    country: headerStore.get("cf-ipcountry"),
  });

  return decision.locale || DEFAULT_LOCALE;
}

export async function getRequestDictionary(): Promise<{
  locale: Locale;
  dictionary: Dictionary;
}> {
  const locale = await getRequestLocale();
  return { locale, dictionary: getDictionary(locale) };
}
