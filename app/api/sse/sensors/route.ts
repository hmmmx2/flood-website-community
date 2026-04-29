// GET /api/sse/sensors
// Pipes the Spring Boot SSE stream to the browser so the client never
// needs to know the backend URL or deal with CORS.

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const JAVA_API_URL =
  process.env.JAVA_API_URL ||
  process.env.NEXT_PUBLIC_JAVA_API_URL ||
  "http://localhost:4001";

export async function GET() {
  try {
    const upstream = await fetch(`${JAVA_API_URL}/sse/sensors`, {
      headers: {
        Accept: "text/event-stream",
        "Cache-Control": "no-cache",
      },
      cache: "no-store",
    });

    if (!upstream.ok || !upstream.body) {
      return new NextResponse("SSE upstream unavailable", { status: 502 });
    }

    return new NextResponse(upstream.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
        Connection: "keep-alive",
      },
    });
  } catch {
    return new NextResponse("SSE upstream unavailable", { status: 502 });
  }
}
