import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { javaFetch } from "@/lib/javaApi";

export const dynamic = "force-dynamic";

/**
 * GET /api/notifications?page=0&size=20
 * Returns the authenticated user's most-recent in-app notifications.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    // Validate + clamp pagination instead of forwarding raw params
    // straight to upstream (prevents unbounded page sizes / negative
    // pages reaching Java).
    const sp = new URL(req.url).searchParams;
    const rawPage = parseInt(sp.get("page") ?? "0", 10);
    const page = Math.max(0, Number.isNaN(rawPage) ? 0 : rawPage);
    const rawSize = parseInt(sp.get("size") ?? "20", 10);
    const size = Math.max(1, Math.min(Number.isNaN(rawSize) ? 20 : rawSize, 100));
    const data = await javaFetch<unknown>(
      `/notifications?page=${page}&size=${size}`,
      { token: session.accessToken },
    );
    return NextResponse.json(data);
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status });
  }
}
