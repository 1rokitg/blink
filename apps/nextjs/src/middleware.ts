import { NextResponse, type NextRequest } from "next/server";

const US_COUNTRY_CODES = new Set(["US", "UM"]);

function getCountryCode(req: NextRequest) {
  const raw =
    req.headers.get("x-vercel-ip-country") ??
    req.headers.get("cf-ipcountry") ??
    "";
  return raw.toUpperCase();
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Skip internal and static files.
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/wallet-error-guard.js")
  ) {
    return NextResponse.next();
  }

  const country = getCountryCode(req);
  if (!US_COUNTRY_CODES.has(country)) {
    return NextResponse.next();
  }

  const redirectUrl = new URL("https://blink.us");
  redirectUrl.searchParams.set("notice", "us-restriction");
  redirectUrl.searchParams.set("from", pathname + search);

  return NextResponse.redirect(redirectUrl, 307);
}

export const config = {
  matcher: ["/((?!.*\\..*).*)"],
};

