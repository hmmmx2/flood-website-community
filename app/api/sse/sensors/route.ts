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

export async function GET() {
  const upstreamUrl = `${JAVA_API}/sse/sensors`;

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: {
        Accept: "text/event-stream",
        "Cache-Control": "no-cache",
      },
      cache: "no-store",
    });

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => "");
      console.error(
        "[api/sse/sensors] upstream non-OK:",
        upstream.status,
        upstreamUrl,
        detail.slice(0, 400),
      );
      return new NextResponse("SSE upstream unavailable", { status: 502 });
    }

    if (!upstream.body) {
      console.error("[api/sse/sensors] missing response body:", upstreamUrl);
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
  } catch (err) {
    console.error("[api/sse/sensors] upstream fetch failed:", upstreamUrl, err);
    return new NextResponse("SSE upstream unavailable", { status: 502 });
  }
}
