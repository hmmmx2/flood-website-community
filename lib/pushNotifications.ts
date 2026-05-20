'use client';

import { authFetchJson } from '@/lib/fetchJson';

/**
 * Web Push Notification utilities for the FloodWatch Community website.
 *
 * Uses the browser's native Push API + a registered Service Worker (public/sw.js).
 * The server sends VAPID-signed push messages; we store the PushSubscription
 * object in the Java backend via POST /settings/push-subscription.
 *
 * Usage (in a client component or settings page):
 *   import { subscribeToPush, unsubscribeFromPush, isPushSupported, getSubscriptionState } from '@/lib/pushNotifications';
 */

/** VAPID public key — must match the key used by the Java backend to sign pushes.
 *
 *  IMPORTANT: deliberately NOT throwing at import time. If the env var is
 *  unset on Vercel, an import-time throw would crash every page that
 *  statically imports this module (settings, flood-map, etc.). Instead
 *  we let import succeed and surface a clear error when the user actually
 *  tries to subscribe — that way the rest of the app keeps working. */
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

/** Subscribe result — extended to carry an explanation for the UI layer.
 *  Settings + the flood-map button both render this directly. */
export type SubscribeResult =
  | 'subscribed'
  | 'denied'           // user (or system) declined Notification permission
  | 'unsupported'      // browser lacks Push API or SW
  | 'misconfigured'    // VAPID key missing or malformed at the deployment
  | 'blocked-by-os'    // OS / browser-policy refused registration despite granted permission
  | 'transient-error'; // network / push-service failure; retry usually works

export type SubscribeOutcome = {
  result: SubscribeResult;
  /** Human-readable explanation safe to show in a toast or banner. */
  message: string;
  /** Original error for debugging; only set when subscribe threw. */
  cause?: unknown;
};

/** Convert a base64url VAPID key to a Uint8Array for the Push API.
 *  Returns the raw bytes (not an ArrayBuffer) so callers can byte-compare
 *  against an existing subscription's applicationServerKey. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/** Validate that a string is a real VAPID public key:
 *    base64url-decodes to exactly 65 bytes, starts with 0x04 (uncompressed P-256).
 *  Returns the decoded bytes on success, or null with a reason on failure. */
function decodeVapidKey(key: string | undefined | null):
  | { ok: true; bytes: Uint8Array }
  | { ok: false; reason: string } {
  if (!key) return { ok: false, reason: 'NEXT_PUBLIC_VAPID_PUBLIC_KEY is not configured for this deployment.' };
  let bytes: Uint8Array;
  try {
    bytes = urlBase64ToUint8Array(key);
  } catch {
    return { ok: false, reason: 'NEXT_PUBLIC_VAPID_PUBLIC_KEY is not valid base64url.' };
  }
  if (bytes.length !== 65) {
    return {
      ok: false,
      reason: `VAPID public key decodes to ${bytes.length} bytes (expected 65). Regenerate via 'npx web-push generate-vapid-keys'.`,
    };
  }
  if (bytes[0] !== 0x04) {
    return {
      ok: false,
      reason: 'VAPID public key is not an uncompressed P-256 point (first byte must be 0x04).',
    };
  }
  return { ok: true, bytes };
}

/** Byte-compare two ArrayBufferLike values for equality. Used to detect when
 *  an existing PushSubscription was issued against a different VAPID key. */
function bytesEqual(a: ArrayBufferLike | null, b: Uint8Array | null): boolean {
  if (!a || !b) return false;
  const va = new Uint8Array(a);
  if (va.length !== b.length) return false;
  for (let i = 0; i < va.length; i++) if (va[i] !== b[i]) return false;
  return true;
}

/** Returns true when the current browser supports Web Push. */
export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** Returns the current push subscription state for the user. */
export async function getSubscriptionState(): Promise<{
  permission: NotificationPermission;
  subscribed: boolean;
}> {
  if (!isPushSupported()) {
    return { permission: 'denied', subscribed: false };
  }

  const permission = Notification.permission;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    const reg = regs.find(r => r.scope === `${location.origin}/`);
    if (!reg) return { permission, subscribed: false };
    const sub = await reg.pushManager.getSubscription();
    return { permission, subscribed: !!sub };
  } catch {
    return { permission, subscribed: false };
  }
}

/**
 * Registers the service worker, requests notification permission, subscribes
 * to push notifications, and sends the PushSubscription to the Java backend.
 *
 * Hardening v2 (2026-05-21): translates the cryptic Chromium error
 *   "Registration failed - permission denied" into one of three concrete
 *   reasons (stale key, OS block, invalid VAPID config) so the UI can give
 *   the user the right next step instead of a useless echo of the raw error.
 *
 * @returns SubscribeOutcome with a structured result + UI-friendly message.
 */
export async function subscribeToPush(): Promise<SubscribeOutcome> {
  if (!isPushSupported()) {
    return {
      result: 'unsupported',
      message: "This browser doesn't support push notifications.",
    };
  }

  // 0. VAPID config sanity. Catches both unset env var (common on a fresh
  //    Vercel project) and copy-paste mistakes (truncated key, wrong format).
  const vapid = decodeVapidKey(VAPID_PUBLIC_KEY);
  if (!vapid.ok) {
    console.error('[push] VAPID key invalid:', vapid.reason);
    return {
      result: 'misconfigured',
      message:
        "Push notifications aren't configured for this deployment yet. " +
        'Please ask the administrator to set NEXT_PUBLIC_VAPID_PUBLIC_KEY on the server.',
    };
  }

  // 1. Register (or reuse) the service worker.
  let reg: ServiceWorkerRegistration;
  try {
    reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
  } catch (err) {
    console.error('[push] service worker registration failed:', err);
    return {
      result: 'transient-error',
      message:
        'Could not register the background notification worker. Try reloading the page or check if a browser extension is blocking service workers.',
      cause: err,
    };
  }

  // 2. Request notification permission. If the user has previously denied,
  //    this returns 'denied' synchronously without showing a prompt — surface
  //    a message that actually points them at fixing it.
  let permission: NotificationPermission;
  try {
    permission = await Notification.requestPermission();
  } catch (err) {
    console.error('[push] requestPermission threw:', err);
    return {
      result: 'denied',
      message:
        'Could not request notification permission. Check your browser site settings (lock icon in the address bar).',
      cause: err,
    };
  }
  if (permission !== 'granted') {
    return {
      result: 'denied',
      message:
        permission === 'denied'
          ? 'Notifications are blocked for this site. Click the lock icon in the address bar to re-enable them.'
          : 'Notification permission was not granted.',
    };
  }

  // 3. Stale-subscription cleanup. If an existing subscription was issued
  //    against a different VAPID public key (because we redeployed with a
  //    new key, or because the user is hitting a different environment for
  //    the first time), pushManager.subscribe() throws
  //      "Registration failed - permission denied"
  //    — Chromium's misleading default for "applicationServerKey mismatch".
  //    Unsubscribe the stale one first; we'll re-subscribe with the right key
  //    immediately after.
  try {
    const existing = await reg.pushManager.getSubscription();
    if (existing) {
      const existingKey = existing.options?.applicationServerKey ?? null;
      if (!bytesEqual(existingKey, vapid.bytes)) {
        console.info(
          '[push] existing subscription has a different VAPID key — clearing it before re-subscribing',
        );
        await existing.unsubscribe();
      }
    }
  } catch (err) {
    // Non-fatal — proceed to subscribe and let the error surface there.
    console.warn('[push] could not inspect existing subscription:', err);
  }

  // 4. Subscribe via PushManager.
  //    NOTE: applicationServerKey accepts BufferSource — we pass a fresh copy
  //    of the bytes (Chromium has been buggy about reusing the same buffer).
  let subscription: PushSubscription;
  try {
    // Spec accepts BufferSource; copy into a fresh ArrayBuffer so TS's
    // strict ArrayBuffer-vs-ArrayBufferLike check is satisfied and the
    // browser doesn't accidentally see a SharedArrayBuffer-backed view.
    const keyBuffer = new ArrayBuffer(vapid.bytes.byteLength);
    new Uint8Array(keyBuffer).set(vapid.bytes);
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBuffer,
    });
  } catch (err) {
    const msg = String((err as Error)?.message ?? err);
    console.error('[push] pushManager.subscribe failed:', msg, err);

    // The classic Chromium / Edge messages we see in the wild:
    //   "Registration failed - permission denied"
    //   "Registration failed - push service error"
    //   "Registration failed - storage error"
    //   "Registration failed - no active Service Worker"
    if (/permission denied/i.test(msg)) {
      return {
        result: 'blocked-by-os',
        message:
          'Your browser allowed notifications, but the system blocked push registration. ' +
          'Check Windows Settings → System → Notifications (ensure your browser is allowed), ' +
          'turn off Focus Assist / Do Not Disturb, and try again. ' +
          'If this keeps happening, sign out and back in — there may be a stale subscription.',
        cause: err,
      };
    }
    if (/push service|storage error/i.test(msg)) {
      return {
        result: 'transient-error',
        message:
          'The push service is temporarily unavailable. Please try again in a minute.',
        cause: err,
      };
    }
    if (/no active service worker/i.test(msg)) {
      return {
        result: 'transient-error',
        message:
          'The background notification worker is not active yet. Reload the page and try again.',
        cause: err,
      };
    }
    return {
      result: 'transient-error',
      message: `Could not enable push notifications: ${msg}`,
      cause: err,
    };
  }

  // 5. Send subscription to Java backend (auth handled server-side via auth()).
  try {
    await authFetchJson('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription.toJSON()),
    });
  } catch (err) {
    // Roll back the local subscription so we don't leave the browser holding
    // a registration the server doesn't know about — next click will retry cleanly.
    console.error('[push] backend persistence failed; rolling back subscription:', err);
    try { await subscription.unsubscribe(); } catch { /* */ }
    return {
      result: 'transient-error',
      message:
        'Notifications were registered locally but the server could not save your subscription. Please try again.',
      cause: err,
    };
  }

  return {
    result: 'subscribed',
    message: "You'll get flood alerts on this device.",
  };
}

/**
 * Unsubscribes the user from push notifications and removes the subscription
 * from the Java backend.
 *
 * The API route uses auth() server-side to authenticate the request — no token
 * parameter needed from the client.
 */
export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return;

  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  if (!reg) return;

  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;

  // Best-effort server cleanup first so the row goes away even if local
  // unsubscribe surprises us.
  try {
    await authFetchJson('/api/push/subscribe', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
  } catch (err) {
    console.warn('[push] server-side unsubscribe failed (continuing with local unsub):', err);
  }

  await sub.unsubscribe();
}
