import { randomBytes } from "crypto";
import { NextResponse } from "next/server";

const CSRF_COOKIE = "flood_csrf_token";

export async function GET() {
  const token = randomBytes(32).toString("base64url");
  const res = NextResponse.json({ csrfToken: token });
  res.cookies.set(CSRF_COOKIE, token, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60,
  });
  return res;
}
