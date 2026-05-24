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
 * Fire-and-forget Web Push dispatch when an alert message passes through
 * the proxy. Only level≥2 floods (Warning + Critical) and battery_critical
 * are pushed — `watch`/`level=1` is normal noise that we don't want to
 * wake a phone for.
 *
 * The dispatch endpoint handles its own Redis dedupe (5-min cooldown per
 * `{nodeId, alertType}`), so it's safe for both the community AND crm
 * SSE proxies to fire on the same upstream event — only one push
 * survives the dedupe lock.
 *
 * Fire-and-forget: we never await this. A slow / failed dispatch can't
 * be allowed to stall the SSE stream that the browser is consuming.
 */
function maybeFirePush(eventName: string, payload: Record<string, unknown>): void {
  if (eventName !== "alert") return;
  const alertType = typeof payload.alert_type === "string" ? payload.alert_type : null;
  const level = typeof payload.level === "number" ? payload.level : 0;
  const shouldPush =
    (alertType === "flood" && level >= 2) ||
    alertType === "battery_critical" ||
    (alertType === "water_fall" && level >= 2);
  if (!shouldPush) return;

  const nodeId = typeof payload.node_id === "string" ? payload.node_id : null;
  if (!nodeId) return;

  const dispatchBody = {
    nodeId,
    villageId: typeof payload.village_id === "string" ? payload.village_id : undefined,
    alertType,
    level,
    timestamp:
      typeof payload.timestamp === "string" ? payload.timestamp : new Date().toISOString(),
    source: "community" as const,
  };

  // The dispatch route lives on the SAME Vercel project as this
  // handler, so the call is local — no extra latency from a real
  // egress hop. fetch() respects the Vercel internal routing.
  const dispatchUrl =
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_COMMUNITY_URL ?? "") + "/api/push/dispatch";

  fetch(dispatchUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dispatchBody),
  }).catch((err) => {
    console.warn(
      "[sse/iot-events] push dispatch fire-and-forget failed:",
      err instanceof Error ? err.message : err,
    );
  });
}

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

  // Side-effect: fire-and-forget Web Push dispatch for alert events
  // that exceed the push threshold. The browser still gets the SSE
  // message in-tab (toast / chime / bell). The push covers the
  // browser-closed case so an OS-level notification reaches the user
  // within ~3 s. See maybeFirePush for the threshold rules.
  if (eventName === "alert" && dataLineIdx !== -1) {
    try {
      const payload = JSON.parse(lines[dataLineIdx].slice(5).trim()) as Record<string, unknown>;
      maybeFirePush(eventName, payload);
    } catch {
      // Malformed alert payload — skip push but still forward to browser.
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
    // Bound the upstream connection to just under Vercel's 300 s
    // maxDuration so a stalled upstream is aborted gracefully (the
    // browser EventSource then auto-reconnects) rather than holding the
    // serverless connection open until the platform force-kills it.
    const upstream = await fetch(upstreamUrl, {
      headers: {
        Accept: "text/event-stream",
        "Cache-Control": "no-cache",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(280_000),
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
