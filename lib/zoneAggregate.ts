/**
 * Server-side privacy aggregator.
 *
 * Takes the raw list of sensor rows from the Java service and folds it
 * into a list of zones (group-by area + state). The browser only ever
 * receives the output of this function — never the per-sensor lat/lng.
 *
 * Privacy contract enforced here:
 *   1. Each zone's centroid is rounded to 3 decimal places (~110 m on
 *      the equator). Even if someone reverse-engineers the polygon,
 *      they get an area, not a sensor location.
 *   2. Each zone's radius is clamped to >= 800 m. Single-sensor zones
 *      can't shrink to a tight circle around the device.
 *   3. The raw `sensorCount` is never exposed; a coarse band
 *      ("single" / "few" / "many") replaces it on the wire.
 *   4. No `sensorId`, no `nodeId`, and no per-member lat/lng appears
 *      anywhere in the output type.
 *
 * The function is pure so it's unit-testable; the BFF route in
 * `app/api/zones/route.ts` is the only caller in production.
 */

import type { FloodLevel, Zone, ZoneSensorBand } from "@/lib/types";

/**
 * Subset of the Java SensorNodeDto shape that this aggregator needs.
 * Keeping it loose so a future column on the Java row doesn't break us.
 */
export type RawSensorRow = {
  id?: string;
  nodeId?: string;
  name?: string | null;
  area?: string | null;
  location?: string | null;
  state?: string | null;
  latitude: number;
  longitude: number;
  currentLevel: FloodLevel;
  /** Server side encoding — "inactive" means the radio went dark. */
  status?: "active" | "warning" | "critical" | "inactive";
  lastUpdated?: string;
};

const RADIUS_MIN_M = 800;
const RADIUS_MAX_M = 3000;
/** Multiplier on the farthest-member distance — gives a visible halo. */
const RADIUS_PADDING = 1.3;

/** Haversine in metres — used to size the zone radius. */
function haversineM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Rounded to 3 d.p. — the privacy step. */
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Coarse banding so we never publish the raw cluster size. */
function band(n: number): ZoneSensorBand {
  if (n <= 1) return "single";
  if (n <= 4) return "few";
  return "many";
}

/**
 * Stable id from (state|area). Two reloads with the same membership
 * give the same id; we use a tiny FNV-1a 32-bit hash so it's stable
 * across server restarts and across language boundaries (a future
 * Java aggregator can reproduce it byte-for-byte).
 */
function stableZoneId(state: string, area: string): string {
  const s = `${state.trim().toLowerCase()}|${area.trim().toLowerCase()}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    // 32-bit FNV prime, kept in JS safe-int range with imul.
    h = Math.imul(h, 0x01000193);
  }
  // Force unsigned, base36, prefix so it never collides with a UUID
  // that some older client might still cache as a node id.
  return "z_" + (h >>> 0).toString(36);
}

/**
 * Aggregate a list of raw sensor rows into a list of zones. Pure
 * function — no I/O, no side effects, no globals.
 */
export function aggregateZones(rows: RawSensorRow[]): Zone[] {
  // Group rows by (state, area). Rows missing either field roll up
  // under "Unknown" so we don't silently drop them — they'd be dropped
  // for being a single-sensor area anyway if too sparse.
  const groups = new Map<string, RawSensorRow[]>();
  for (const r of rows) {
    if (!Number.isFinite(r.latitude) || !Number.isFinite(r.longitude)) continue;
    const state = (r.state ?? "Unknown").trim();
    const area = (r.area ?? r.location ?? "Unknown").trim();
    const key = `${state}|${area}`;
    const list = groups.get(key);
    if (list) list.push(r);
    else groups.set(key, [r]);
  }

  const zones: Zone[] = [];
  for (const [key, members] of groups) {
    if (members.length === 0) continue;
    const [state, area] = key.split("|");

    // Centroid = arithmetic mean. Acceptable since member counts are
    // small (tens at most) so we never need a great-circle midpoint.
    let sumLat = 0;
    let sumLng = 0;
    for (const m of members) {
      sumLat += m.latitude;
      sumLng += m.longitude;
    }
    const rawCentroidLat = sumLat / members.length;
    const rawCentroidLng = sumLng / members.length;
    const centroidLat = round3(rawCentroidLat);
    const centroidLng = round3(rawCentroidLng);

    // Radius — farthest member from the RAW centroid (so single-member
    // groups get radius 0), padded, then clamped to [800 m, 3000 m].
    // The clamp is the second privacy lever: even a single-sensor zone
    // gets a 800 m halo so the exact point can't be inferred from the
    // circle edge.
    let farthest = 0;
    for (const m of members) {
      const d = haversineM(rawCentroidLat, rawCentroidLng, m.latitude, m.longitude);
      if (d > farthest) farthest = d;
    }
    const padded = farthest * RADIUS_PADDING;
    const radiusM = Math.round(Math.min(RADIUS_MAX_M, Math.max(RADIUS_MIN_M, padded)));

    // Worst status across online members. If every member is offline
    // we still emit the zone but flag `anyOffline` so the UI can grey
    // it out — better than the zone vanishing.
    let worst: FloodLevel = 0;
    let anyOffline = false;
    let allOffline = true;
    for (const m of members) {
      if (m.status === "inactive") anyOffline = true;
      else allOffline = false;
      if (m.status !== "inactive" && (m.currentLevel ?? 0) > worst) {
        worst = m.currentLevel;
      }
    }
    if (allOffline) anyOffline = true;

    // Most recent updatedAt across the cluster — handy for the "last
    // updated 3 s ago" line in the legend.
    let lastUpdated: string | undefined;
    for (const m of members) {
      if (!m.lastUpdated) continue;
      if (!lastUpdated || m.lastUpdated > lastUpdated) lastUpdated = m.lastUpdated;
    }

    zones.push({
      id: stableZoneId(state, area),
      name: area,
      state,
      area,
      centroidLat,
      centroidLng,
      radiusM,
      worstLevel: worst,
      anyOffline,
      allOffline,
      sensorBand: band(members.length),
      lastUpdated,
    });
  }

  // Sort by (state, name) so consecutive renders are stable — helps
  // React keep DOM nodes between polls.
  zones.sort((a, b) => {
    if (a.state !== b.state) return a.state.localeCompare(b.state);
    return a.name.localeCompare(b.name);
  });
  return zones;
}
