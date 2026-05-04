// GET /api/sse/sensors
// Pipes the Spring Boot SSE stream to the browser so the client never
// needs to know the backend URL or deal with CORS.
//
// Vercel: set JAVA_API_URL to your public Spring URL (same as javaApi.ts), with or
// without `https://`. If unset, serverless falls back to localhost and returns 502.

import { NextResponse } from "next/server";

import { normaliseJavaApiBase } from "@/lib/normaliseJavaApiBase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Vercel caps by plan (e.g. Hobby 10s, Pro 300s). SSE stays open until disconnect. */
export const maxDuration = 300;

const JAVA_API = normaliseJavaApiBase(
  process.env.JAVA_API_URL ?? process.env.NEXT_PUBLIC_JAVA_API_URL,
  "http://localhost:4001",
);

/** Encode a single SSE event so the browser EventSource can handle it gracefully. */
function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** Return a short SSE stream that sends one error event then closes cleanly. */
function sseError(reason: string): NextResponse {
  const body = sseEvent("backend-unavailable", { reason });
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      Connection: "close",
    },
  });
}

export async function GET() {
  const upstreamUrl = `${JAVA_API}/sse/sensors`;

  // Warn loudly when the fallback localhost URL is used in production
  if (process.env.NODE_ENV === "production" && JAVA_API.includes("localhost")) {
    console.error(
      "[api/sse/sensors] JAVA_API_URL is not set — falling back to localhost. " +
      "Set JAVA_API_URL in Vercel → Settings → Environment Variables.",
    );
  }

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: { Accept: "text/event-stream", "Cache-Control": "no-cache" },
      cache: "no-store",
    });

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => "");
      console.error("[api/sse/sensors] upstream non-OK:", upstream.status, upstreamUrl, detail.slice(0, 400));
      return sseError("upstream_error");
    }

    if (!upstream.body) {
      console.error("[api/sse/sensors] missing response body:", upstreamUrl);
      return sseError("upstream_no_body");
    }

    return new NextResponse(upstream.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("[api/sse/sensors] upstream fetch failed:", upstreamUrl, err);
    return sseError("upstream_unreachable");
  }
}
