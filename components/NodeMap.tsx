"use client";

/**
 * <ZoneMap /> — privacy-first Flood Map.
 *
 * Phase 4b redesign: individual sensor positions are NEVER rendered or
 * exposed in the DOM. The component only accepts pre-aggregated
 * `MapZone[]` (worst-level + count per area) and renders translucent
 * coloured circles at obfuscated centroids. This protects physical
 * hardware from theft and vandalism — a resident sees "Penampang —
 * High Risk" but can't track the device to a riverbank.
 *
 * Interactions:
 *   • Right-click on map  → onMapRightClick(lat, lng)  (drop a saved-place pin)
 *   • Autocomplete search → onPlaceSelect(lat, lng, name)
 *   • Saved-location pins are still clickable (those are the *user's* pins, not sensors).
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
  OverlayView,
  useJsApiLoader,
  type Libraries,
} from "@react-google-maps/api";

// ── Types ─────────────────────────────────────────────────────────────────────
export type ZoneStatus = "dry" | "normal" | "warning" | "critical" | "offline";

export type MapZone = {
  id: string;            // unique zone key — typically the area name
  name: string;          // display name (e.g. "Penampang", "Kota Kinabalu")
  region?: string;       // parent district / state, optional caption
  worstLevel: ZoneStatus;
  sensorCount: number;
  /** Centroid-shifted lat/lng — never the true sensor position. */
  centerLat: number;
  centerLng: number;
  /** Visual radius in metres. Constant per area; not derived from the
   *  spread of underlying sensors (which would leak density info). */
  radiusM: number;
  lastUpdated?: string;
};

export type MapSavedLocation = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  alertRadiusKm: number;
};

// ── Constants ─────────────────────────────────────────────────────────────────
/** Numeric-keyed status palette retained for legend / filter chip code in
 *  flood-map/page.tsx. The four water levels map 1:1 onto ZoneStatus. */
export type FloodLevel = 0 | 1 | 2 | 3;
export const STATUS_HEX: Record<FloodLevel, string> = {
  0: "#16a34a", // emerald — All clear
  1: "#facc15", // amber — Normal
  2: "#f97316", // orange — Warning
  3: "#dc2626", // red    — High Risk
};
const ZONE_HEX: Record<ZoneStatus, string> = {
  dry:      STATUS_HEX[0],
  normal:   STATUS_HEX[1],
  warning:  STATUS_HEX[2],
  critical: STATUS_HEX[3],
  offline:  "#6b7280",
};

const STATUS_LABEL: Record<ZoneStatus, string> = {
  dry:      "All clear",
  normal:   "Normal",
  warning:  "Warning",
  critical: "High Risk",
  offline:  "Sensor offline",
};

// `places` is required for the Autocomplete search bar. Hoisted to a
// stable reference so the loader's library list doesn't change between
// renders (changing it triggers a useJsApiLoader warning).
const MAPS_LIBRARIES: Libraries = ["places"];

const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "";
const hasValidApiKey = apiKey.length > 10 && !apiKey.includes("Example");

const mapStyles: google.maps.MapTypeStyle[] = [
  { featureType: "poi",  stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "labels",   stylers: [{ visibility: "simplified" }] },
];

// ── Props ─────────────────────────────────────────────────────────────────────
type ZoneMapProps = {
  zones: MapZone[];
  savedLocations?: MapSavedLocation[];
  height?: number;
  defaultZoom?: number;
  defaultCenter?: { lat: number; lng: number };
  /** Pan + zoom the map to this point. Used by the saved-place click flow. */
  focusLatLng?: { lat: number; lng: number; zoom?: number } | null;
  /** Right-click handler — receives the geographic point the user clicked. */
  onMapRightClick?: (lat: number, lng: number) => void;
  /** Place search handler — fired when user picks an Autocomplete suggestion. */
  onPlaceSelect?: (lat: number, lng: number, name: string) => void;
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function ZoneMap({
  zones,
  savedLocations,
  height = 480,
  defaultZoom = 10,
  defaultCenter,
  focusLatLng = null,
  onMapRightClick,
  onPlaceSelect,
}: ZoneMapProps) {
  const [mapError, setMapError] = useState(false);
  const [hoveredZoneId, setHoveredZoneId] = useState<string | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [searchInput, setSearchInput] = useState("");

  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: apiKey,
    libraries: MAPS_LIBRARIES,
  });

  useEffect(() => { if (loadError) setMapError(true); }, [loadError]);

  // Initial center — computed once on mount from the zone average.
  // Falls back to the explicit `defaultCenter` (or Sabah-ish coords).
  const mapCenter = useMemo(() => {
    if (defaultCenter) return defaultCenter;
    if (zones.length === 0) return { lat: 5.9788, lng: 116.0753 };
    const lat = zones.reduce((s, z) => s + z.centerLat, 0) / zones.length;
    const lng = zones.reduce((s, z) => s + z.centerLng, 0) / zones.length;
    return { lat, lng };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount-only

  // Pan to focusLatLng when it changes.
  useEffect(() => {
    if (!focusLatLng || !mapRef.current) return;
    mapRef.current.panTo({ lat: focusLatLng.lat, lng: focusLatLng.lng });
    if (focusLatLng.zoom != null) mapRef.current.setZoom(focusLatLng.zoom);
  }, [focusLatLng]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    setMapError(false);
  }, []);

  const handleRightClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (!onMapRightClick || !e.latLng) return;
    onMapRightClick(e.latLng.lat(), e.latLng.lng());
  }, [onMapRightClick]);

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
    onPlaceSelect?.(lat, lng, name);
  }, [onPlaceSelect]);

  // ── Saved-place house pin (kept from Phase 4) ─────────────────────────────
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
          {zones.length} flood {zones.length === 1 ? "zone" : "zones"} loaded
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2 px-4">
          {zones.slice(0, 4).map(z => (
            <div
              key={z.id}
              className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)]/95 px-2 py-1 text-xs"
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ZONE_HEX[z.worstLevel] }} />
              <span className="font-medium text-[var(--color-text)]">{z.name}</span>
              <span className="text-[var(--color-muted)]">{STATUS_LABEL[z.worstLevel]}</span>
            </div>
          ))}
        </div>
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
    <div className="relative" style={{ height }}>
      <GoogleMap
        mapContainerStyle={{ width: "100%", height: "100%", borderRadius: "16px" }}
        center={mapCenter}
        zoom={defaultZoom}
        options={{
          disableDefaultUI: true,
          zoomControl: true,
          styles: mapStyles,
          gestureHandling: "greedy",
          // We intentionally hide the Street View pegman — it lets users
          // confirm precise sensor positions on the ground, defeating the
          // centroid-shift obfuscation.
          streetViewControl: false,
          mapTypeControl: false,
          // Disable rotation/tilt so the visible zones stay aligned with
          // the colour-blind-friendly text labels.
          rotateControl: false,
        }}
        onLoad={onMapLoad}
        onRightClick={handleRightClick}
      >
        {/* ── Flood zones — translucent circles, soft edges. */}
        {zones.map(zone => {
          const colour = ZONE_HEX[zone.worstLevel];
          const isHovered = hoveredZoneId === zone.id;
          return (
            <React.Fragment key={`zone-${zone.id}`}>
              <Circle
                center={{ lat: zone.centerLat, lng: zone.centerLng }}
                radius={zone.radiusM}
                onMouseOver={() => setHoveredZoneId(zone.id)}
                onMouseOut={() => setHoveredZoneId(null)}
                options={{
                  fillColor: colour,
                  fillOpacity: isHovered ? 0.32 : 0.22,
                  strokeColor: colour,
                  strokeOpacity: 0.7,
                  strokeWeight: isHovered ? 2.5 : 1.5,
                  // Zones are *not* clickable as far as data exposure goes —
                  // hover only changes opacity, no InfoWindow. clickable=false
                  // also prevents the cursor from suggesting a click target.
                  clickable: false,
                  zIndex: 1,
                }}
              />
              {/* Zone label — high-contrast pill rendered as DOM so screen
                  readers find it. Positioned at the obfuscated centroid. */}
              <OverlayView
                position={{ lat: zone.centerLat, lng: zone.centerLng }}
                mapPaneName={OverlayView.OVERLAY_LAYER}
                getPixelPositionOffset={(w, h) => ({ x: -w / 2, y: -h / 2 })}
              >
                <div
                  role="img"
                  aria-label={`${zone.name}: ${STATUS_LABEL[zone.worstLevel]}`}
                  style={{
                    pointerEvents: "none",
                    userSelect: "none",
                    background: "rgba(255,255,255,0.92)",
                    border: `2px solid ${colour}`,
                    borderRadius: 999,
                    padding: "4px 10px",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#0f172a",
                    whiteSpace: "nowrap",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
                    fontFamily: "inherit",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: colour,
                      flexShrink: 0,
                    }}
                  />
                  <span>{zone.name}</span>
                  <span style={{ color: colour, fontWeight: 800 }}>
                    · {STATUS_LABEL[zone.worstLevel]}
                  </span>
                </div>
              </OverlayView>
            </React.Fragment>
          );
        })}

        {/* ── Saved-place radius circles + house pins (the user's own pins). */}
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

      {/* ── Floating Places search bar — top-left of the map. */}
      <div
        className="pointer-events-none absolute left-3 top-3 right-3 z-10 sm:right-auto sm:max-w-sm"
      >
        <div className="pointer-events-auto rounded-full bg-white shadow-lg ring-1 ring-black/10">
          <Autocomplete
            onLoad={(ac) => { autocompleteRef.current = ac; }}
            onPlaceChanged={handlePlaceChanged}
            options={{
              // Bias to Malaysia so suggestions feel local. The Place API
              // still returns global results if the user types something far away.
              componentRestrictions: { country: ["my"] },
              fields: ["geometry", "name", "formatted_address"],
            }}
          >
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
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
    </div>
  );
}
