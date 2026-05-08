import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { JAVA_API_BASE } from "@/lib/javaApi";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/sse/notifications — server-side SSE proxy.
 *
 * EventSource on the browser can't send custom headers, so we proxy:
 * the BFF reads the user's NextAuth session, opens an upstream SSE
 * connection to Spring Boot's /notifications/stream with a Bearer
 * header, and pipes the byte stream straight back to the client.
 */
export async function GET() {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const upstream = await fetch(`${JAVA_API_BASE}/notifications/stream`, {
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      Accept: "text/event-stream",
    },
    // Long-lived stream — disable Next's fetch cache and let it run.
    cache: "no-store",
  });

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { error: `Upstream ${upstream.status}` },
      { status: upstream.status === 401 ? 401 : 502 },
    );
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
