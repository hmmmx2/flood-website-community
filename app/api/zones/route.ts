import { NextResponse } from "next/server";

import { javaFetch } from "@/lib/javaApi";
import {
  aggregateZones,
  type RawSensorRow,
} from "@/lib/zoneAggregate";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Public flood-zones feed for the map.
 *
 * Fetches the raw sensor list from the Java service **server-side**
 * (the browser never makes this call) and folds it into anonymised
 * zones via {@link aggregateZones}. The browser only ever receives
 * the aggregator output, which carries no per-sensor lat/lng and no
 * sensor ids. The shape of every member field is enforced by the
 * `Zone` type in `lib/types.ts`.
 *
 * If/when the Java service grows its own `/zones` endpoint, this
 * route flips to a thin pass-through and the aggregator stays on as
 * a fallback for older Java deploys.
 */
export async function GET() {
  try {
    // INTERNAL_API_KEY is the shared secret the Java service expects
    // on the X-Internal-Key header for service-to-service calls. See
    // InternalApiKeyFilter on the Java side. The browser never sees
    // this value — it's a server-side env on the BFF.
    const internalKey = process.env.INTERNAL_API_KEY;
    const headers: Record<string, string> = {};
    if (internalKey) headers["X-Internal-Key"] = internalKey;

    const rows = await javaFetch<RawSensorRow[]>("/sensors", {
      headers,
      // The aggregator is cheap; we re-fold on every poll and let the
      // browser cache nothing — privacy is the priority here.
      revalidate: 0,
    });

    const zones = aggregateZones(Array.isArray(rows) ? rows : []);

    // Cache-Control: must not be cached at the edge — this is the
    // privacy boundary and we never want a CDN to memoise a response
    // that briefly contained extra precision.
    return new NextResponse(JSON.stringify(zones), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status },
    );
  }
}
