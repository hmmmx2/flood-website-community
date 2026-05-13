"use client";

/**
 * <NodeMap /> — Flood Map (public, privacy-first).
 *
 * Renders an aggregated **zone** layer over Google Maps. The browser
 * never sees per-sensor coordinates — the `zones` prop arrives from
 * `/api/zones`, which is the BFF privacy aggregator in
 * `lib/zoneAggregate.ts`. Each zone is a translucent coloured circle
 * at the rounded zone centroid, sized to a privacy-padded radius.
 *
 * The map also supports:
 *   • Right-click            → onMapRightClick(lat, lng)  (drop a saved-place pin)
 *   • Places Autocomplete    → onPlaceSelect(lat, lng, name)
 *   • Saved-place house pins + alert-radius circles
 *   • Map-type switcher       (Default / Satellite / Hybrid / Terrain)
 *   • Traffic layer toggle    (Google traffic overlay)
 *   • My-Location recenter    (re-runs getCurrentPosition)
 *   • Compass / north reset   (visible only when the map is rotated)
 *   • Fullscreen / Esc to exit
 *
 * The previous version of this component (NodeMap that drew one circle
 * per sensor at its real lat/lng) leaked exact node coordinates to the
 * browser. That behaviour is intentionally gone.
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Autocomplete,
  Circle,
  GoogleMap,
  HeatmapLayer,
  Marker,
  Polyline,
  TrafficLayer,
  useJsApiLoader,
  type Libraries,
} from "@react-google-maps/api";

import type { ScoredRoute } from "@/lib/useFloodAwareRoute";

import type { FloodLevel, Zone } from "@/lib/types";

// ── Types ─────────────────────────────────────────────────────────────────────
export type { FloodLevel, Zone } from "@/lib/types";

export type MapSavedLocation = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  alertRadiusKm: number;
  /** Worst flood level across zones inside this place's radius. */
  worstLevel?: FloodLevel;
  /** True when every in-radius zone is offline. */
  allOffline?: boolean;
};

function placeStatusHex(loc: MapSavedLocation): string {
  if (loc.allOffline) return "#6b7280";
  switch (loc.worstLevel) {
    case 3: return "#dc2626";
    case 2: return "#f97316";
    case 1: return "#facc15";
    default: return "#2563eb"; // clear → the saved-place blue
  }
}

/**
 * SVG data-URL for the saved-place marker — a coloured halo behind a
 * blue house. The halo colour reflects the worst flood status of
 * zones inside the place's radius (S6-2). `inRadiusHasFlood` thickens
 * the ring stroke so risky places jump out more.
 */
function placePinSvgUrl(statusColor: string, inRadiusHasFlood: boolean): string {
  const ringStroke = inRadiusHasFlood ? 4 : 3;
  const ringOpacity = inRadiusHasFlood ? 0.95 : 0.7;
  const haloOpacity = inRadiusHasFlood ? 0.22 : 0.16;
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='44' height='48' viewBox='0 0 44 48'>` +
      `<circle cx='22' cy='22' r='20' fill='${statusColor}' fill-opacity='${haloOpacity}'/>` +
      `<circle cx='22' cy='22' r='17.5' fill='none' stroke='${statusColor}' stroke-width='${ringStroke}' stroke-opacity='${ringOpacity}'/>` +
      `<path d='M11 24 L22 13 L33 24 L33 35 L25 35 L25 27 L19 27 L19 35 L11 35 Z' fill='#2563eb' stroke='white' stroke-width='2'/>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Renders a small text label as a Google Maps Marker SVG. Used by S6-3
 * to label each saved-place radius with "Home · 5 km alert" at zoom
 * 12+. Pure: no Google APIs at module init.
 */
function placeLabelSvgUrl(text: string): string {
  const safe = text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const w = Math.min(220, 28 + safe.length * 7);
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='22' viewBox='0 0 ${w} 22'>` +
      `<rect x='0' y='1' width='${w}' height='20' rx='10' fill='white' stroke='#d4d4d8' stroke-width='1'/>` +
      `<text x='${w / 2}' y='15' text-anchor='middle' font-family='-apple-system, system-ui, sans-serif' ` +
      `font-size='11' font-weight='600' fill='#0f172a'>${safe}</text>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

type MapTypeKey = "roadmap" | "satellite" | "hybrid" | "terrain";

// ── Constants ─────────────────────────────────────────────────────────────────
export const STATUS_HEX: Record<FloodLevel, string> = {
  0: "#16a34a", // Dry      — emerald
  1: "#facc15", // Normal   — amber
  2: "#f97316", // Warning  — orange
  3: "#dc2626", // Critical — red
};
const OFFLINE_HEX = "#6b7280";

function getZoneColour(z: Zone): string {
  if (z.allOffline) return OFFLINE_HEX;
  return STATUS_HEX[z.worstLevel] ?? STATUS_HEX[0];
}

/**
 * Google Maps libraries loaded eagerly at map mount.
 *
 *  - `places`        — Autocomplete + place details (already used).
 *  - `geometry`      — needed by flood-aware Directions (P1-6) and
 *                      distance measurement (P1-9).
 *  - `marker`        — advanced markers, used by clustering later.
 *  - `visualization` — HeatmapLayer for the heatmap toggle (P2-3).
 *
 * `drawing` stays deferred — it's only behind annotation tools that
 * we haven't built yet.
 */
const MAPS_LIBRARIES: Libraries = ["places", "geometry", "marker", "visualization"];

const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "";
const hasValidApiKey = apiKey.length > 10 && !apiKey.includes("Example");

const mapStyles: google.maps.MapTypeStyle[] = [
  { featureType: "poi",  stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "labels",   stylers: [{ visibility: "simplified" }] },
];

const MAP_TYPE_STORAGE_KEY = "floodmap.mapType";
const TRAFFIC_STORAGE_KEY = "floodmap.traffic";
const TRAFFIC_EXPLICIT_KEY = "floodmap.trafficExplicit";
const HEATMAP_STORAGE_KEY = "floodmap.heatmap";
const HIGH_CONTRAST_STORAGE_KEY = "floodmap.hiContrast";
const RECENT_SEARCHES_KEY = "floodmap.recentSearches";
const RECENT_SEARCHES_LIMIT = 8;

type RecentSearch = {
  name: string;
  lat: number;
  lng: number;
  at: number;
};

const MAP_TYPE_OPTIONS: { key: MapTypeKey; label: string; sub?: string }[] = [
  { key: "roadmap",   label: "Default",   sub: "Streets" },
  { key: "satellite", label: "Satellite", sub: "Aerial imagery" },
  { key: "hybrid",    label: "Hybrid",    sub: "Satellite + labels" },
  { key: "terrain",   label: "Terrain",   sub: "Elevation + rivers" },
];

// ── Props ─────────────────────────────────────────────────────────────────────
type NodeMapProps = {
  zones: Zone[];
  savedLocations?: MapSavedLocation[];
  height?: number;
  defaultZoom?: number;
  defaultCenter?: { lat: number; lng: number };
  /** Pan + zoom the map to this point. */
  focusLatLng?: { lat: number; lng: number; zoom?: number } | null;
  /** Right-click → user picks a coord (used for "save this place"). */
  onMapRightClick?: (lat: number, lng: number) => void;
  /** Place search handler — fired when user picks an Autocomplete suggestion. */
  onPlaceSelect?: (lat: number, lng: number, name: string) => void;
  /** Live "you are here" marker — set once geolocation resolves on the page. */
  myLocation?: { lat: number; lng: number; accuracyM?: number } | null;
  /** Fires when the user taps the "Recenter on me" floating button. */
  onRecenterRequest?: () => void;
  /**
   * Fires on every idle (pan + zoom settle) with the current map
   * viewport. Used by the page-level "viewport rollup pill" (P1-12).
   * `center` is what we'd write back into a shareable URL.
   */
  onViewportChanged?: (vp: {
    centerLat: number;
    centerLng: number;
    zoom: number;
    bounds: { north: number; south: number; east: number; west: number };
  }) => void;
  /**
   * If set, the page-level Share button is rendered next to the
   * fullscreen control. The handler is called with the current
   * center + zoom; the page composes the URL and copies / shares.
   */
  onShareView?: (vp: { centerLat: number; centerLng: number; zoom: number }) => void;
  /**
   * Fires when the user clicks a flood zone circle. The page opens
   * its Place Card with the zone variant. Zone circles only become
   * clickable when this handler is provided.
   */
  onZoneClick?: (zone: Zone) => void;
  /**
   * True on the very first `/api/zones` fetch — the map renders
   * skeleton greyed-out circles at default city centres so the user
   * sees "this surface shows flood zones as circles" before any data
   * arrives (S6-7). Set back to false once the first poll resolves.
   */
  isFirstLoad?: boolean;
  /**
   * Fires when the user taps the Directions floating button. The page
   * is responsible for opening the panel; the map just provides the
   * affordance. Hidden when no handler is provided.
   */
  onOpenDirections?: () => void;
  /**
   * Routes rendered as polylines on the map. The selected one gets a
   * bold stroke; the others are dimmed so the comparison is visible.
   */
  routes?: ScoredRoute<google.maps.DirectionsRoute>[] | null;
  selectedRouteIndex?: number;
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function NodeMap({
  zones,
  savedLocations,
  height = 480,
  defaultZoom = 11,
  defaultCenter,
  focusLatLng = null,
  onMapRightClick,
  onPlaceSelect,
  myLocation = null,
  onRecenterRequest,
  onViewportChanged,
  onShareView,
  onZoneClick,
  onOpenDirections,
  routes = null,
  selectedRouteIndex = 0,
  isFirstLoad = false,
}: NodeMapProps) {
  const [mapError, setMapError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchedPlace, setSearchedPlace] = useState<
    { lat: number; lng: number; name: string } | null
  >(null);
  const focusLatLngRef = useRef(focusLatLng);
  useEffect(() => { focusLatLngRef.current = focusLatLng; }, [focusLatLng]);

  // ── Map type + traffic (P1-1, P1-2) ───────────────────────────────────────
  // Persisted across reloads so a user's preference for satellite during
  // a flood watch survives a page refresh.
  const [mapType, setMapType] = useState<MapTypeKey>("roadmap");
  const [trafficOn, setTrafficOn] = useState(false);
  // `trafficExplicit` is set the moment the user touches the toggle in
  // either direction. Until then, P1-2 may auto-on the layer whenever
  // a Warning+ zone enters the viewport.
  const [trafficExplicit, setTrafficExplicit] = useState(false);
  const [heatmapOn, setHeatmapOn] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  useEffect(() => {
    try {
      const t = window.localStorage.getItem(MAP_TYPE_STORAGE_KEY);
      if (t === "roadmap" || t === "satellite" || t === "hybrid" || t === "terrain") {
        setMapType(t);
      }
      const tr = window.localStorage.getItem(TRAFFIC_STORAGE_KEY);
      if (tr === "1") setTrafficOn(true);
      if (window.localStorage.getItem(TRAFFIC_EXPLICIT_KEY) === "1") setTrafficExplicit(true);
      if (window.localStorage.getItem(HEATMAP_STORAGE_KEY) === "1") setHeatmapOn(true);
      if (window.localStorage.getItem(HIGH_CONTRAST_STORAGE_KEY) === "1") setHighContrast(true);
    } catch { /* no localStorage in some contexts — silent skip */ }
  }, []);
  function persistMapType(t: MapTypeKey) {
    setMapType(t);
    try { window.localStorage.setItem(MAP_TYPE_STORAGE_KEY, t); } catch { /* noop */ }
  }
  function persistTraffic(on: boolean) {
    setTrafficOn(on);
    setTrafficExplicit(true);
    try {
      window.localStorage.setItem(TRAFFIC_STORAGE_KEY, on ? "1" : "0");
      window.localStorage.setItem(TRAFFIC_EXPLICIT_KEY, "1");
    } catch { /* noop */ }
  }
  function persistHeatmap(on: boolean) {
    setHeatmapOn(on);
    try { window.localStorage.setItem(HEATMAP_STORAGE_KEY, on ? "1" : "0"); } catch { /* noop */ }
  }
  function persistHighContrast(on: boolean) {
    setHighContrast(on);
    try { window.localStorage.setItem(HIGH_CONTRAST_STORAGE_KEY, on ? "1" : "0"); } catch { /* noop */ }
  }

  // P1-2 — auto-on traffic the first time a Warning+ zone is in the
  // current frame, but never override a user who's already explicitly
  // toggled it.
  useEffect(() => {
    if (trafficExplicit || trafficOn) return;
    const anyRisky = zones.some(z => !z.allOffline && z.worstLevel >= 2);
    if (anyRisky) setTrafficOn(true);
  }, [zones, trafficExplicit, trafficOn]);

  // ── Recent searches (P1-7) ────────────────────────────────────────────────
  // Stored in localStorage, surfaced as a dropdown under the search
  // input when it's focused but empty. Picking one fires the same
  // onPlaceSelect callback the live Autocomplete does.
  const [recents, setRecents] = useState<RecentSearch[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setRecents(
          parsed
            .filter((r): r is RecentSearch =>
              typeof r === "object" && r !== null &&
              typeof (r as RecentSearch).name === "string" &&
              typeof (r as RecentSearch).lat === "number" &&
              typeof (r as RecentSearch).lng === "number",
            )
            .slice(0, RECENT_SEARCHES_LIMIT),
        );
      }
    } catch { /* noop */ }
  }, []);
  function recordRecent(name: string, lat: number, lng: number) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setRecents(prev => {
      const next: RecentSearch[] = [
        { name: trimmed, lat, lng, at: Date.now() },
        ...prev.filter(r => r.name.toLowerCase() !== trimmed.toLowerCase()),
      ].slice(0, RECENT_SEARCHES_LIMIT);
      try { window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
  }
  function clearRecents() {
    setRecents([]);
    try { window.localStorage.removeItem(RECENT_SEARCHES_KEY); } catch { /* noop */ }
  }


  // ── Heading (P1-4 compass) ────────────────────────────────────────────────
  // Tracks the map's current heading so the compass button can hide
  // when we're already north-up. We listen to `heading_changed` which
  // fires for any setHeading() call as well as the (rare) user gesture.
  const [heading, setHeading] = useState(0);

  // ── Measure distance tool (P1-9) ──────────────────────────────────────────
  // Pure-client overlay. While `measuring` is true, map clicks add
  // vertices; Esc ends the measurement; right-click clears the
  // current vertices. We deliberately suppress the page-level
  // right-click handler for "save place" during measure mode so a
  // user can wipe the polyline cleanly without saving anything.
  const [measuring, setMeasuring] = useState(false);
  const [measurePts, setMeasurePts] = useState<google.maps.LatLngLiteral[]>([]);
  const measureTotalM = useMemo(() => {
    if (typeof google === "undefined" || !google.maps?.geometry?.spherical) return 0;
    if (measurePts.length < 2) return 0;
    return google.maps.geometry.spherical.computeLength(
      measurePts.map(p => new google.maps.LatLng(p.lat, p.lng)),
    );
  }, [measurePts]);
  useEffect(() => {
    if (!measuring) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMeasuring(false);
        setMeasurePts([]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [measuring]);

  // ── Street View pegman (P2-1) ─────────────────────────────────────────────
  // We re-enable Google's built-in StreetView control in a corner that
  // doesn't fight our floating cluster. `disableDefaultUI` hides the
  // pegman by default, so we opt back in explicitly.

  // Lock body scroll while the map is fullscreen so the page underneath
  // doesn't scroll behind the overlay.
  useEffect(() => {
    if (!isFullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [isFullscreen]);

  // Allow ESC to exit fullscreen.
  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setIsFullscreen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isFullscreen]);

  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: apiKey,
    libraries: MAPS_LIBRARIES,
  });

  useEffect(() => { if (loadError) setMapError(true); }, [loadError]);

  const mapCenter = useMemo(() => {
    if (defaultCenter) return defaultCenter;
    if (zones.length === 0) return { lat: 5.9788, lng: 116.0753 };
    const lat = zones.reduce((s, z) => s + z.centroidLat, 0) / zones.length;
    const lng = zones.reduce((s, z) => s + z.centroidLng, 0) / zones.length;
    return { lat, lng };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount-only

  useEffect(() => {
    if (!focusLatLng || !mapRef.current) return;
    mapRef.current.panTo({ lat: focusLatLng.lat, lng: focusLatLng.lng });
    if (focusLatLng.zoom != null) mapRef.current.setZoom(focusLatLng.zoom);
  }, [focusLatLng]);

  const onViewportChangedRef = useRef(onViewportChanged);
  useEffect(() => { onViewportChangedRef.current = onViewportChanged; }, [onViewportChanged]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    setMapError(false);
    // Wire the compass — Google Maps' heading_changed event is the
    // most reliable way to know if the map is non-north-up after a
    // gesture or an SDK call.
    map.addListener("heading_changed", () => {
      setHeading(map.getHeading() ?? 0);
    });
    map.addListener("zoom_changed", () => {
      setCurrentZoom(map.getZoom() ?? defaultZoom);
    });
    setCurrentZoom(map.getZoom() ?? defaultZoom);
    // Track Street View visibility — when the user drags the pegman
    // onto a road, the panorama covers the whole map layer. The
    // rescue pill below offers "Exit Street View" so they don't have
    // to hunt for the ✕ button on the panorama itself.
    const pano = map.getStreetView();
    if (pano) {
      setStreetViewActive(pano.getVisible());
      pano.addListener("visible_changed", () => {
        setStreetViewActive(pano.getVisible());
      });
    }
    // `idle` fires once after pan + zoom settle. We forward the
    // viewport up so the page can render the rollup pill (P1-12)
    // and so Share-view can capture the user's current frame.
    map.addListener("idle", () => {
      const c = map.getCenter();
      const b = map.getBounds();
      if (!c || !b) return;
      const ne = b.getNorthEast();
      const sw = b.getSouthWest();
      const nextBounds = {
        north: ne.lat(),
        south: sw.lat(),
        east: ne.lng(),
        west: sw.lng(),
      };
      // Keep a local copy for the out-of-viewport pill (S6-4).
      setLocalViewport(nextBounds);
      onViewportChangedRef.current?.({
        centerLat: c.lat(),
        centerLng: c.lng(),
        zoom: map.getZoom() ?? 11,
        bounds: nextBounds,
      });
    });
    const pending = focusLatLngRef.current;
    if (pending) {
      map.panTo({ lat: pending.lat, lng: pending.lng });
      if (pending.zoom != null) map.setZoom(pending.zoom);
    }
  }, []);

  /**
   * Captures the current viewport for the Share button. Reads from
   * the live map ref so we always share what the user sees, not
   * whatever was last passed in via `focusLatLng`.
   */
  function shareView() {
    const map = mapRef.current;
    if (!map || !onShareView) return;
    const c = map.getCenter();
    if (!c) return;
    onShareView({
      centerLat: c.lat(),
      centerLng: c.lng(),
      zoom: map.getZoom() ?? 11,
    });
  }

  const handleRightClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (measuring) {
      // In measure mode, right-click wipes the current polyline.
      setMeasurePts([]);
      return;
    }
    if (!onMapRightClick || !e.latLng) return;
    onMapRightClick(e.latLng.lat(), e.latLng.lng());
  }, [measuring, onMapRightClick]);

  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (!measuring || !e.latLng) return;
    setMeasurePts(prev => [...prev, { lat: e.latLng!.lat(), lng: e.latLng!.lng() }]);
  }, [measuring]);

  const handlePlaceChanged = useCallback(() => {
    const ac = autocompleteRef.current;
    if (!ac) return;
    const place = ac.getPlace();
    if (!place.geometry?.location) return;
    const lat = place.geometry.location.lat();
    const lng = place.geometry.location.lng();
    const name = place.name ?? place.formatted_address ?? "";
    if (mapRef.current) {
      mapRef.current.panTo({ lat, lng });
      mapRef.current.setZoom(14);
    }
    setSearchInput(name);
    setSearchedPlace({ lat, lng, name });
    recordRecent(name, lat, lng);
    onPlaceSelect?.(lat, lng, name);
  }, [onPlaceSelect]);

  // Per-place icon built on the fly so the colour can follow the
  // worst flood status inside the radius. We memoise the actual google
  // Size + Point objects so they aren't churned every render.
  const placeIconSize = useMemo(() => {
    if (typeof google === "undefined" || !isLoaded) return null;
    return {
      size: new google.maps.Size(44, 48),
      anchor: new google.maps.Point(22, 24),
      labelSize: new google.maps.Size(160, 22),
      labelAnchor: new google.maps.Point(80, 30),
    };
  }, [isLoaded]);

  // Track zoom so we can hide the "Home · 5 km" label at regional
  // zooms where it would clutter the map. (We listen to zoom_changed
  // in onMapLoad; this state is the latest known zoom.)
  const [currentZoom, setCurrentZoom] = useState(defaultZoom);

  // ── Rescue pill — "show me the data" (S6-4, generalised) ─────────────────
  //
  // Tracks the current map bounds so we can detect three states:
  //   1. Risky zones exist but none are in view  → red/orange alarm pill.
  //   2. Some zones exist but none are in view   → neutral "Show all" pill.
  //   3. Street View is active and zones exist   → "Exit Street View" pill.
  //
  // This is the user's escape hatch when the page seems empty even
  // though the legend shows zone counts. The pill self-dismisses on
  // tap (60 s grace window via dismissedAt) so a user who pans
  // intentionally to an empty area isn't nagged.
  const [localViewport, setLocalViewport] = useState<{
    north: number; south: number; east: number; west: number;
  } | null>(null);
  const [outOfViewportDismissedAt, setOutOfViewportDismissedAt] = useState<number>(0);
  const [streetViewActive, setStreetViewActive] = useState(false);

  const rescuePill = useMemo<
    | { tone: "critical" | "warning" | "neutral"; label: string }
    | { tone: "streetview"; label: string }
    | null
  >(() => {
    if (zones.length === 0) return null;
    if (streetViewActive) {
      return { tone: "streetview", label: "Exit Street View and show flood zones" };
    }
    if (!localViewport) return null;
    if (Date.now() - outOfViewportDismissedAt < 60_000) return null;
    const insideCount = zones.filter(z =>
      z.centroidLat <= localViewport.north &&
      z.centroidLat >= localViewport.south &&
      z.centroidLng <= localViewport.east &&
      z.centroidLng >= localViewport.west,
    ).length;
    if (insideCount > 0) return null;
    const critical = zones.filter(z => !z.allOffline && z.worstLevel === 3).length;
    const warning = zones.filter(z => !z.allOffline && z.worstLevel === 2).length;
    if (critical > 0) {
      return {
        tone: "critical",
        label: `${critical} Critical zone${critical === 1 ? "" : "s"} outside this view`,
      };
    }
    if (warning > 0) {
      return {
        tone: "warning",
        label: `${warning} Warning zone${warning === 1 ? "" : "s"} outside this view`,
      };
    }
    return {
      tone: "neutral",
      label: `Show all ${zones.length} flood zone${zones.length === 1 ? "" : "s"}`,
    };
  }, [zones, localViewport, outOfViewportDismissedAt, streetViewActive]);

  /**
   * Pan + zoom the map so every zone in the dataset fits in frame.
   * Also exits Street View if it's active — Street View is a common
   * way users get stuck looking at imagery instead of the map layer.
   * Restricts to Warning+ zones when the rescue pill is alarming so
   * the user lands on the actual trouble spots, not a wide regional
   * view that buries them.
   */
  function fitToZones(opts: { onlyRisky?: boolean } = {}) {
    if (typeof google === "undefined" || !mapRef.current) return;
    // Always exit Street View first — it covers the map layer entirely
    // when active, so even a perfect fitBounds wouldn't be visible.
    const pano = mapRef.current.getStreetView();
    if (pano && pano.getVisible()) pano.setVisible(false);
    const list = opts.onlyRisky
      ? zones.filter(z => !z.allOffline && z.worstLevel >= 2)
      : zones;
    if (list.length === 0) return;
    const b = new google.maps.LatLngBounds();
    for (const z of list) {
      b.extend(new google.maps.LatLng(z.centroidLat, z.centroidLng));
    }
    mapRef.current.fitBounds(b, 80 /* px padding */);
  }

  const searchedPlaceIcon: google.maps.Symbol | undefined = useMemo(() => {
    if (typeof google === "undefined" || !isLoaded) return undefined;
    return {
      path: "M12 2C7.58 2 4 5.58 4 10c0 5.25 7 12 8 12s8-6.75 8-12c0-4.42-3.58-8-8-8zm0 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6z",
      fillColor: "#dc2626",
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: 2,
      scale: 2,
      anchor: new google.maps.Point(12, 22),
    };
  }, [isLoaded]);

  // ── Compass reset (P1-4) ──────────────────────────────────────────────────
  function resetHeading() {
    if (!mapRef.current) return;
    mapRef.current.setHeading(0);
    setHeading(0);
  }

  // ── My location (P1-3) ────────────────────────────────────────────────────
  // The page already owns the geolocation `pos` state. The button
  // either re-pans the map to the most-recent fix (cheap, no
  // permission re-prompt) or bubbles to the parent which can re-run
  // getCurrentPosition (heavier, may prompt).
  function recenterOnMe() {
    if (myLocation && mapRef.current) {
      mapRef.current.panTo({ lat: myLocation.lat, lng: myLocation.lng });
      mapRef.current.setZoom(Math.max(mapRef.current.getZoom() ?? 13, 15));
    }
    onRecenterRequest?.();
  }

  // ── Fallback when no API key ───────────────────────────────────────────────
  if (!hasValidApiKey || mapError || loadError) {
    return (
      <div
        className="relative flex w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-bg)] to-[var(--color-hover)]"
        style={{ height }}
        role="img"
        aria-label="Map preview unavailable — Google Maps API key not configured"
      >
        <p className="text-sm font-semibold text-[var(--color-text)]">Map Preview</p>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          {zones.length} zone{zones.length === 1 ? "" : "s"} loaded
        </p>
        <p className="absolute bottom-3 text-[10px] text-[var(--color-muted)]">
          Configure NEXT_PUBLIC_GOOGLE_MAPS_KEY for live map
        </p>
      </div>
    );
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (!isLoaded) {
    return (
      <div
        className="flex w-full items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-input-bg)]"
        style={{ height }}
        role="status"
        aria-live="polite"
        aria-label="Loading map"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-brand)]" />
          <p className="text-sm font-medium text-[var(--color-muted)]">Loading map…</p>
        </div>
      </div>
    );
  }

  // ── Map ────────────────────────────────────────────────────────────────────
  return (
    <div
      className={isFullscreen
        ? "fixed inset-0 z-[60] bg-black/90 p-3 sm:p-6"
        : "relative"}
      style={isFullscreen ? undefined : { height }}
    >
      <GoogleMap
        mapContainerStyle={{
          width: "100%",
          height: "100%",
          borderRadius: isFullscreen ? "12px" : "16px",
        }}
        center={mapCenter}
        zoom={defaultZoom}
        mapTypeId={mapType}
        options={{
          disableDefaultUI: true,
          zoomControl: true,
          // Vector styles only apply to roadmap; on satellite/hybrid
          // we let Google's default rendering through.
          styles: mapType === "roadmap" ? mapStyles : undefined,
          gestureHandling: "greedy",
          // Street View pegman — opt back in explicitly since
          // disableDefaultUI hides everything by default.
          streetViewControl: true,
          streetViewControlOptions: typeof google !== "undefined"
            ? { position: google.maps.ControlPosition.RIGHT_BOTTOM }
            : undefined,
          mapTypeControl: false,
          rotateControl: false,
          // While measuring, switch the cursor so the user knows
          // clicks are adding vertices.
          draggableCursor: measuring ? "crosshair" : undefined,
        }}
        onLoad={onMapLoad}
        onClick={handleMapClick}
        onRightClick={handleRightClick}
      >
        {trafficOn && <TrafficLayer />}

        {/* First-load skeleton (S6-7) — grey placeholder circles at
            major city centres so the user immediately understands
            the surface visualises flood zones as circles, before any
            data has arrived. Hidden the moment a real zone payload
            lands. */}
        {isFirstLoad && zones.length === 0 && [
          { lat: 5.9788, lng: 116.0753, r: 8000 }, // Kota Kinabalu
          { lat: 1.5533, lng: 110.3592, r: 8000 }, // Kuching
          { lat: 4.3989, lng: 114.0030, r: 6000 }, // Miri
          { lat: 5.8403, lng: 118.1179, r: 6000 }, // Sandakan
          { lat: 2.2900, lng: 111.8290, r: 6000 }, // Sibu
        ].map((c, i) => (
          <Circle
            key={`skel-${i}`}
            center={{ lat: c.lat, lng: c.lng }}
            radius={c.r}
            options={{
              fillColor: "#94a3b8",
              fillOpacity: 0.18,
              strokeColor: "#94a3b8",
              strokeOpacity: 0.35,
              strokeWeight: 1,
              clickable: false,
              zIndex: 1,
            }}
          />
        ))}

        {/* Heatmap (P2-3) — points are zone centroids weighted by
            worst level so Critical clusters glow brighter than Alert.
            Renders below the circles so the per-zone affordances stay
            tappable. */}
        {heatmapOn && typeof google !== "undefined" && google.maps?.visualization && (
          <HeatmapLayer
            data={zones
              .filter(z => !z.allOffline)
              .map(z => ({
                location: new google.maps.LatLng(z.centroidLat, z.centroidLng),
                weight: z.worstLevel + 1,
              }))}
            options={{
              radius: 60,
              opacity: 0.55,
              dissipating: true,
            }}
          />
        )}

        {/* Per-zone circles — one per aggregated zone, coloured by worst
            level. Clickable when the page provides `onZoneClick`.
            High-contrast mode darkens the fill + thickens the stroke
            so the categories are still distinguishable for users with
            colour-vision differences. Zones whose `lastUpdated` is
            older than 5 min render at a lower opacity (S6-8). */}
        {zones.map(z => {
          const colour = getZoneColour(z);
          const stale =
            z.lastUpdated
              ? Date.now() - new Date(z.lastUpdated).getTime() > 5 * 60_000
              : false;
          const fillOp = highContrast ? 0.55 : 0.35;
          const strokeOp = highContrast ? 1 : 0.85;
          return (
            <Circle
              key={`zone-${z.id}`}
              center={{ lat: z.centroidLat, lng: z.centroidLng }}
              radius={z.radiusM}
              onClick={onZoneClick ? () => onZoneClick(z) : undefined}
              options={{
                fillColor: colour,
                fillOpacity: stale ? fillOp * 0.5 : fillOp,
                strokeColor: highContrast ? "#0f172a" : colour,
                strokeOpacity: stale ? strokeOp * 0.6 : strokeOp,
                strokeWeight: highContrast ? 3 : 2,
                clickable: Boolean(onZoneClick),
                zIndex: 2,
              }}
            />
          );
        })}

        {/* Direction-service routes (P1-6). The selected one is bold
            and on top; the alternatives sit underneath dimmed so the
            user can compare. */}
        {routes && routes.map((s, i) => {
          const path = s.route.overview_path ?? [];
          if (path.length < 2) return null;
          const isSelected = i === selectedRouteIndex;
          const stroke =
            s.impact === "critical" ? "#dc2626" :
            s.impact === "warning"  ? "#f97316" :
            "#1d4ed8";
          return (
            <Polyline
              key={`route-${i}`}
              path={path.map(ll => ({ lat: ll.lat(), lng: ll.lng() }))}
              options={{
                strokeColor: stroke,
                strokeOpacity: isSelected ? 0.95 : 0.4,
                strokeWeight: isSelected ? 6 : 4,
                clickable: false,
                zIndex: isSelected ? 50 : 30,
              }}
            />
          );
        })}

        {/* Measure-distance polyline + vertex dots (P1-9). */}
        {measuring && measurePts.length >= 2 && (
          <Polyline
            path={measurePts}
            options={{
              strokeColor: "#0f172a",
              strokeOpacity: 0.95,
              strokeWeight: 4,
              clickable: false,
              zIndex: 60,
            }}
          />
        )}
        {measuring && measurePts.map((p, i) => (
          <Circle
            key={`measure-${i}`}
            center={p}
            radius={20}
            options={{
              fillColor: "#0f172a",
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeOpacity: 1,
              strokeWeight: 2,
              clickable: false,
              zIndex: 61,
            }}
          />
        ))}

        {/* "You are here" — accuracy ring + crisp blue dot. */}
        {myLocation && (
          <>
            {myLocation.accuracyM != null && myLocation.accuracyM > 0 && (
              <Circle
                center={{ lat: myLocation.lat, lng: myLocation.lng }}
                radius={Math.min(2000, myLocation.accuracyM)}
                options={{
                  fillColor: "#1d4ed8",
                  fillOpacity: 0.10,
                  strokeColor: "#1d4ed8",
                  strokeOpacity: 0.35,
                  strokeWeight: 1,
                  clickable: false,
                  zIndex: 9,
                }}
              />
            )}
            <Circle
              center={{ lat: myLocation.lat, lng: myLocation.lng }}
              radius={40}
              options={{
                fillColor: "#1d4ed8",
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeOpacity: 1,
                strokeWeight: 3,
                clickable: false,
                zIndex: 10,
              }}
            />
          </>
        )}

        {/* Searched-place pin. */}
        {searchedPlace && (
          <Marker
            position={{ lat: searchedPlace.lat, lng: searchedPlace.lng }}
            icon={searchedPlaceIcon}
            title={searchedPlace.name}
            zIndex={20}
            onClick={() => setSearchedPlace(null)}
          />
        )}

        {/* Saved-place radius circles + house pins. Stroke colour
            follows the worst flood status inside the radius (S6-3) so
            the map answers "is my home in trouble?" at a glance. A
            text label sits at the top of the circle at zoom >= 12. */}
        {savedLocations?.map(loc => {
          const colour = placeStatusHex(loc);
          const inRadiusHasFlood =
            (loc.worstLevel ?? 0) >= 1 && !loc.allOffline;
          // Tiny offset upward so the label doesn't sit on the centre
          // pin — places it on the northern edge of the radius circle.
          const labelOffsetDeg = (loc.alertRadiusKm / 111) * 1.02;
          return (
            <React.Fragment key={`saved-${loc.id}`}>
              <Circle
                center={{ lat: loc.latitude, lng: loc.longitude }}
                radius={loc.alertRadiusKm * 1000}
                options={{
                  fillColor: colour,
                  fillOpacity: inRadiusHasFlood ? 0.12 : 0.08,
                  strokeColor: colour,
                  strokeOpacity: inRadiusHasFlood ? 0.85 : 0.6,
                  strokeWeight: inRadiusHasFlood ? 2 : 1.5,
                  clickable: false,
                  zIndex: 1,
                }}
              />
              <Marker
                position={{ lat: loc.latitude, lng: loc.longitude }}
                icon={
                  placeIconSize
                    ? {
                        url: placePinSvgUrl(colour, inRadiusHasFlood),
                        scaledSize: placeIconSize.size,
                        anchor: placeIconSize.anchor,
                      }
                    : undefined
                }
                title={`${loc.label} — alerts within ${loc.alertRadiusKm} km`}
                clickable={false}
                zIndex={5}
              />
              {currentZoom >= 12 && placeIconSize && (
                <Marker
                  position={{ lat: loc.latitude + labelOffsetDeg, lng: loc.longitude }}
                  icon={{
                    url: placeLabelSvgUrl(`${loc.label} · ${loc.alertRadiusKm} km alert`),
                    scaledSize: placeIconSize.labelSize,
                    anchor: placeIconSize.labelAnchor,
                  }}
                  clickable={false}
                  zIndex={6}
                />
              )}
            </React.Fragment>
          );
        })}
      </GoogleMap>

      {/* Rescue pill (S6-4, generalised) — bottom-left of the map.
          One pill, four states:
            - critical/warning : red/orange alarm, taps fit to risky zones
            - neutral          : grey "Show all flood zones", taps fit to all
            - streetview       : indigo "Exit Street View and show zones"
          The dismiss ✕ snoozes for 60 s for the non-Street-View cases
          (Street View needs an explicit exit, no snooze). */}
      {rescuePill && !measuring && (
        <div className={`absolute z-20 ${isFullscreen ? "bottom-8 left-6" : "bottom-3 left-3"}`}>
          <div
            className={`flex items-center gap-2 rounded-full px-3 py-2 shadow-lg ring-1 backdrop-blur-md ${
              rescuePill.tone === "critical"
                ? "bg-red-600/95 text-white ring-red-700/40"
                : rescuePill.tone === "warning"
                  ? "bg-orange-500/95 text-white ring-orange-600/40"
                  : rescuePill.tone === "streetview"
                    ? "bg-indigo-600/95 text-white ring-indigo-700/40"
                    : "bg-slate-900/90 text-white ring-slate-700/40 dark:bg-slate-100/95 dark:text-slate-900 dark:ring-slate-300/60"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
                 className="h-4 w-4">
              {rescuePill.tone === "streetview" ? (
                <>
                  <path d="M3 21l4-2 5 2 5-2 4 2V7l-4-2-5 2-5-2-4 2v14z" />
                  <path d="M7 5v14M12 7v14M17 5v14" />
                </>
              ) : rescuePill.tone === "neutral" ? (
                <>
                  <circle cx="11" cy="11" r="7" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </>
              ) : (
                <>
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </>
              )}
            </svg>
            <button
              type="button"
              onClick={() =>
                fitToZones({
                  onlyRisky:
                    rescuePill.tone === "critical" || rescuePill.tone === "warning",
                })
              }
              className="text-xs font-bold underline-offset-2 hover:underline"
            >
              {rescuePill.label}
            </button>
            {rescuePill.tone !== "streetview" && (
              <button
                type="button"
                onClick={() => setOutOfViewportDismissedAt(Date.now())}
                aria-label="Dismiss"
                className={`ml-1 rounded-full p-0.5 transition-colors ${
                  rescuePill.tone === "neutral"
                    ? "text-white/80 hover:bg-white/15 hover:text-white dark:text-slate-700 dark:hover:bg-slate-900/10 dark:hover:text-slate-900"
                    : "text-white/80 hover:bg-white/15 hover:text-white"
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
                     className="h-3.5 w-3.5">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Measure chip — bottom-center, only while measuring. */}
      {measuring && (
        <div className={`absolute left-1/2 z-20 -translate-x-1/2 ${
          isFullscreen ? "bottom-8" : "bottom-3"
        }`}>
          <div className="flex items-center gap-3 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-lg ring-1 ring-black/20">
            <span className="tabular-nums">
              {measureTotalM < 1000
                ? `${Math.round(measureTotalM)} m`
                : `${(measureTotalM / 1000).toFixed(measureTotalM < 10_000 ? 2 : 1)} km`}
            </span>
            <span className="text-[10px] text-slate-300">
              {measurePts.length < 2
                ? "Click to start"
                : `${measurePts.length} points · Esc to end · right-click to clear`}
            </span>
            <button
              type="button"
              onClick={() => { setMeasuring(false); setMeasurePts([]); }}
              className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold hover:bg-white/20"
            >
              End
            </button>
          </div>
        </div>
      )}

      {/* Floating Places search bar — top-left of the map. */}
      <div className={`pointer-events-none absolute left-3 z-10 sm:right-auto sm:max-w-sm ${
        isFullscreen ? "top-6 right-32 sm:left-6" : "top-3 right-28"
      }`}>
        <div className="pointer-events-auto rounded-full bg-white shadow-lg ring-1 ring-black/10 flex items-center pr-1">
          <Autocomplete
            onLoad={(ac) => {
              autocompleteRef.current = ac;
              // P1-7 — bias suggestions to the user's current location
              // when we have one, so "Jalan Song" near you outranks the
              // same name across the country.
              if (myLocation && typeof google !== "undefined") {
                const c = new google.maps.LatLng(myLocation.lat, myLocation.lng);
                const bounds = new google.maps.LatLngBounds(c, c);
                ac.setBounds(bounds);
              }
            }}
            onPlaceChanged={handlePlaceChanged}
            options={{
              componentRestrictions: { country: ["my"] },
              fields: ["geometry", "name", "formatted_address"],
            }}
          >
            <input
              type="text"
              value={searchInput}
              onChange={(e) => {
                const v = e.target.value;
                setSearchInput(v);
                if (v.trim() === "") setSearchedPlace(null);
              }}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => {
                // Delay so a click in the recents dropdown can fire before
                // the dropdown is unmounted by the blur.
                window.setTimeout(() => setSearchFocused(false), 150);
              }}
              placeholder="Search a place…"
              aria-label="Search for a place"
              className="w-full rounded-full bg-transparent px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
            />
          </Autocomplete>
          {/* Clear-X — visible whenever there's any text in the box. */}
          {(searchInput.length > 0 || searchedPlace) && (
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                setSearchedPlace(null);
              }}
              aria-label="Clear search"
              className="ml-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
                   className="h-3.5 w-3.5">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Recent searches dropdown (P1-7) — shown when the input is
            focused but empty. Each row is a button so a click fires
            cleanly under the blur delay. */}
        {searchFocused && searchInput.trim() === "" && recents.length > 0 && (
          <div
            className="pointer-events-auto mt-2 max-h-72 w-full overflow-y-auto rounded-2xl bg-white p-2 shadow-xl ring-1 ring-black/10"
            role="listbox"
            aria-label="Recent searches"
          >
            <div className="flex items-center justify-between px-2 pb-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Recent searches
              </p>
              <button
                type="button"
                onClick={clearRecents}
                className="text-[11px] font-semibold text-slate-500 hover:text-slate-800"
              >
                Clear
              </button>
            </div>
            {recents.map((r) => (
              <button
                key={`${r.name}-${r.at}`}
                type="button"
                role="option"
                onMouseDown={(e) => e.preventDefault() /* keep focus through click */}
                onClick={() => {
                  setSearchInput(r.name);
                  setSearchedPlace({ lat: r.lat, lng: r.lng, name: r.name });
                  if (mapRef.current) {
                    mapRef.current.panTo({ lat: r.lat, lng: r.lng });
                    mapRef.current.setZoom(14);
                  }
                  onPlaceSelect?.(r.lat, r.lng, r.name);
                  setSearchFocused(false);
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-100"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                     className="h-3.5 w-3.5 text-slate-400">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span className="truncate">{r.name}</span>
              </button>
            ))}
          </div>
        )}

        <p className="pointer-events-none mt-2 text-[11px] font-medium text-slate-700/80 sm:text-white sm:[text-shadow:0_1px_2px_rgba(0,0,0,0.4)]">
          Tip: right-click anywhere on the map to save it as a place
        </p>
      </div>

      {/* Floating controls cluster — top-right. Layered top-to-bottom:
          fullscreen, layers (map type + traffic), my-location, compass. */}
      <div className={`absolute z-20 flex flex-col gap-2 ${
        isFullscreen ? "top-6 right-6" : "top-3 right-3"
      }`}>
        {/* Fullscreen / exit */}
        <button
          type="button"
          onClick={() => setIsFullscreen(v => !v)}
          title={isFullscreen ? "Exit fullscreen (Esc)" : "Enlarge map"}
          aria-label={isFullscreen ? "Exit fullscreen" : "Enlarge map"}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-lg ring-1 ring-black/10 transition hover:bg-slate-50"
        >
          {isFullscreen ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                 stroke="#0f172a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
                 className="h-5 w-5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                 stroke="#0f172a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                 className="h-5 w-5">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
            </svg>
          )}
        </button>

        {/* Layers — map type + traffic */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setLayersOpen(o => !o)}
            title="Map layers"
            aria-label="Map layers"
            aria-haspopup="menu"
            aria-expanded={layersOpen}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-lg ring-1 ring-black/10 transition hover:bg-slate-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                 stroke="#0f172a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                 className="h-5 w-5">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </button>
          {layersOpen && (
            <>
              {/* Click-outside backdrop */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setLayersOpen(false)}
                aria-hidden
              />
              <div
                role="menu"
                className="absolute right-0 mt-2 w-56 rounded-2xl bg-white p-2 shadow-xl ring-1 ring-black/10 z-20"
              >
                <p className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Map type
                </p>
                {MAP_TYPE_OPTIONS.map(opt => (
                  <button
                    key={opt.key}
                    type="button"
                    role="menuitemradio"
                    aria-checked={mapType === opt.key}
                    onClick={() => { persistMapType(opt.key); setLayersOpen(false); }}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                      mapType === opt.key
                        ? "bg-blue-50 text-blue-700"
                        : "text-slate-800 hover:bg-slate-100"
                    }`}
                  >
                    <span className="flex flex-col">
                      <span className="font-semibold">{opt.label}</span>
                      {opt.sub && (
                        <span className="text-[11px] font-normal text-slate-500">{opt.sub}</span>
                      )}
                    </span>
                    {mapType === opt.key && (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                           stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                           className="h-4 w-4">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                ))}
                <div className="my-1 h-px bg-slate-200" />
                <p className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Overlays
                </p>
                <label className="flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-sm text-slate-800 hover:bg-slate-100">
                  <span className="flex flex-col">
                    <span className="font-semibold">Traffic</span>
                    <span className="text-[11px] font-normal text-slate-500">Live road congestion</span>
                  </span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-blue-600"
                    checked={trafficOn}
                    onChange={e => persistTraffic(e.target.checked)}
                  />
                </label>
                <label className="flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-sm text-slate-800 hover:bg-slate-100">
                  <span className="flex flex-col">
                    <span className="font-semibold">Heatmap</span>
                    <span className="text-[11px] font-normal text-slate-500">Density of flooded zones</span>
                  </span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-blue-600"
                    checked={heatmapOn}
                    onChange={e => persistHeatmap(e.target.checked)}
                  />
                </label>
                <div className="my-1 h-px bg-slate-200" />
                <p className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Accessibility
                </p>
                <label className="flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-sm text-slate-800 hover:bg-slate-100">
                  <span className="flex flex-col">
                    <span className="font-semibold">High contrast</span>
                    <span className="text-[11px] font-normal text-slate-500">Bolder zone borders, deeper fills</span>
                  </span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-blue-600"
                    checked={highContrast}
                    onChange={e => persistHighContrast(e.target.checked)}
                  />
                </label>
              </div>
            </>
          )}
        </div>

        {/* My location */}
        <button
          type="button"
          onClick={recenterOnMe}
          title="Recenter on my location"
          aria-label="Recenter on my location"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-lg ring-1 ring-black/10 transition hover:bg-slate-50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
               stroke={myLocation ? "#1d4ed8" : "#0f172a"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
               className="h-5 w-5">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
        </button>

        {/* Directions (P1-6) — opens the routing panel. */}
        {onOpenDirections && (
          <button
            type="button"
            onClick={onOpenDirections}
            title="Directions"
            aria-label="Open directions panel"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-lg ring-1 ring-black/10 transition hover:bg-slate-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                 stroke="#0f172a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                 className="h-5 w-5">
              <polygon points="3 11 22 2 13 21 11 13 3 11" />
            </svg>
          </button>
        )}

        {/* Measure distance (P1-9) — toggle. Clicking the button when
            already measuring ends the measurement. */}
        <button
          type="button"
          onClick={() => {
            setMeasuring(m => {
              if (m) setMeasurePts([]);
              return !m;
            });
          }}
          title={measuring ? "End measurement (Esc)" : "Measure distance"}
          aria-label={measuring ? "End measurement" : "Measure distance"}
          aria-pressed={measuring}
          className={`flex h-11 w-11 items-center justify-center rounded-full shadow-lg ring-1 ring-black/10 transition ${
            measuring ? "bg-slate-900 text-white" : "bg-white hover:bg-slate-50"
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
               stroke={measuring ? "#ffffff" : "#0f172a"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
               className="h-5 w-5">
            <path d="M3 8l4-4 14 14-4 4z" />
            <path d="M7 4l3 3M11 8l3 3M15 12l3 3" />
          </svg>
        </button>

        {/* Share view (P1-10) — copies a deep-linkable URL of the
            current pan + zoom. Only mounted when the page provides a
            handler so it doesn't appear on screens that don't make
            sense to share. */}
        {onShareView && (
          <button
            type="button"
            onClick={shareView}
            title="Share this view"
            aria-label="Share this view"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-lg ring-1 ring-black/10 transition hover:bg-slate-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                 stroke="#0f172a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                 className="h-5 w-5">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
          </button>
        )}

        {/* Compass — visible only when the map is rotated. */}
        {/* (Sibling — the measure chip renders separately below) */}
        {Math.round(heading) % 360 !== 0 && (
          <button
            type="button"
            onClick={resetHeading}
            title="Reset to north"
            aria-label="Reset to north"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-lg ring-1 ring-black/10 transition hover:bg-slate-50"
            style={{ transform: `rotate(${-heading}deg)` }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                 stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                 className="h-5 w-5">
              <polygon points="12 2 14 12 12 22 10 12 12 2" fill="#dc2626" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
