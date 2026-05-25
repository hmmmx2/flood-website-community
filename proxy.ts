import NextAuth from "next-auth";
import {
  NextResponse,
  type NextRequest,
  type NextFetchEvent,
} from "next/server";

import authConfig from "@/auth.config";

const { auth: nextAuthProxy } = NextAuth(authConfig);

// ── CSRF protection (merged from the former middleware.ts) ──────────────────
// Next.js 16 allows only ONE edge entrypoint (proxy.ts), so the double-submit
// CSRF gate that used to live in middleware.ts is composed here: it runs first
// for mutating /api/* requests, then we delegate to the NextAuth proxy (which
// applies the `authorized` callback in auth.config for page protection).
const CSRF_COOKIE = "flood_csrf_token";
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const CSRF_EXEMPT_API_PATHS = new Set([
  "/api/auth/csrf",
  "/api/auth/login",
  "/api/auth/sso/start",
]);

export default function proxy(req: NextRequest, event: NextFetchEvent) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/api/") &&
    MUTATING_METHODS.has(req.method.toUpperCase()) &&
    !CSRF_EXEMPT_API_PATHS.has(pathname) &&
    !pathname.startsWith("/api/auth/")
  ) {
    const cookieToken = req.cookies.get(CSRF_COOKIE)?.value;
    const headerToken = req.headers.get("x-csrf-token");
    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      return NextResponse.json(
        { error: "CSRF token missing or invalid" },
        { status: 403 },
      );
    }
  }

  // Delegate to NextAuth (session + the auth.config `authorized` callback).
  return (
    nextAuthProxy as unknown as (
      request: NextRequest,
      ev: NextFetchEvent,
    ) => Promise<NextResponse> | NextResponse
  )(req, event);
}

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|images/).*)",
  ],
};
