import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Deprecated: the public flood-map surface no longer exposes
 * per-sensor coordinates. The browser must use {@code /api/zones}
 * (privacy-aggregated zones) instead. The Java backend is the source
 * of truth and is locked behind authentication for /sensors — see
 * {@code SecurityConfig.java} + {@code InternalApiKeyFilter.java}.
 *
 * We keep the route mounted as a 410 Gone so that any older
 * snapshots / CDN edges that still point here get an obvious signal
 * (and a hint to the new endpoint) rather than silently 404.
 */
export async function GET() {
  return NextResponse.json(
    {
      code: "GONE",
      message:
        "This endpoint has been retired for privacy. " +
        "Use /api/zones for the public flood map data.",
    },
    { status: 410 },
  );
}
