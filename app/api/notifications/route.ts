import { NextRequest, NextResponse } from "next/server";
import { requireServerAccessToken } from "@/lib/serverAuth";
import { javaFetch } from "@/lib/javaApi";

export const dynamic = "force-dynamic";

/**
 * GET /api/notifications?page=0&size=20
 * Returns the authenticated user's most-recent in-app notifications.
 */
export async function GET(req: NextRequest) {
  const token = await requireServerAccessToken(req);
  if (token instanceof NextResponse) return token;
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
<<<<<<< Updated upstream
      `/notifications?page=${page}&size=${size}`,
      { token: session.accessToken },
=======
      qs ? `/notifications?${qs}` : "/notifications",
      { token: token },
>>>>>>> Stashed changes
    );
    return NextResponse.json(data);
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status });
  }
}
