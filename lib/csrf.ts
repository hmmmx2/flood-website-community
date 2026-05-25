import { NextRequest, NextResponse } from "next/server";

const CSRF_COOKIE = "flood_csrf_token";
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function requireCsrf(req: NextRequest): NextResponse | null {
  if (!MUTATING.has(req.method.toUpperCase())) return null;
  const cookieToken = req.cookies.get(CSRF_COOKIE)?.value;
  const headerToken = req.headers.get("x-csrf-token");
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return NextResponse.json(
      { error: "CSRF token missing or invalid" },
      { status: 403 },
    );
  }
  return null;
}
