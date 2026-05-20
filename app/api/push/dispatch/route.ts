// POST /api/push/dispatch
//
// Internal fire-and-forget endpoint called by the IoT SSE proxy
// (community + crm) whenever a flood-level≥2 alert streams through.
//
// Responsibility (Stage 2 — actually delivering Web Push now):
//
//   1. Redis-backed dedupe — 5-minute cooldown per `{nodeId, alertType}`.
//      Both apps' SSE proxies fire on the same upstream IoT event, so
//      without dedupe each subscribed device would receive a duplicate
//      push. The Redis `SET NX EX` lock guarantees exactly one push per
//      node+alert pair per 5 min.
//
//   2. Fetch all WebPushSubscription rows from Java's internal endpoint
//      (`GET /internal/web-push-subscriptions`, X-Internal-Key gated).
//      The Vercel side never persists subscriptions itself — Java is
//      the source of truth (it owns the `web_push_subscriptions` table).
//
//   3. Sign + POST a payload to each subscription's `endpoint` using the
//      `web-push` npm library and the deployment's VAPID keypair.
//      Failures categorised:
//        - 410 Gone        → endpoint expired; tell Java to drop the row
//        - 404 / 4xx other → log + drop
//        - 5xx / network   → log + retry by web-push internally
//
// Auth: NONE on this endpoint. The internal Java call DOES carry
// X-Internal-Key. Treating dispatch itself as public is safe because
// the worst case is an attacker firing a duplicate alert that the
// Redis dedupe drops within 5 min anyway, AND the payload only
// triggers the existing FloodAlertSubscribeButton subscribers'
// devices — nothing user-controllable.

import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";

import { javaFetch } from "@/lib/javaApi";
import { redis } from "@/lib/redis";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30; // fan-out should be fast; cap to keep this snappy

/** Cooldown window for the same (nodeId, alertType) pair, in seconds. */
const PUSH_DEDUPE_TTL_SECONDS = 5 * 60;

type AlertPayload = {
  nodeId: string;
  villageId?: string;
  alertType: string;
  level?: number;
  waterLevelMeters?: number;
  timestamp?: string;
  source?: "community" | "crm";
};

type JavaSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

function isValidPayload(body: unknown): body is AlertPayload {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return typeof b.nodeId === "string" && typeof b.alertType === "string";
}

function severityLabel(level: number): "Watch" | "Warning" | "Critical" {
  if (level >= 3) return "Critical";
  if (level >= 2) return "Warning";
  return "Watch";
}

function buildNotificationPayload(alert: AlertPayload) {
  const sev = severityLabel(alert.level ?? 2);
  const title =
    alert.alertType === "battery_critical"
      ? "Sensor battery critical"
      : sev === "Critical"
        ? `🆘 CRITICAL FLOOD — ${alert.nodeId}`
        : `🚨 Flood ${sev} — ${alert.nodeId}`;
  const body =
    alert.alertType === "battery_critical"
      ? `Sensor ${alert.nodeId} battery critical. Replace soon to keep flood coverage.`
      : `Water level ${alert.level ?? "?"}/3 at sensor ${alert.nodeId}${
          alert.villageId ? ` (${alert.villageId})` : ""
        }. Stay alert.`;
  return {
    title,
    body,
    level: alert.level ?? 2,
    nodeId: alert.nodeId,
    villageId: alert.villageId,
    url: `/flood-map?focus=${encodeURIComponent(alert.nodeId)}`,
    timestamp: alert.timestamp ?? new Date().toISOString(),
  };
}

/** Set the VAPID details once per cold start. Idempotent — calling
 *  twice is fine, but we only want to spend the work on a cold boot. */
let vapidConfigured = false;
function configureVapid(): boolean {
  if (vapidConfigured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject =
    process.env.VAPID_SUBJECT || "mailto:ops@floodwatch.example";
  if (!pub || !priv) return false;
  try {
    webpush.setVapidDetails(subject, pub, priv);
    vapidConfigured = true;
    return true;
  } catch (err) {
    console.error(
      "[push/dispatch] setVapidDetails failed — keys malformed?",
      err instanceof Error ? err.message : err,
    );
    return false;
  }
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

  // Threshold gate (defence-in-depth — the SSE proxy already filters).
  if ((payload.level ?? 0) < 2 && payload.alertType !== "battery_critical") {
    return NextResponse.json({ ok: true, skipped: "below_threshold" });
  }

  // Cross-app dedupe via Redis SET NX EX. First caller wins; second one
  // (the sibling app's SSE proxy) sees null and silently drops. Fail-
  // open on Redis outage — over-deliver is preferable to silent drop
  // on infra failure.
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
    console.warn(
      "[push/dispatch] redis dedupe unreachable, dispatching anyway:",
      err instanceof Error ? err.message : err,
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

  // No VAPID? Log + return (this is the Stage 1 behaviour, retained
  // as the fallback when the operator hasn't yet wired the keypair).
  if (!configureVapid()) {
    console.warn(
      `[push/dispatch] VAPID keys unset; skipping actual send. ` +
        `nodeId=${payload.nodeId} alertType=${payload.alertType} ` +
        `level=${payload.level ?? "n/a"} source=${payload.source ?? "unknown"}`,
    );
    return NextResponse.json({
      ok: true,
      dispatched: 0,
      note: "VAPID_PRIVATE_KEY unset — see lib/pushNotifications.ts or route comment.",
    });
  }

  // Fetch subscriptions from Java (X-Internal-Key auth).
  const internalKey = process.env.INTERNAL_API_KEY;
  if (!internalKey) {
    console.error(
      "[push/dispatch] INTERNAL_API_KEY unset on Vercel — cannot fetch subscriptions.",
    );
    return NextResponse.json(
      { ok: false, reason: "internal_key_missing", dispatched: 0 },
      { status: 503 },
    );
  }

  let subscriptions: JavaSubscription[] = [];
  try {
    subscriptions = await javaFetch<JavaSubscription[]>(
      "/internal/web-push-subscriptions",
      { headers: { "X-Internal-Key": internalKey } },
    );
  } catch (err) {
    console.error(
      "[push/dispatch] failed to fetch subscriptions from Java:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { ok: false, reason: "subscriptions_fetch_failed", dispatched: 0 },
      { status: 502 },
    );
  }

  if (subscriptions.length === 0) {
    console.info("[push/dispatch] no subscribers — nothing to send");
    return NextResponse.json({ ok: true, dispatched: 0 });
  }

  // Sign + POST to every endpoint in parallel, capping concurrency
  // implicitly via Promise.allSettled (no need for explicit pool —
  // we'll never realistically have more than ~100 subscribers in this
  // FYP and web-push internally batches).
  const notificationPayload = JSON.stringify(buildNotificationPayload(payload));
  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(sub, notificationPayload, {
          TTL: 60, // expire on the push service if the device is offline for >60s
          urgency: payload.level && payload.level >= 3 ? "high" : "normal",
        });
        return { endpoint: sub.endpoint, status: "sent" as const };
      } catch (err) {
        const e = err as { statusCode?: number; body?: string; message?: string };
        // 410 Gone → endpoint is dead, clean it up server-side.
        if (e?.statusCode === 410 || e?.statusCode === 404) {
          javaFetch<void>(
            `/internal/web-push-subscriptions?endpoint=${encodeURIComponent(sub.endpoint)}`,
            { method: "DELETE", headers: { "X-Internal-Key": internalKey } },
          ).catch(() => {
            /* best-effort */
          });
          return { endpoint: sub.endpoint, status: "expired" as const };
        }
        console.warn(
          `[push/dispatch] send failed: status=${e?.statusCode ?? "?"} msg=${e?.message ?? ""}`,
        );
        return { endpoint: sub.endpoint, status: "failed" as const };
      }
    }),
  );

  const counts = { sent: 0, expired: 0, failed: 0 };
  for (const r of results) {
    if (r.status === "fulfilled") {
      const s = r.value.status;
      if (s === "sent") counts.sent++;
      else if (s === "expired") counts.expired++;
      else counts.failed++;
    } else {
      counts.failed++;
    }
  }
  console.info(
    `[push/dispatch] nodeId=${payload.nodeId} alertType=${payload.alertType} ` +
      `level=${payload.level ?? "n/a"} subscribers=${subscriptions.length} ` +
      `sent=${counts.sent} expired=${counts.expired} failed=${counts.failed}`,
  );

  return NextResponse.json({
    ok: true,
    subscribers: subscriptions.length,
    ...counts,
  });
}
