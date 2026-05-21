import { NextRequest, NextResponse } from "next/server";

import {
  FloodwatchFetchError,
  floodwatchFetch,
} from "@/lib/floodwatch/api";
import type {
  Dataset,
  IoTNode,
  IoTVillage,
} from "@/lib/floodwatch/types";
import {
  aggregateZones,
  type RawSensorRow,
} from "@/lib/zoneAggregate";
import type { FloodLevel } from "@/lib/types";

/**
 * Deterministic small-circle jitter for nodes without a GPS fix. We
 * place them near their village centroid so they still get a circle on
 * the map — but offset by a per-node hash so the user can tell them
 * apart instead of every uncalibrated node piling on the same dot.
 *
 * The offset is bounded to ≈80 m which keeps the marker comfortably
 * inside the village footprint while honestly conveying "we don't
 * know exactly where this sensor is yet". A 32-bit FNV-1a hash of the
 * node_id is used so the offset is stable across pageloads — a node
 * doesn't appear to teleport between refreshes.
 */
function jitterFromNodeId(nodeId: string): { dLat: number; dLng: number } {
  let h = 2166136261;
  for (let i = 0; i < nodeId.length; i++) {
    h ^= nodeId.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  // Map two bytes of the hash to a unit-square (–1 … +1) offset, then
  // scale to roughly ±80 m at Pitas latitudes (≈ 7° N). 0.00072° ≈ 80 m.
  const ux = ((h & 0xffff) / 0xffff) * 2 - 1;
  const uy = (((h >>> 16) & 0xffff) / 0xffff) * 2 - 1;
  const radius = 0.00072;
  return { dLat: ux * radius, dLng: uy * radius };
}

/**
 * Hardcoded centroid fallbacks for the real-deployment village_ids that
 * the upstream FloodWatch IoT API returns *without* lat/lng populated.
 *
 * The /villages endpoint on `dataset=real` currently omits coordinates for
 * SUTS, SBH-T, CS-TEAM-TEST, SOSOP and similar Pitas-deployment villages.
 * Without these fallbacks every node resolves to (0, 0), which the
 * privacy aggregator correctly drops (it can't tell a missing fix from
 * a hardware bug, and (0,0) is the middle of the Gulf of Guinea).
 *
 * Coordinates pinned to known Pitas-district landmarks. When the upstream
 * starts publishing real GPS we drop these and use the live lat/lng.
 */
const REAL_VILLAGE_FALLBACK_COORDS: Record<string, { lat: number; lng: number }> = {
  SUTS:            { lat: 6.8615, lng: 117.0157 }, // Pitas town centre
  "SBH-T":         { lat: 6.8742, lng: 117.0289 }, // Sabah-T test site (Pitas)
  "CS-TEAM-TEST":  { lat: 6.8550, lng: 117.0080 }, // CS team field deployment
  SOSOP:           { lat: 6.8920, lng: 117.0410 }, // Kg Sosop, Pitas
  "PITAS-SOSOP":   { lat: 6.8920, lng: 117.0410 }, // same village, alternate id
  MANDAMAI:        { lat: 6.8480, lng: 117.0220 }, // Kg Mandamai, Pitas
  // Anything else falls back to the Pitas-region anchor via the
  // hash-spread helper below so every node still gets a circle.
};

/** Pitas regional anchor for villages we don't have specific coords for.
 *  ±2 km hash-spread so multiple unknown villages don't pile on the same
 *  pixel. */
const PITAS_ANCHOR = { lat: 6.8615, lng: 117.0157 };
function unknownVillageCoord(villageId: string): { lat: number; lng: number } {
  let h = 2166136261;
  for (let i = 0; i < villageId.length; i++) {
    h ^= villageId.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  const ux = ((h & 0xffff) / 0xffff) * 2 - 1;
  const uy = (((h >>> 16) & 0xffff) / 0xffff) * 2 - 1;
  const radius = 0.018; // ≈ 2 km at this latitude
  return { lat: PITAS_ANCHOR.lat + ux * radius, lng: PITAS_ANCHOR.lng + uy * radius };
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Public flood-zones feed for the community map.
 *
 * Source of truth is now the **FloodWatch IoT API** (FastAPI service at
 * FLOODWATCH_API_BASE). We pull the live `nodes` list, adapt each row
 * to the legacy `RawSensorRow` shape, then fold through the existing
 * {@link aggregateZones} privacy filter. The browser only ever sees
 * the aggregator output — per-node lat/lng are still rounded to ~11 m
 * on the wire and node IDs are still hashed.
 *
 * The route path stays `/api/zones` for backward compatibility with
 * the flood-map page; only the upstream changed.
 */
export async function GET(req: NextRequest) {
  const dataset = (req.nextUrl.searchParams.get("dataset") ?? undefined) as
    | Dataset
    | undefined;

  try {
    // Fetch villages alongside nodes so we have a fallback coordinate
    // for any node that hasn't completed its GPS calibration yet. The
    // simulator runs ~5/22 nodes without a fix on purpose; without
    // this fallback those nodes' alerts fire in the dock but their
    // circles never appear on the map.
    const [nodes, villages] = await Promise.all([
      floodwatchFetch<IoTNode[]>("/nodes", {
        params: dataset ? { dataset } : undefined,
      }),
      floodwatchFetch<IoTVillage[]>("/villages", {
        params: dataset ? { dataset } : undefined,
      }).catch(() => [] as IoTVillage[]),
    ]);

    const villageCoords = new Map<string, { lat: number; lng: number }>();
    for (const v of villages) {
      if (typeof v.lat === "number" && typeof v.lng === "number") {
        villageCoords.set(v.village_id, { lat: v.lat, lng: v.lng });
      }
    }

    const rows: RawSensorRow[] = nodes.map((n) => {
      // Coordinate resolution order (each step tries the next on falsy/0):
      //   1. calibrated install GPS (`install_lat/install_lng`)
      //   2. live GPS fix (`lat/lng`) when present and non-zero
      //   3. upstream village centroid + per-node jitter (~80 m)
      //   4. hardcoded fallback for known real-deployment village_ids
      //      (the upstream /villages endpoint omits coords for these)
      //   5. Pitas regional anchor + per-village hash-spread (~2 km)
      // The cascade guarantees every node gets a usable coordinate so
      // none get dropped by the privacy aggregator's (0,0) safety filter.
      let lat = n.install_lat ?? n.lat ?? 0;
      let lng = n.install_lng ?? n.lng ?? 0;
      if (!Number(lat) || !Number(lng)) {
        const v = villageCoords.get(n.village_id);
        if (v) {
          const { dLat, dLng } = jitterFromNodeId(n.node_id);
          lat = v.lat + dLat;
          lng = v.lng + dLng;
        } else {
          // Step 4: hardcoded village centroid for the real-deployment
          // village_ids that the upstream /villages endpoint currently
          // returns with null coords. Combine with per-node jitter so
          // multiple nodes in the same village don't overlap.
          const fb = REAL_VILLAGE_FALLBACK_COORDS[n.village_id]
            ?? unknownVillageCoord(n.village_id); // Step 5: Pitas anchor
          const { dLat, dLng } = jitterFromNodeId(n.node_id);
          lat = fb.lat + dLat;
          lng = fb.lng + dLng;
        }
      }
      return {
        id: n.node_id,
        nodeId: n.node_id,
        name: null,
        area: n.village_id,
        location: n.village_id,
        state: "Sabah",
        latitude: Number(lat) || 0,
        longitude: Number(lng) || 0,
        currentLevel: (n.water_level ?? 0) as FloodLevel,
        status: n.status === "offline" ? "inactive" : "active",
        lastUpdated: n.last_seen,
      };
    });

    const zones = aggregateZones(rows);

    return new NextResponse(JSON.stringify(zones), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        // Privacy boundary: never cache at the edge.
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    });
  } catch (error) {
    if (error instanceof FloodwatchFetchError) {
      return NextResponse.json(
        { error: error.message, status: error.status },
        { status: error.status || 502 },
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 },
    );
  }
}
