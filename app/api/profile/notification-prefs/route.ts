import { NextRequest, NextResponse } from "next/server";
import { requireServerAccessToken } from "@/lib/serverAuth";
import { javaFetch } from "@/lib/javaApi";

export const dynamic = "force-dynamic";

/**
 * GET   /api/profile/notification-prefs  — current channel prefs + phone
 * PATCH /api/profile/notification-prefs  — partial update
 */
export async function GET(req: NextRequest) {
  const token = await requireServerAccessToken(req);
  if (token instanceof NextResponse) return token;
  try {
    const data = await javaFetch<unknown>("/profile/notification-prefs", {
      token: token,
    });
    return NextResponse.json(data);
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status },
    );
  }
}

export async function PATCH(req: NextRequest) {
  const token = await requireServerAccessToken(req);
  if (token instanceof NextResponse) return token;
  try {
    const body = await req.json();
    const data = await javaFetch<unknown>("/profile/notification-prefs", {
      method: "PATCH",
      body,
      token: token,
    });
    return NextResponse.json(data);
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status },
    );
  }
}
