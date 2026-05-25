import { NextResponse, type NextRequest } from "next/server";

const CSRF_COOKIE = "flood_csrf_token";
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const CSRF_EXEMPT_API_PATHS = new Set([
  "/api/auth/csrf",
  "/api/auth/login",
  "/api/auth/sso/start",
]);

export function middleware(req: NextRequest) {
  if (
    req.nextUrl.pathname.startsWith("/api/") &&
    MUTATING_METHODS.has(req.method.toUpperCase()) &&
    !CSRF_EXEMPT_API_PATHS.has(req.nextUrl.pathname) &&
    !req.nextUrl.pathname.startsWith("/api/auth/")
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
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
