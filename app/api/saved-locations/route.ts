import { NextRequest, NextResponse } from "next/server";
import { requireServerAccessToken } from "@/lib/serverAuth";
import { javaFetch } from "@/lib/javaApi";

export const dynamic = "force-dynamic";

/**
 * GET  /api/saved-locations  → list current user's pins
 * POST /api/saved-locations  → create a new pin
 *
 * Both forward to the Java backend's /saved-locations endpoint with the
 * NextAuth access token attached. Same pattern as /api/favourites.
 */

export async function GET(req: NextRequest) {
  const token = await requireServerAccessToken(req);
  if (token instanceof NextResponse) return token;
  try {
    const data = await javaFetch<unknown>("/saved-locations", { token: token });
    return NextResponse.json(data);
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status },
    );
  }
}

export async function POST(req: NextRequest) {
  const token = await requireServerAccessToken(req);
  if (token instanceof NextResponse) return token;
  try {
    const body = await req.json();
    const data = await javaFetch<unknown>("/saved-locations", {
      method: "POST",
      body,
      token: token,
    });
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status },
    );
  }
}
