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
};

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
 *  - `places`   — Autocomplete + place details (already used).
 *  - `geometry` — needed by P1-6 flood-aware directions and P1-9
 *                 distance measurement. Bundle cost is small.
 *  - `marker`   — advanced markers, used by clustering later.
 *
 * `drawing` and `visualization` are intentionally **not** loaded
 * here; they're behind P2 features that lazy-load when used.
 */
const MAPS_LIBRARIES: Libraries = ["places", "geometry", "marker"];

const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "";
const hasValidApiKey = apiKey.length > 10 && !apiKey.includes("Example");

const mapStyles: google.maps.MapTypeStyle[] = [
  { featureType: "poi",  stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "labels",   stylers: [{ visibility: "simplified" }] },
];

const MAP_TYPE_STORAGE_KEY = "floodmap.mapType";
const TRAFFIC_STORAGE_KEY = "floodmap.traffic";

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
  const [layersOpen, setLayersOpen] = useState(false);
  useEffect(() => {
    try {
      const t = window.localStorage.getItem(MAP_TYPE_STORAGE_KEY);
      if (t === "roadmap" || t === "satellite" || t === "hybrid" || t === "terrain") {
        setMapType(t);
      }
      const tr = window.localStorage.getItem(TRAFFIC_STORAGE_KEY);
      if (tr === "1") setTrafficOn(true);
    } catch { /* no localStorage in some contexts — silent skip */ }
  }, []);
  function persistMapType(t: MapTypeKey) {
    setMapType(t);
    try { window.localStorage.setItem(MAP_TYPE_STORAGE_KEY, t); } catch { /* noop */ }
  }
  function persistTraffic(on: boolean) {
    setTrafficOn(on);
    try { window.localStorage.setItem(TRAFFIC_STORAGE_KEY, on ? "1" : "0"); } catch { /* noop */ }
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
    // `idle` fires once after pan + zoom settle. We forward the
    // viewport up so the page can render the rollup pill (P1-12)
    // and so Share-view can capture the user's current frame.
    map.addListener("idle", () => {
      const c = map.getCenter();
      const b = map.getBounds();
      if (!c || !b) return;
      const ne = b.getNorthEast();
      const sw = b.getSouthWest();
      onViewportChangedRef.current?.({
        centerLat: c.lat(),
        centerLng: c.lng(),
        zoom: map.getZoom() ?? 11,
        bounds: {
          north: ne.lat(),
          south: sw.lat(),
          east: ne.lng(),
          west: sw.lng(),
        },
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
    onPlaceSelect?.(lat, lng, name);
  }, [onPlaceSelect]);

  const savedPlaceIcon: google.maps.Symbol | undefined = useMemo(() => {
    if (typeof google === "undefined" || !isLoaded) return undefined;
    return {
      path: "M3 12L12 3L21 12V21H14V14H10V21H3V12Z",
      fillColor: "#2563eb",
      fillOpacity: 0.95,
      strokeColor: "#ffffff",
      strokeWeight: 2,
      scale: 1.6,
      anchor: new google.maps.Point(12, 21),
    };
  }, [isLoaded]);

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

        {/* Per-zone circles — one per aggregated zone, coloured by worst
            level. Clickable when the page provides `onZoneClick`. */}
        {zones.map(z => {
          const colour = getZoneColour(z);
          return (
            <Circle
              key={`zone-${z.id}`}
              center={{ lat: z.centroidLat, lng: z.centroidLng }}
              radius={z.radiusM}
              onClick={onZoneClick ? () => onZoneClick(z) : undefined}
              options={{
                fillColor: colour,
                fillOpacity: 0.35,
                strokeColor: colour,
                strokeOpacity: 0.85,
                strokeWeight: 2,
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

        {/* Saved-place radius circles + house pins. */}
        {savedLocations?.map(loc => (
          <React.Fragment key={`saved-${loc.id}`}>
            <Circle
              center={{ lat: loc.latitude, lng: loc.longitude }}
              radius={loc.alertRadiusKm * 1000}
              options={{
                fillColor: "#2563eb",
                fillOpacity: 0.07,
                strokeColor: "#2563eb",
                strokeOpacity: 0.5,
                strokeWeight: 1.5,
                clickable: false,
                zIndex: 0,
              }}
            />
            <Marker
              position={{ lat: loc.latitude, lng: loc.longitude }}
              icon={savedPlaceIcon}
              title={`${loc.label} — alerts within ${loc.alertRadiusKm} km`}
              clickable={false}
              zIndex={5}
            />
          </React.Fragment>
        ))}
      </GoogleMap>

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
        <div className="pointer-events-auto rounded-full bg-white shadow-lg ring-1 ring-black/10">
          <Autocomplete
            onLoad={(ac) => { autocompleteRef.current = ac; }}
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
              placeholder="Search a place…"
              aria-label="Search for a place"
              className="w-full rounded-full bg-transparent px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
            />
          </Autocomplete>
        </div>
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
