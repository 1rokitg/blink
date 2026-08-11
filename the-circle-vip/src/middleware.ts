import { NextResponse, type NextRequest } from "next/server";

import {
  LOCALE_COOKIE,
  LOCALE_HEADER,
  LOCALE_SOURCE_HEADER,
  isLocale,
  type Locale,
} from "@/lib/i18n/config";
import { detectLocale } from "@/lib/i18n/detect";
import {
  isLocaleExemptPath,
  localizePath,
  splitLocalePath,
} from "@/lib/i18n/path";
import {
  INTERNAL_SESSION_COOKIE,
  readInternalSession,
} from "@/lib/internal-auth";
import { isIndicatorsHost } from "@/lib/indicators-site";

function isInternalHost(host: string) {
  return host.startsWith("internal.");
}

function persistLocale(response: NextResponse, locale: Locale) {
  response.cookies.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return response;
}

function withLocaleHeaders(
  request: NextRequest,
  locale: Locale,
  source: string,
) {
  const headers = new Headers(request.headers);
  headers.set(LOCALE_HEADER, locale);
  headers.set(LOCALE_SOURCE_HEADER, source);
  return headers;
}

const INTERNAL_SURFACE_HEADER = "x-circle-internal";
const INDICATORS_SURFACE_HEADER = "x-indicators-site";

function withInternalSurface(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set(INTERNAL_SURFACE_HEADER, "1");
  return headers;
}

function withIndicatorsSurface(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set(INDICATORS_SURFACE_HEADER, "1");
  return headers;
}

function nextInternal(request: NextRequest) {
  return NextResponse.next({
    request: { headers: withInternalSurface(request) },
  });
}

function rewriteInternal(request: NextRequest, url: URL) {
  return NextResponse.rewrite(url, {
    request: { headers: withInternalSurface(request) },
  });
}

function nextIndicators(request: NextRequest) {
  return NextResponse.next({
    request: { headers: withIndicatorsSurface(request) },
  });
}

function rewriteIndicators(request: NextRequest, url: URL) {
  return NextResponse.rewrite(url, {
    request: { headers: withIndicatorsSurface(request) },
  });
}

/**
 * Host surfaces:
 * - `internal.*` → ops dashboard
 * - `indicators.*` → Indicators storefront (separate from Circle VIP)
 * - public locale routing for the main Circle site
 */
export async function middleware(request: NextRequest) {
  const host = request.headers.get("host") || "";
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(INTERNAL_SESSION_COOKIE)?.value;
  const session = await readInternalSession(token);

  if (isIndicatorsHost(host)) {
    if (
      pathname.startsWith("/_next") ||
      pathname.startsWith("/api/indicators") ||
      pathname.startsWith("/api/webhooks") ||
      pathname.startsWith("/favicon") ||
      pathname.startsWith("/logo") ||
      pathname.startsWith("/indicators-hero")
    ) {
      return nextIndicators(request);
    }

    if (pathname.startsWith("/indicators-site")) {
      return nextIndicators(request);
    }

    const url = request.nextUrl.clone();
    if (pathname === "/" || pathname === "") {
      url.pathname = "/indicators-site";
    } else if (pathname === "/success") {
      url.pathname = "/indicators-site/success";
    } else {
      url.pathname = `/indicators-site${pathname}`;
    }
    return rewriteIndicators(request, url);
  }

  if (isInternalHost(host)) {
    if (
      pathname.startsWith("/_next") ||
      pathname.startsWith("/favicon") ||
      pathname.startsWith("/logo") ||
      pathname.startsWith("/api/collect")
    ) {
      return nextInternal(request);
    }

    if (pathname.startsWith("/api/internal/login")) {
      return nextInternal(request);
    }

    if (pathname.startsWith("/api/internal")) {
      if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      return nextInternal(request);
    }

    if (pathname === "/login" || pathname === "/internal/login") {
      const url = request.nextUrl.clone();
      url.pathname = "/internal/login";
      if (pathname === "/login") return rewriteInternal(request, url);
      return nextInternal(request);
    }

    if (!session) {
      const login = request.nextUrl.clone();
      login.pathname = "/internal/login";
      return NextResponse.redirect(login);
    }

    if (!pathname.startsWith("/internal")) {
      const url = request.nextUrl.clone();
      url.pathname = pathname === "/" ? "/internal" : `/internal${pathname}`;
      return rewriteInternal(request, url);
    }

    return nextInternal(request);
  }

  if (pathname === "/internal" || pathname.startsWith("/internal/")) {
    if (
      pathname.startsWith("/internal/login") ||
      pathname.startsWith("/api/internal/login")
    ) {
      return nextInternal(request);
    }
    if (!session) {
      const login = request.nextUrl.clone();
      login.pathname = "/internal/login";
      login.searchParams.set("next", pathname);
      return NextResponse.redirect(login);
    }
    return nextInternal(request);
  }

  if (isLocaleExemptPath(pathname)) {
    return NextResponse.next();
  }

  const { locale: pathLocale, pathname: barePath } = splitLocalePath(pathname);
  const queryLang = request.nextUrl.searchParams.get("lang");

  if (isLocale(queryLang)) {
    const target = request.nextUrl.clone();
    target.pathname = localizePath(queryLang, barePath);
    target.searchParams.delete("lang");
    return persistLocale(NextResponse.redirect(target), queryLang);
  }

  if (pathLocale) {
    const headers = withLocaleHeaders(request, pathLocale, "path");
    return persistLocale(
      NextResponse.next({ request: { headers } }),
      pathLocale,
    );
  }

  const decision = detectLocale({
    cookieLang: request.cookies.get(LOCALE_COOKIE)?.value,
    acceptLanguage: request.headers.get("accept-language"),
    country: request.headers.get("cf-ipcountry"),
  });
  const headers = withLocaleHeaders(
    request,
    decision.locale,
    decision.source,
  );
  return persistLocale(
    NextResponse.next({ request: { headers } }),
    decision.locale,
  );
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};
