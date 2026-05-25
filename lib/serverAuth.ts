import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const AUTH_SECRET = process.env.AUTH_SECRET;

export async function getServerAccessToken(req: NextRequest): Promise<string | null> {
  if (!AUTH_SECRET) return null;
  const token = await getToken({ req, secret: AUTH_SECRET });
  const accessToken = token?.accessToken;
  return typeof accessToken === "string" && accessToken.length > 0 ? accessToken : null;
}

export async function requireServerAccessToken(
  req: NextRequest,
): Promise<string | NextResponse> {
  const token = await getServerAccessToken(req);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return token;
}
