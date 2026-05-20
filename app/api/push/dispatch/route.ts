// POST /api/push/dispatch
//
// Internal fire-and-forget endpoint called by the IoT SSE proxy
// (app/api/sse/iot-events/route.ts) whenever a flood-level≥2 alert
// streams through. Responsibility:
//
//   1. Redis-backed dedupe — 5-minute cooldown per (nodeId, alertType)
//      so a sensor that's flapping doesn't pummel every subscriber's
//      phone. This is GLOBAL across instances + across both apps,
//      because the SSE proxy is mounted on both community AND CRM
//      and they both see the same upstream alerts.
//
//   2. Web Push fan-out to every registered subscriber.
//      The Java backend stores subscriptions but does NOT yet send
//      to them (no web-push library on the Java side). For Stage 1
//      this endpoint logs "would dispatch to N subscribers" so the
//      pipeline + dedupe + SSE wiring can be verified end-to-end
//      before paying the cost of the actual `web-push` integration.
//      Stage 2 swaps the log for the real send.
//
// Auth: NONE — this is an internal endpoint hit only by our own SSE
// proxy from the same Vercel project (and from the sibling CRM, with
// the same shared Redis dedupe set). Treating it as public is safe
// because there's no caller-controlled side effect beyond "fan out
// the alert we just received from the trusted IoT API to people who
// already opted in".
//
// In Stage 2 we'll either add an HMAC signature header (if we want
// belt-and-braces) or rely on Vercel's serverless networking which
// can't be addressed externally without the URL leaking. Today the
// URL is public but the worst case is an attacker firing a duplicate
// push that the Redis dedupe drops within 5 min anyway.

import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Cooldown window for the same (nodeId, alertType) pair, in seconds.
 *  Chosen so a sensor stuck in a flapping state doesn't push more than
 *  once every 5 minutes — long enough to feel non-spammy on a phone,
 *  short enough that a genuine escalation reaches users quickly. */
const PUSH_DEDUPE_TTL_SECONDS = 5 * 60;

type AlertPayload = {
  nodeId: string;
  villageId?: string;
  alertType: string;
  level?: number;
  waterLevelMeters?: number;
  timestamp?: string;
  source?: "community" | "crm"; // which app fired the dispatch
};

function isValidPayload(body: unknown): body is AlertPayload {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return typeof b.nodeId === "string" && typeof b.alertType === "string";
}

export async function POST(req: NextRequest) {
  let payload: AlertPayload;
  try {
    const body = await req.json();
    if (!isValidPayload(body)) {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }
    payload = body;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  // Stage 1 — only fan out for "real" alerts (level >= 2). The SSE
  // proxy already filters this, but defence-in-depth so a manual
  // poke at this endpoint can't push a level-0 noise event.
  if ((payload.level ?? 0) < 2 && payload.alertType !== "battery_critical") {
    return NextResponse.json({ ok: true, skipped: "below_threshold" });
  }

  // Redis dedupe. SET NX with TTL: first caller wins, second caller
  // sees null and drops. Survives a Redis blip via the fail-open
  // pattern in lib/redis.ts — if Redis is down, the SET throws, the
  // catch below treats it as "couldn't dedupe, ship the push" which
  // is the right failure mode (over-deliver on outage, never under).
  const dedupeKey = `push:dispatched:${payload.nodeId}|${payload.alertType}`;
  let allowedThrough = true;
  try {
    const result = await redis.set(
      dedupeKey,
      payload.timestamp ?? new Date().toISOString(),
      { ex: PUSH_DEDUPE_TTL_SECONDS, nx: true },
    );
    if (result !== "OK") {
      allowedThrough = false;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      "[push/dispatch] redis dedupe unreachable, dispatching anyway:",
      msg,
    );
  }

  if (!allowedThrough) {
    return NextResponse.json({
      ok: true,
      skipped: "deduped",
      key: dedupeKey,
      ttl: PUSH_DEDUPE_TTL_SECONDS,
    });
  }

  // Stage 1 — log only. Stage 2 will replace this with the actual
  // `web-push` send loop:
  //
  //   const subscriptions = await javaFetch<WebPushSub[]>(
  //     "/internal/web-push-subscriptions",
  //     { headers: { "X-Internal-Key": process.env.INTERNAL_API_KEY } }
  //   );
  //   for (const sub of subscriptions) {
  //     await webpush.sendNotification(
  //       { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.authKey } },
  //       JSON.stringify({
  //         title: severityTitle(payload.alertType, payload.level),
  //         body: alertBody(payload),
  //         level: payload.level,
  //         nodeId: payload.nodeId,
  //         url: `/flood-map?focus=${encodeURIComponent(payload.nodeId)}`,
  //       }),
  //       { vapidDetails: { subject: "mailto:ops@floodwatch.example", publicKey: VAPID_PUB, privateKey: VAPID_PRIV } }
  //     ).catch(err => log skip);
  //   }
  //
  // Gated on VAPID_PRIVATE_KEY being set on the server. When unset,
  // we silently log instead of failing — Stage 2 just flips a switch.
  const vapidConfigured = !!process.env.VAPID_PRIVATE_KEY;
  console.info(
    `[push/dispatch] ` +
      `nodeId=${payload.nodeId} alertType=${payload.alertType} ` +
      `level=${payload.level ?? "n/a"} source=${payload.source ?? "unknown"} ` +
      `→ ${vapidConfigured ? "WOULD DISPATCH (stage 2 not yet wired)" : "log-only (VAPID_PRIVATE_KEY unset)"}`,
  );

  return NextResponse.json({
    ok: true,
    deduped: false,
    dispatched: 0,
    note: vapidConfigured
      ? "Stage 1: pipeline wired, fan-out implementation pending. See route comment."
      : "VAPID_PRIVATE_KEY unset — set it on Vercel + ship Stage 2 to enable real Web Push delivery.",
  });
}
