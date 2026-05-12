// GET /api/sse/sensors
// Pipes the Spring Boot SSE stream to the browser so the client never
// needs to know the backend URL or deal with CORS.
//
// PRIVACY:
//   The upstream stream emits `sensor-update` events that include each
//   sensor's exact lat/lng. We never forward those to the browser —
//   the public flood map only sees aggregated zones served by
//   /api/zones. This proxy keeps the SSE channel open so floods alerts
//   (`flood-alert` event, no coords) still arrive in real time, but
//   the raw `sensor-update` events are dropped at the BFF boundary.
//
// AUTH:
//   The Java service requires either a JWT or the shared X-Internal-Key
//   header for this stream (see SecurityConfig.java +
//   InternalApiKeyFilter.java). The BFF speaks the latter — the key is
//   a server-side env var that the browser never sees.

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

/**
 * Events we drop at the BFF boundary because their payload contains
 * raw sensor coordinates. These would defeat the /api/zones privacy
 * aggregation that the rest of the system relies on.
 */
const SENSITIVE_EVENT_NAMES = new Set(["sensor-update"]);

/**
 * Parse the upstream SSE stream chunk-by-chunk and forward only
 * non-sensitive events to the downstream consumer. SSE events are
 * delimited by a blank line, so we accumulate bytes into a buffer
 * and emit one event at a time.
 */
function makeSanitisingTransform(): TransformStream<Uint8Array, Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  return new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true });
      // SSE message boundary is "\n\n" (a blank line). Process every
      // complete message currently in the buffer.
      let idx: number;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const raw = buffer.slice(0, idx + 2);
        buffer = buffer.slice(idx + 2);
        // Extract the event name (the line beginning "event:" — first
        // one wins by SSE spec). Comments / heartbeats arrive without
        // an `event:` field; pass those through untouched.
        let eventName: string | null = null;
        for (const line of raw.split("\n")) {
          if (line.startsWith("event:")) {
            eventName = line.slice(6).trim();
            break;
          }
        }
        if (eventName && SENSITIVE_EVENT_NAMES.has(eventName)) {
          // Drop entirely. Browser sees no event at all.
          continue;
        }
        controller.enqueue(encoder.encode(raw));
      }
    },
    flush(controller) {
      if (buffer.length > 0) controller.enqueue(encoder.encode(buffer));
    },
  });
}

export async function GET() {
  const upstreamUrl = `${JAVA_API}/sse/sensors`;

  if (process.env.NODE_ENV === "production" && JAVA_API.includes("localhost")) {
    console.error(
      "[api/sse/sensors] JAVA_API_URL is not set — falling back to localhost. " +
      "Set JAVA_API_URL in Vercel → Settings → Environment Variables.",
    );
  }

  try {
    const headers: Record<string, string> = {
      Accept: "text/event-stream",
      "Cache-Control": "no-cache",
    };
    const internalKey = process.env.INTERNAL_API_KEY;
    if (internalKey) headers["X-Internal-Key"] = internalKey;

    const upstream = await fetch(upstreamUrl, { headers, cache: "no-store" });

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => "");
      console.error("[api/sse/sensors] upstream non-OK:", upstream.status, upstreamUrl, detail.slice(0, 400));
      return sseError("upstream_error");
    }

    if (!upstream.body) {
      console.error("[api/sse/sensors] missing response body:", upstreamUrl);
      return sseError("upstream_no_body");
    }

    // Pipe through the sanitising transform so `sensor-update` events
    // (which carry raw coords) never reach the browser.
    const sanitised = upstream.body.pipeThrough(makeSanitisingTransform());

    return new NextResponse(sanitised, {
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
