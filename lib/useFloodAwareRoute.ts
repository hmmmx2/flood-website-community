"use client";

/**
 * Flood-aware route scoring (P1-6).
 *
 * Given a list of Google `DirectionsRoute`s and the public zone list,
 * compute a flood-impact label for each route and re-rank so any route
 * crossing a `worstLevel >= 2` zone falls below the safe ones.
 *
 * We can't use `google.maps.geometry.poly.containsLocation` directly
 * because our zones are circles, not polygons. Instead we sample the
 * route polyline and check the great-circle distance to every
 * WARNING+ zone centroid; if any sample falls inside the zone's
 * `radiusM`, the route is flagged.
 *
 * The sampling step is keyed by route length — short routes get the
 * full polyline, long routes thin out to ~150 points (Google's
 * overview_polyline is already simplified, so this is plenty).
 */

import { useMemo } from "react";

import type { Zone } from "@/lib/types";

export type FloodImpact = "ok" | "warning" | "critical";

/**
 * A flat Lat/Lng pair we can derive from either an encoded polyline
 * string or the SDK's nested `LatLng` objects, without forcing the
 * caller to commit to one shape.
 */
export type PointLatLng = { lat: number; lng: number };

export type ScoredRoute<R> = {
  /** The original route object, untouched. */
  route: R;
  /** Worst zone level the route crosses (0 if none). */
  worstCrossing: 0 | 2 | 3;
  /** `ok` if no warning+ crossing, `warning` for level 2, `critical` for level 3. */
  impact: FloodImpact;
  /** Up-to-three sample names of the zones the route passes through. */
  passedZoneNames: string[];
};

const EARTH_M = 6_371_000;

function haversineM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Thins a polyline to roughly `target` points. Used so a 100 km route
 * doesn't run hundreds of thousands of haversine comparisons against
 * dozens of zones.
 */
function sample(points: PointLatLng[], target = 150): PointLatLng[] {
  if (points.length <= target) return points;
  const step = points.length / target;
  const out: PointLatLng[] = [];
  for (let i = 0; i < target; i++) {
    const idx = Math.floor(i * step);
    out.push(points[idx]);
  }
  // Always keep the final point so the destination is included.
  out.push(points[points.length - 1]);
  return out;
}

/**
 * Pure scoring function — exported so it's unit-testable independent
 * of the React hook.
 */
export function scoreRoutes<R extends { polyline: PointLatLng[] }>(
  routes: R[],
  zones: Zone[],
): ScoredRoute<R>[] {
  const risky = zones.filter(
    z => !z.allOffline && z.worstLevel >= 2,
  );

  return routes.map(route => {
    const pts = sample(route.polyline);
    let worst: 0 | 2 | 3 = 0;
    const names: string[] = [];
    for (const zone of risky) {
      let hit = false;
      for (const p of pts) {
        if (haversineM(p.lat, p.lng, zone.centroidLat, zone.centroidLng) <= zone.radiusM) {
          hit = true;
          break;
        }
      }
      if (!hit) continue;
      if (zone.worstLevel > worst) worst = zone.worstLevel as 2 | 3;
      if (names.length < 3) names.push(zone.name);
    }
    const impact: FloodImpact = worst === 3 ? "critical" : worst === 2 ? "warning" : "ok";
    return { route, worstCrossing: worst, impact, passedZoneNames: names };
  });
}

/**
 * Hook wrapping {@link scoreRoutes} so callers can pass live
 * Google Maps `DirectionsRoute[]` and get scored copies back, memoised
 * on route + zone identity.
 */
export function useFloodAwareRoutes(
  routes: google.maps.DirectionsRoute[] | null,
  zones: Zone[],
): ScoredRoute<google.maps.DirectionsRoute>[] {
  return useMemo(() => {
    if (!routes || routes.length === 0) return [];
    const enriched = routes.map(r => ({
      ...r,
      polyline: extractRoutePolyline(r),
    }));
    return scoreRoutes(enriched, zones);
  }, [routes, zones]);
}

/**
 * Flattens a route's per-leg per-step polyline data into a single
 * Lat/Lng list. The overview polyline is also available but is more
 * lossy; the step-level data gives us better hit-detection at minor
 * extra cost.
 */
export function extractRoutePolyline(route: google.maps.DirectionsRoute): PointLatLng[] {
  const out: PointLatLng[] = [];
  for (const leg of route.legs ?? []) {
    for (const step of leg.steps ?? []) {
      // `path` is an array of LatLng — already decoded by the SDK.
      const path = step.path ?? [];
      for (const ll of path) {
        out.push({ lat: ll.lat(), lng: ll.lng() });
      }
    }
  }
  if (out.length === 0) {
    // Fallback to the overview path if step data isn't present.
    for (const ll of route.overview_path ?? []) {
      out.push({ lat: ll.lat(), lng: ll.lng() });
    }
  }
  return out;
}
