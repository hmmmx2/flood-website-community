/**
 * POST /api/push/subscribe   — save a Web Push subscription to the Java backend
 * DELETE /api/push/subscribe — remove a Web Push subscription from the Java backend
 *
 * The client (lib/pushNotifications.ts) calls this after subscribing via PushManager.
 * This route proxies to the Java API: POST /settings/push-subscription
 */

import { NextRequest, NextResponse } from 'next/server';
import { javaFetch } from '@/lib/javaApi';

// ── POST — store subscription ──────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.replace('Bearer ', '').trim();

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const subscription = await req.json();

  try {
    await javaFetch<unknown>('/settings/push-subscription', {
      method: 'POST',
      body: subscription,
      token,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.warn('[push/subscribe POST] backend unavailable:', message);
    return NextResponse.json({ ok: false, reason: 'Backend error' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

// ── DELETE — remove subscription ───────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.replace('Bearer ', '').trim();

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { endpoint } = await req.json();

  try {
    await javaFetch<unknown>('/settings/push-subscription', {
      method: 'DELETE',
      body: { endpoint },
      token,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.warn('[push/subscribe DELETE] backend unavailable:', message);
    return NextResponse.json({ ok: false, reason: 'Backend error' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
