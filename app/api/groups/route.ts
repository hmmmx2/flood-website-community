import { NextResponse } from "next/server";
import { javaFetch } from "@/lib/javaApi";
import { withCache, CACHE_TTL } from "@/lib/redis";

export const dynamic = "force-dynamic";

/**
 * GET /api/groups — public list of community groups.
 *
 * Performance (2026-05-22): deliberately does NOT call `auth()`. The
 * `/community/groups` upstream is in Java's `permitAll` list and the
 * cache key doesn't vary by user. Calling auth() on every request
 * just added ~150 ms of session-resolution work for a response that
 * was about to be served straight from the Redis cache anyway.
 */
export async function GET() {
  try {
    const data = await withCache("groups:all", CACHE_TTL.groups, () =>
      javaFetch<unknown>("/community/groups"),
    );
    return NextResponse.json(data);
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status });
  }
}
