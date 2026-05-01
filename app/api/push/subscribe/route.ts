/**
 * POST /api/push/subscribe   — save a Web Push subscription to the Java backend
 * DELETE /api/push/subscribe — remove a Web Push subscription from the Java backend
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { javaFetch } from '@/lib/javaApi';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const subscription = await req.json();
  try {
    await javaFetch<unknown>('/settings/push-subscription', {
      method: 'POST',
      body: subscription,
      token: session.accessToken,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.warn('[push/subscribe POST] backend unavailable:', message);
    return NextResponse.json({ ok: false, reason: 'Backend error' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { endpoint } = await req.json();
  try {
    await javaFetch<unknown>('/settings/push-subscription', {
      method: 'DELETE',
      body: { endpoint },
      token: session.accessToken,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.warn('[push/subscribe DELETE] backend unavailable:', message);
    return NextResponse.json({ ok: false, reason: 'Backend error' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
