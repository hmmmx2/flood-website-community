// GET /api/sse/iot-events?types=...&dataset=...
//
// Pipes the FloodWatch IoT SSE stream to the browser. The browser's
// EventSource cannot add headers nor speak directly to the upstream
// (CORS is permissive but routing through the BFF keeps client logic
// trivial), so this route opens the upstream connection and forwards
// each event after a privacy-sanitising transform.
//
// PRIVACY:
//   The community site never shows residents pinpoint GPS coordinates
//   for active sensors. The transform below drops `lat`, `lng`, `rssi`,
//   and `snr` from `heartbeat` events (we don't need them on the public
//   map). For `flood_level`, `alert`, `weather_update`, `node_online`,
//   and `node_offline` events we forward everything — the village/node
//   IDs are public and the location grain is village-level.
//
// AUTH:
//   None. The upstream IoT API is public.
//
// WEB PUSH FAN-OUT — DEFERRED:
//   The original plan called for this proxy to dispatch Web Push to all
//   subscribers when a critical IoT alert (`flood` at level >= 2, or
//   `battery_critical`) arrives. The plan assumed an existing
//   `/api/push/dispatch` BFF route that doesn't actually exist — push
//   subscriptions are stored in the Java backend (POST
//   /settings/push-subscription) and the Java alert pipeline owns the
//   VAPID private key + the actual `web-push` library. From here we
//   can't fan out a notification without either (a) adding `web-push`
//   to the Next package + a new Java endpoint that lists subscribers,
//   or (b) re-ingesting each IoT alert into Java's POST /ingest so the
//   existing flood-threshold pipeline triggers its own push fan-out.
//   Option (b) is the lowest-risk path but inflates Java's reading
//   table with a duplicate copy of every upstream event, so we're
//   deferring the decision to a separate ticket rather than wiring it
//   silently. For now, residents see live alerts via the in-page
//   IoTFloodAlertDock + browser Notification API (active when the tab
//   is open or backgrounded). OS-level push delivery while the tab is
//   closed will land in the follow-up.

import { NextResponse } from "next/server";

import { buildStreamUrl } from "@/lib/floodwatch/api";
import type { Dataset } from "@/lib/floodwatch/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** SSE stays open until disconnect. Vercel caps by plan; 300s on Pro. */
export const maxDuration = 300;

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

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

/** Heartbeat fields we strip before forwarding to the browser. */
const HEARTBEAT_SENSITIVE_FIELDS = ["lat", "lng", "rssi", "snr"];

/** Event names we drop entirely (operator-only signals). */
const SENSITIVE_EVENT_NAMES = new Set(["node_announce"]);

/**
 * Sanitise a single SSE message before forwarding. SSE messages look like:
 *   event: heartbeat
 *   data: {"type":"heartbeat", ...}
 *
 *   (blank line)
 *
 * If the event is operator-only, return null to drop it. Otherwise rewrite
 * `data: ...` to remove sensitive fields where applicable.
 */
function sanitiseMessage(raw: string): string | null {
  // Detect the line terminator used by the upstream so we can re-emit
  // the message verbatim instead of normalising to LF (which would
  // confuse strict CRLF consumers — though browsers don't care).
  const eol = raw.includes("\r\n") ? "\r\n" : "\n";
  const lines = raw.split(eol);
  let eventName: string | null = null;
  let dataLineIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (eventName === null && line.startsWith("event:")) {
      eventName = line.slice(6).trim();
    } else if (dataLineIdx === -1 && line.startsWith("data:")) {
      dataLineIdx = i;
    }
  }

  if (eventName && SENSITIVE_EVENT_NAMES.has(eventName)) {
    return null;
  }

  // Strip sensitive fields from heartbeat events.
  if (eventName === "heartbeat" && dataLineIdx !== -1) {
    const payloadRaw = lines[dataLineIdx].slice(5).trim();
    try {
      const payload = JSON.parse(payloadRaw) as Record<string, unknown>;
      for (const field of HEARTBEAT_SENSITIVE_FIELDS) {
        delete payload[field];
      }
      lines[dataLineIdx] = `data: ${JSON.stringify(payload)}`;
    } catch {
      // Malformed JSON — let it through unchanged rather than risk silence.
    }
  }

  return lines.join(eol);
}

/**
 * Locate the next SSE message boundary in `buffer` starting at `from`.
 * SSE spec allows either LF or CRLF line endings — Spring Boot uses LF,
 * Starlette/Uvicorn (the FloodWatch IoT backend) uses CRLF. We accept
 * both `\n\n` and `\r\n\r\n` so the proxy works against either upstream.
 * Returns `{ idx, sep }` where idx is the position of the first separator
 * character and sep is the separator length (2 for LF-LF, 4 for CRLF-CRLF).
 */
function findMessageBoundary(buffer: string, from = 0): { idx: number; sep: number } | null {
  const crlf = buffer.indexOf("\r\n\r\n", from);
  const lf = buffer.indexOf("\n\n", from);
  if (crlf === -1 && lf === -1) return null;
  if (crlf === -1) return { idx: lf, sep: 2 };
  if (lf === -1) return { idx: crlf, sep: 4 };
  // The LF index will fall inside a CRLF-CRLF run; pick whichever starts first.
  return crlf <= lf ? { idx: crlf, sep: 4 } : { idx: lf, sep: 2 };
}

function makeSanitisingTransform(): TransformStream<Uint8Array, Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  return new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true });
      // SSE message boundary is a blank line. Handle both LF and CRLF
      // (the IoT API's Uvicorn server emits CRLF; Spring Boot emits LF).
      let boundary: ReturnType<typeof findMessageBoundary>;
      while ((boundary = findMessageBoundary(buffer)) !== null) {
        const raw = buffer.slice(0, boundary.idx + boundary.sep);
        buffer = buffer.slice(boundary.idx + boundary.sep);
        const sanitised = sanitiseMessage(raw);
        if (sanitised === null) continue;
        controller.enqueue(encoder.encode(sanitised));
      }
    },
    flush(controller) {
      if (buffer.length > 0) controller.enqueue(encoder.encode(buffer));
    },
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const types = url.searchParams.get("types") ?? undefined;
  const dataset = (url.searchParams.get("dataset") ?? undefined) as
    | Dataset
    | undefined;

  const upstreamUrl = buildStreamUrl({ types, dataset });

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
        "[api/sse/iot-events] upstream non-OK:",
        upstream.status,
        upstreamUrl,
        detail.slice(0, 400),
      );
      return sseError("upstream_error");
    }

    if (!upstream.body) {
      console.error("[api/sse/iot-events] missing response body:", upstreamUrl);
      return sseError("upstream_no_body");
    }

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
    console.error("[api/sse/iot-events] upstream fetch failed:", upstreamUrl, err);
    return sseError("upstream_unreachable");
  }
}
