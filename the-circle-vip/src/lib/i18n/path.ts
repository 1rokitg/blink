import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n/config";

/** Paths that never receive an `/en` or `/es` prefix. */
export function isLocaleExemptPath(pathname: string) {
  return (
    pathname.startsWith("/api") ||
    pathname.startsWith("/internal") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/partners") ||
    // Secure one-time Stripe claim tokens stay on a stable unlocalized path.
    /^\/claim\/cl_/.test(pathname) ||
    // Complimentary gift redeem links.
    /^\/gift\/gf_/.test(pathname)
  );
}

/**
 * Split a pathname into optional locale prefix + bare app path.
 * `/es/join` → `{ locale: "es", pathname: "/join" }`
 * `/en` → `{ locale: "en", pathname: "/" }`
 */
export function splitLocalePath(pathname: string): {
  locale: Locale | null;
  pathname: string;
} {
  const segments = pathname.split("/");
  const maybe = segments[1];
  if (!isLocale(maybe)) {
    return { locale: null, pathname: pathname || "/" };
  }

  const rest = `/${segments.slice(2).join("/")}`.replace(/\/$/, "") || "/";
  return { locale: maybe, pathname: rest === "//" ? "/" : rest };
}

/** Build a shareable localized path: `localizePath("es", "/join")` → `/es/join`. */
export function localizePath(locale: Locale, path = "/"): string {
  const hashIndex = path.indexOf("#");
  const hash = hashIndex >= 0 ? path.slice(hashIndex) : "";
  const withoutHash = hashIndex >= 0 ? path.slice(0, hashIndex) : path;

  const queryIndex = withoutHash.indexOf("?");
  const search = queryIndex >= 0 ? withoutHash.slice(queryIndex) : "";
  const pathnameOnly = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;

  let normalized = pathnameOnly.startsWith("/") ? pathnameOnly : `/${pathnameOnly}`;
  if (!normalized || normalized === "") normalized = "/";

  const split = splitLocalePath(normalized);
  normalized = split.pathname;

  const prefixed = normalized === "/" ? `/${locale}` : `/${locale}${normalized}`;
  return `${prefixed}${search}${hash}`;
}

export function stripLocalePath(pathname: string): string {
  return splitLocalePath(pathname).pathname;
}

export function pathLocaleOrDefault(pathname: string): Locale {
  return splitLocalePath(pathname).locale ?? DEFAULT_LOCALE;
}
