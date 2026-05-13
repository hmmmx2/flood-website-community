/**
 * Server-side per-node anonymiser.
 *
 * Takes the raw list of sensor rows from the Java service and emits
 * one map circle per node — *no grouping*. Each output entry strips
 * the identifying fields the browser doesn't need (uuid, node_id,
 * name) and lightly fuzzes the coordinate so an attacker reading the
 * wire can't pinpoint hardware to within centimetres.
 *
 * Privacy contract enforced here:
 *   1. Lat/lng on the wire are rounded to 4 decimal places (~11 m).
 *      Anyone with DevTools sees the circle's bucket, not the device's
 *      GPS reading.
 *   2. The original UUID and `node_id` never reach the browser. The
 *      output `id` is a stable FNV-1a hash, used only as a React key.
 *   3. The original `name` field never reaches the browser.
 *   4. Rows with invalid or origin coordinates (lat≈0 and lng≈0 —
 *      seed/test rows like `SUTS_River1`) are dropped.
 *
 * Why not group by (state, area) any more? Because the DB doesn't
 * always populate those columns — when they're NULL every node
 * collapsed into a single "Unknown|Unknown" zone with the wrong
 * centroid, and the map looked empty. The user explicitly asked for
 * "one circle per node, no grouping". That's this function now.
 *
 * The function is pure so it's unit-testable; the BFF route in
 * `app/api/zones/route.ts` is the only caller in production.
 */

import type { FloodLevel, Zone } from "@/lib/types";

/**
 * Subset of the Java SensorNodeDto shape that this anonymiser needs.
 * Kept loose so a future column on the Java row doesn't break us.
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
  /** Some Java responses use a boolean column instead of the status enum. */
  isDead?: boolean;
  lastUpdated?: string;
};

/** Fixed per-node circle radius. Small enough that adjacent nodes can
 *  still be distinguished, large enough to be tappable at zoom 11+. */
const NODE_RADIUS_M = 250;

/** Rounded to 4 d.p. (~11 m on the equator). Gives modest fuzz on the
 *  wire while still landing the circle in the right neighbourhood. */
function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

/**
 * Stable id derived from whatever the row gives us. Prefers the
 * server-generated UUID so the id is stable across reloads, falls
 * back to `nodeId`, then to the rounded coordinate as a last resort.
 * The returned value is always the FNV-1a hash — never the original
 * identifier — so the browser can use it as a React key without ever
 * seeing the underlying node identity.
 */
function stableNodeKey(r: RawSensorRow): string {
  const seed =
    r.id ?? r.nodeId ?? `${round4(r.latitude)},${round4(r.longitude)}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return "n_" + (h >>> 0).toString(36);
}

/**
 * Map a row to its on-wire offline flag. Java's `SensorNodeDto.status`
 * uses an enum string; the new `nodes` table has an `is_dead` boolean.
 * Either source flips the same flag downstream.
 */
function isOffline(r: RawSensorRow): boolean {
  if (r.isDead === true) return true;
  if (r.status === "inactive") return true;
  return false;
}

/**
 * Map raw rows to anonymised per-node `Zone`s. Pure function — no I/O,
 * no side effects, no globals.
 *
 * The function is still called `aggregateZones` to keep its call sites
 * unchanged (the BFF route, future tests), but semantically it now
 * emits ONE Zone per input row (the "Zone" type doubles as a
 * single-node map circle).
 */
export function aggregateZones(rows: RawSensorRow[]): Zone[] {
  const out: Zone[] = [];
  for (const r of rows) {
    // Drop rows we can't render or that look like seed/test data.
    if (!Number.isFinite(r.latitude) || !Number.isFinite(r.longitude)) continue;
    if (Math.abs(r.latitude) < 0.001 && Math.abs(r.longitude) < 0.001) continue;

    const state = (r.state ?? "Unknown").trim() || "Unknown";
    const area = (r.area ?? r.location ?? "Unknown").trim() || "Unknown";
    const offline = isOffline(r);
    const level = (r.currentLevel ?? 0) as FloodLevel;

    out.push({
      id: stableNodeKey(r),
      // The original `nodeId` IS forwarded server-side so the bell-menu
      // in the "Nearby flood points" panel can subscribe / unsubscribe
      // this node via the existing /api/favourites endpoint. The UI
      // never renders this value as text — it's only ever passed to
      // the favourites API as an opaque subscription key. The previous
      // privacy promise stands: a casual visitor never reads it.
      nodeId: r.nodeId,
      // We still surface area/state because filters and the place card
      // use them for a coarse "where is this?" label. We do NOT surface
      // the node's own `name` field — that often encodes the original
      // node_id (e.g. "Node NODE_12345") which we treat as sensitive.
      name: area,
      state,
      area,
      centroidLat: round4(r.latitude),
      centroidLng: round4(r.longitude),
      radiusM: NODE_RADIUS_M,
      worstLevel: level,
      // Per-node — there's no "any vs all", both reflect this one node.
      anyOffline: offline,
      allOffline: offline,
      // Cluster-size band is meaningless for a single node, but keep
      // the field so downstream code that reads it still type-checks.
      sensorBand: "single",
      lastUpdated: r.lastUpdated,
    });
  }

  // Stable sort by id so consecutive polls render in the same order
  // (React reuses DOM nodes; Google Maps reuses Circle overlays).
  out.sort((a, b) => a.id.localeCompare(b.id));
  return out;
}
