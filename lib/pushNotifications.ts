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

/** VAPID public key — must match the key used by the Java backend to sign pushes. */
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

if (!VAPID_PUBLIC_KEY) {
  throw new Error(
    '[FloodWatch] NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set. ' +
    'Add it to .env.local (local dev) or deploy/.env (Docker). ' +
    'Generate a key pair: npx web-push generate-vapid-keys'
  );
}

/** Convert a base64url VAPID key to an ArrayBuffer for the Push API. */
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer;
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
 * The API route uses auth() server-side to authenticate the request — no token
 * parameter needed from the client.
 *
 * @returns  'subscribed' | 'denied' | 'unsupported'
 */
export async function subscribeToPush(): Promise<'subscribed' | 'denied' | 'unsupported'> {
  if (!isPushSupported()) return 'unsupported';

  // 1. Register (or reuse) the service worker
  const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;

  // 2. Request notification permission
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';

  // 3. Subscribe via PushManager
  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!),
  });

  // 4. Send subscription to Java backend (auth handled server-side via auth())
  await authFetchJson('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription.toJSON()),
  });

  return 'subscribed';
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

  await authFetchJson('/api/push/subscribe', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  });

  await sub.unsubscribe();
}
