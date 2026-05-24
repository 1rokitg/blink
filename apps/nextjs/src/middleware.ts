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

  const referralMatch = pathname.match(/^\/r\/([^/]+)$/i);
  const referralCode = referralMatch
    ? decodeURIComponent(referralMatch[1] ?? "").toLowerCase()
    : null;

  const country = getCountryCode(req);
  if (!US_COUNTRY_CODES.has(country)) {
    const res = NextResponse.next();
    if (referralCode) {
      res.cookies.set("blink_ref", referralCode, {
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
        sameSite: "lax",
      });
    }
    return res;
  }

  const redirectUrl = new URL("https://blink.us");
  redirectUrl.searchParams.set("notice", "us-restriction");
  redirectUrl.searchParams.set("from", pathname + search);
  const res = NextResponse.redirect(redirectUrl, 307);
  if (referralCode) {
    res.cookies.set("blink_ref", referralCode, {
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
      sameSite: "lax",
    });
  }
  return res;
}

export const config = {
  matcher: ["/((?!.*\\..*).*)"],
};
