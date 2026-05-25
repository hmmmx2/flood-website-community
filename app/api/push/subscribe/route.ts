/**
 * POST /api/push/subscribe   — save a Web Push subscription to the Java backend
 * DELETE /api/push/subscribe — remove a Web Push subscription from the Java backend
 */

import { NextRequest, NextResponse } from 'next/server';
import { javaFetch } from '@/lib/javaApi';
import { requireServerAccessToken } from '@/lib/serverAuth';

export async function POST(req: NextRequest) {
  const token = await requireServerAccessToken(req);
  if (token instanceof NextResponse) return token;

  const subscription = await req.json();
  try {
    await javaFetch<unknown>('/settings/push-subscription', {
      method: 'POST',
      body: subscription,
      token: token,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.warn('[push/subscribe POST] backend unavailable:', message);
    return NextResponse.json({ ok: false, reason: 'Backend error' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const token = await requireServerAccessToken(req);
  if (token instanceof NextResponse) return token;

  const { endpoint } = await req.json();
  try {
    await javaFetch<unknown>('/settings/push-subscription', {
      method: 'DELETE',
      body: { endpoint },
      token: token,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.warn('[push/subscribe DELETE] backend unavailable:', message);
    return NextResponse.json({ ok: false, reason: 'Backend error' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
