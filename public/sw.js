/**
 * FloodWatch Community — Service Worker
 * Handles background push notification events from the Web Push API.
 *
 * Registered by lib/pushNotifications.ts via navigator.serviceWorker.register('/sw.js')
 * Receives push events from the server (Java API) using VAPID-signed payloads.
 */

const NOTIFICATION_ICON = '/images/logo.png';
const NOTIFICATION_BADGE = '/images/logo.png';

// ── Push event — fired when a push message arrives ─────────────────────────
self.addEventListener('push', (event) => {
  let data = {
    title: 'FloodWatch Alert',
    body: 'A new flood alert has been issued for your area.',
    nodeId: null,
    level: 2,
    url: '/',
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text() || data.body;
    }
  }

  // Map flood level → notification urgency
  const levelLabels = { 0: 'Normal', 1: 'Normal', 2: 'Warning', 3: 'Critical' };
  const levelLabel = levelLabels[data.level] ?? 'Alert';
  const isCritical = data.level >= 3;

  const options = {
    body: data.body,
    icon: NOTIFICATION_ICON,
    badge: NOTIFICATION_BADGE,
    tag: data.nodeId ? `flood-node-${data.nodeId}` : 'flood-alert',
    renotify: true,
    requireInteraction: isCritical,
    vibrate: isCritical ? [200, 100, 200, 100, 400] : [200, 100, 200],
    data: {
      url: data.nodeId ? `/feed?node=${data.nodeId}` : '/',
      nodeId: data.nodeId,
      level: data.level,
    },
    actions: [
      { action: 'view', title: 'View Alert' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(
      `${levelLabel} Flood Alert${data.nodeId ? ` — Node ${data.nodeId}` : ''}`,
      options
    )
  );
});

// ── Notification click — open or focus the community app ───────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Focus existing open tab
        const existing = windowClients.find(
          (c) => new URL(c.url).origin === self.location.origin
        );
        if (existing) {
          existing.focus();
          return existing.navigate(targetUrl);
        }
        // Open new tab
        return self.clients.openWindow(targetUrl);
      })
  );
});

// ── Notification close ──────────────────────────────────────────────────────
self.addEventListener('notificationclose', () => {
  // Analytics hook — could POST to /api/analytics/notification-dismissed
});
