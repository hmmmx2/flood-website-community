"use client";

/**
 * <NodeMap /> — Flood Map.
 *
 * Each sensor is rendered as a translucent coloured circle at its real
 * position; the circle fill colour reflects the current water-level
 * (Dry / Normal / Warning / Critical / Offline). No pin markers, no
 * InfoWindow — node identification is handled in the right-hand
 * "Nodes in Radius" panel that lives next to each saved place.
 *
 * The map also supports:
 *   • Right-click on map  → onMapRightClick(lat, lng)  (drop a saved-place pin)
 *   • Places Autocomplete → onPlaceSelect(lat, lng, name)
 *   • Saved-place house pins + alert-radius circles
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
  useJsApiLoader,
  type Libraries,
} from "@react-google-maps/api";

// ── Types ─────────────────────────────────────────────────────────────────────
export type FloodLevel = 0 | 1 | 2 | 3;

export type MapNode = {
  id: string;
  nodeId: string;
  name?: string;
  area?: string;
  location?: string;
  state?: string;
  address?: string | null;
  latitude: number;
  longitude: number;
  currentLevel: FloodLevel;
  isOffline: boolean;
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
export const STATUS_HEX: Record<FloodLevel, string> = {
  0: "#16a34a", // Dry      — emerald
  1: "#facc15", // Normal   — amber
  2: "#f97316", // Warning  — orange
  3: "#dc2626", // Critical — red
};
const OFFLINE_HEX = "#6b7280";

function getNodeColour(node: MapNode): string {
  if (node.isOffline) return OFFLINE_HEX;
  return STATUS_HEX[node.currentLevel] ?? STATUS_HEX[0];
}

const MAPS_LIBRARIES: Libraries = ["places"];

const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "";
const hasValidApiKey = apiKey.length > 10 && !apiKey.includes("Example");

const mapStyles: google.maps.MapTypeStyle[] = [
  { featureType: "poi",  stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "labels",   stylers: [{ visibility: "simplified" }] },
];

// ── Props ─────────────────────────────────────────────────────────────────────
type NodeMapProps = {
  nodes: MapNode[];
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
  /** Per-node circle radius in metres. Defaults to 350 m. */
  nodeRadiusM?: number;
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function NodeMap({
  nodes,
  savedLocations,
  height = 480,
  defaultZoom = 11,
  defaultCenter,
  focusLatLng = null,
  onMapRightClick,
  onPlaceSelect,
  nodeRadiusM = 350,
}: NodeMapProps) {
  const [mapError, setMapError] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [searchInput, setSearchInput] = useState("");

  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: apiKey,
    libraries: MAPS_LIBRARIES,
  });

  useEffect(() => { if (loadError) setMapError(true); }, [loadError]);

  const mapCenter = useMemo(() => {
    if (defaultCenter) return defaultCenter;
    if (nodes.length === 0) return { lat: 5.9788, lng: 116.0753 };
    const lat = nodes.reduce((s, n) => s + n.latitude,  0) / nodes.length;
    const lng = nodes.reduce((s, n) => s + n.longitude, 0) / nodes.length;
    return { lat, lng };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount-only

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
          {nodes.length} sensor{nodes.length === 1 ? "" : "s"} loaded
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
          streetViewControl: false,
          mapTypeControl: false,
          rotateControl: false,
        }}
        onLoad={onMapLoad}
        onRightClick={handleRightClick}
      >
        {/* Per-node circles — one per sensor, coloured by water level. */}
        {nodes.map(node => {
          const colour = getNodeColour(node);
          return (
            <Circle
              key={`node-${node.id}`}
              center={{ lat: node.latitude, lng: node.longitude }}
              radius={nodeRadiusM}
              options={{
                fillColor: colour,
                fillOpacity: 0.4,
                strokeColor: colour,
                strokeOpacity: 0.85,
                strokeWeight: 2,
                clickable: false,
                zIndex: 2,
              }}
            />
          );
        })}

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

      {/* Floating Places search bar — top-left of the map. */}
      <div className="pointer-events-none absolute left-3 top-3 right-3 z-10 sm:right-auto sm:max-w-sm">
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
