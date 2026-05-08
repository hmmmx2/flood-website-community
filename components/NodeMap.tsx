"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Circle,
  GoogleMap,
  InfoWindow,
  Marker,
  useJsApiLoader,
} from "@react-google-maps/api";

// ── Types ─────────────────────────────────────────────────────────────────────
export type FloodLevel = 0 | 1 | 2 | 3;

export type MapNode = {
  id: string;       // internal DB id — used as React key
  nodeId: string;   // sensor identifier e.g. "102503180" — used for favourites API
  name?: string;
  area?: string;
  location?: string;
  state?: string;
  /** Reverse-geocoded full address (Phase 2). When present, the InfoWindow
   *  leads with this instead of the technical nodeId. */
  address?: string | null;
  latitude: number;
  longitude: number;
  currentLevel: FloodLevel;
  isOffline: boolean;
  lastUpdated?: string;
};

/** A user-saved place (Home / Workplace / etc.) rendered as a distinct
 *  pin with a translucent radius circle around it. */
export type MapSavedLocation = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  alertRadiusKm: number;
};

// ── Color helpers — kept in sync with flood-website-crm statusHexMap ─────────
export const STATUS_HEX: Record<FloodLevel, string> = {
  0: "#56e40a", // Dry      — bright lime  (CRM: normal/dry)
  1: "#ffd54f", // Normal   — amber-yellow (CRM: alert)
  2: "#ff9f1c", // Warning  — orange       (CRM: warning)
  3: "#d7263d", // Critical — dark red     (CRM: critical)
};
const OFFLINE_COLOR = "#6b7280";

const LEVEL_LABEL: Record<FloodLevel, string> = {
  0: "Dry",
  1: "Normal",
  2: "Warning",
  3: "Critical",
};

const WATER_M: Record<FloodLevel, string> = {
  0: "0.0 m",
  1: "1.0 m",
  2: "2.5 m",
  3: "4.0 m",
};

export function getMarkerColor(node: MapNode): string {
  if (node.isOffline) return OFFLINE_COLOR;
  return STATUS_HEX[node.currentLevel] ?? STATUS_HEX[0];
}

function getStatusLabel(node: MapNode): string {
  if (node.isOffline) return "Offline";
  return LEVEL_LABEL[node.currentLevel];
}

// ── Map styling ───────────────────────────────────────────────────────────────
const mapStyles: google.maps.MapTypeStyle[] = [
  { featureType: "poi",  stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "labels",   stylers: [{ visibility: "simplified" }] },
];

const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "";
const hasValidApiKey = apiKey.length > 10 && !apiKey.includes("Example");

// ── Props ─────────────────────────────────────────────────────────────────────
type NodeMapProps = {
  nodes: MapNode[];
  height?: number;
  zoom?: number;
  /** When set, the map pans to and opens the InfoWindow for this node.id */
  focusNodeId?: string | null;
  /** node.id values that get the gold highlight ring */
  highlightedIds?: Set<string>;
  /** node.nodeId values that are starred */
  favouriteIds?: Set<string>;
  /** Called with node.nodeId when the user clicks the star button */
  onToggleFavourite?: (nodeId: string) => void;
  /** Phase 4 — saved places rendered as house pins with radius circles */
  savedLocations?: MapSavedLocation[];
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function NodeMap({
  nodes,
  height = 460,
  zoom = 10,
  focusNodeId = null,
  highlightedIds,
  favouriteIds,
  onToggleFavourite,
  savedLocations,
}: NodeMapProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [clickedId, setClickedId] = useState<string | null>(null);
  const activeId = clickedId ?? hoveredId;
  const [mapError, setMapError] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);

  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: apiKey,
  });

  useEffect(() => { if (loadError) setMapError(true); }, [loadError]);

  // Most recently updated node — gets the gold ring
  const latestNode = useMemo(() => {
    if (!nodes.length) return null;
    return nodes.reduce((a, b) =>
      new Date(b.lastUpdated ?? 0).getTime() > new Date(a.lastUpdated ?? 0).getTime() ? b : a,
    );
  }, [nodes]);

  // Pan + open InfoWindow when caller changes focusNodeId
  useEffect(() => {
    if (!focusNodeId || !mapRef.current) return;
    const target = nodes.find(n => n.id === focusNodeId);
    if (!target) return;
    mapRef.current.panTo({ lat: target.latitude, lng: target.longitude });
    mapRef.current.setZoom(15);
    setClickedId(focusNodeId);
  }, [focusNodeId, nodes]);

  // Initial center — computed once on mount from node average
  const mapCenter = useMemo(() => {
    if (!nodes.length) return { lat: 1.553, lng: 110.344 };
    const avgLat = nodes.reduce((s, n) => s + n.latitude, 0) / nodes.length;
    const avgLng = nodes.reduce((s, n) => s + n.longitude, 0) / nodes.length;
    return { lat: avgLat, lng: avgLng };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally mount-only — we never re-center on data refresh

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    setMapError(false);
  }, []);

  const activeNode = nodes.find(n => n.id === activeId);

  // Phase 4 accessibility: visible markers ≈ 32 px tall (scale 2.2 → 53 px
  // bounding box, well over the 44-px tap target WCAG recommends), with a
  // dark outer stroke for contrast against the light map style.
  const getIcon = (node: MapNode): google.maps.Symbol | undefined => {
    if (typeof google === "undefined") return undefined;
    const isHighlighted = highlightedIds?.has(node.id) || latestNode?.id === node.id;
    return {
      path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z",
      fillColor: getMarkerColor(node),
      fillOpacity: 1,
      strokeColor: isHighlighted ? "#FFB800" : "#1f2937",
      strokeWeight: isHighlighted ? 4 : 2,
      scale: isHighlighted ? 2.6 : 2.2,
      anchor: new google.maps.Point(12, 24),
    };
  };

  const getRingIcon = (): google.maps.Symbol | undefined => {
    if (typeof google === "undefined") return undefined;
    return {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: "transparent",
      fillOpacity: 0,
      strokeColor: "#FFB800",
      strokeWeight: 2.5,
      strokeOpacity: 0.7,
      scale: 28,
    };
  };

  // Saved-place pin — house silhouette in brand blue, visually distinct
  // from sensor pins so users never mistake their saved address for a
  // sensor reading.
  const getSavedLocationIcon = (): google.maps.Symbol | undefined => {
    if (typeof google === "undefined") return undefined;
    return {
      // House: rectangular base + triangular roof
      path: "M3 12L12 3L21 12V21H14V14H10V21H3V12Z",
      fillColor: "#2563eb",
      fillOpacity: 0.95,
      strokeColor: "#ffffff",
      strokeWeight: 2,
      scale: 1.6,
      anchor: new google.maps.Point(12, 21),
    };
  };

  // ── Fallback when no API key ───────────────────────────────────────────────
  if (!hasValidApiKey || mapError || loadError) {
    return (
      <div
        className="relative flex w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-bg)] to-[var(--color-hover)]"
        style={{ height }}
      >
        <div className="absolute inset-0 opacity-10">
          <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <pattern id="mapgrid" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#94a3b8" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100" height="100" fill="url(#mapgrid)" />
          </svg>
        </div>

        <div className="relative mb-4 flex items-center justify-center gap-2">
          {nodes.slice(0, 6).map((node, i) => (
            <div
              key={node.id}
              className="flex h-8 w-8 items-center justify-center rounded-full shadow-md"
              style={{
                backgroundColor: getMarkerColor(node),
                transform: `translateY(${i % 2 === 0 ? -4 : 4}px)`,
              }}
            >
              <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
              </svg>
            </div>
          ))}
        </div>

        <div className="relative z-10 text-center">
          <p className="text-sm font-semibold text-[var(--color-text)]">Map Preview</p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            {nodes.length} sensor{nodes.length !== 1 ? "s" : ""} loaded
          </p>
        </div>

        <div className="relative z-10 mt-4 flex flex-wrap justify-center gap-2 px-4">
          {nodes.slice(0, 4).map(node => (
            <div key={node.id} className="flex items-center gap-2 rounded-lg bg-[var(--color-card)]/95 backdrop-blur-sm px-2 py-1 text-xs shadow-sm border border-[var(--color-border)]/80">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: getMarkerColor(node) }} />
              <span className="font-medium text-[var(--color-text)]">{node.nodeId}</span>
              <span className="text-[var(--color-muted)]">
                {node.isOffline ? "Offline" : WATER_M[node.currentLevel]}
              </span>
            </div>
          ))}
          {nodes.length > 4 && (
            <div className="flex items-center rounded-lg bg-[var(--color-brand-light)] px-2 py-1 text-xs font-medium text-[var(--color-brand)]">
              +{nodes.length - 4} more
            </div>
          )}
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
    <GoogleMap
      mapContainerStyle={{ width: "100%", height, borderRadius: "16px" }}
      center={mapCenter}
      zoom={zoom}
      options={{
        disableDefaultUI: true,
        zoomControl: true,
        styles: mapStyles,
        gestureHandling: "greedy",
      }}
      onLoad={onMapLoad}
    >
      {/* Saved-place radius circles + house pins — rendered first so
          they sit beneath the sensor markers in z-order. */}
      {savedLocations?.map(loc => (
        <React.Fragment key={`saved-${loc.id}`}>
          <Circle
            center={{ lat: loc.latitude, lng: loc.longitude }}
            radius={loc.alertRadiusKm * 1000}
            options={{
              fillColor: "#2563eb",
              fillOpacity: 0.08,
              strokeColor: "#2563eb",
              strokeOpacity: 0.45,
              strokeWeight: 1.5,
              clickable: false,
              zIndex: 0,
            }}
          />
          <Marker
            position={{ lat: loc.latitude, lng: loc.longitude }}
            icon={getSavedLocationIcon()}
            title={`${loc.label} — ${loc.alertRadiusKm} km radius`}
            clickable={false}
            zIndex={5}
          />
        </React.Fragment>
      ))}

      {nodes.map(node => {
        const isHighlighted = highlightedIds?.has(node.id) || latestNode?.id === node.id;
        return (
          <React.Fragment key={node.id}>
            {isHighlighted && (
              <Marker
                position={{ lat: node.latitude, lng: node.longitude }}
                icon={getRingIcon()}
                clickable={false}
                zIndex={0}
              />
            )}
            <Marker
              position={{ lat: node.latitude, lng: node.longitude }}
              icon={getIcon(node)}
              onMouseOver={() => setHoveredId(node.id)}
              onMouseOut={() => setHoveredId(null)}
              onClick={() => setClickedId(prev => prev === node.id ? null : node.id)}
              zIndex={isHighlighted ? 10 : 1}
            />
          </React.Fragment>
        );
      })}

      {activeNode && (
        <InfoWindow
          position={{ lat: activeNode.latitude, lng: activeNode.longitude }}
          onCloseClick={() => { setClickedId(null); setHoveredId(null); }}
          options={{
            pixelOffset: new google.maps.Size(0, -34),
            disableAutoPan: false,
          }}
        >
          <div style={{ minWidth: 240, fontFamily: "inherit", padding: "2px 2px 4px" }}>
            {/* Header — Phase 4: address-first. The reverse-geocoded
                address is what residents care about; the sensor's
                technical nodeId is demoted to a small grey caption. */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontWeight: 700, fontSize: 14, color: "#0f172a",
                  margin: 0, lineHeight: 1.3, wordBreak: "break-word",
                }}>
                  {activeNode.address
                    || [activeNode.location, activeNode.area].filter(Boolean).join(", ")
                    || "Unnamed location"}
                </p>
                <p style={{
                  fontSize: 10, color: "#94a3b8", margin: "3px 0 0",
                  letterSpacing: "0.04em", textTransform: "uppercase",
                }}>
                  Sensor {activeNode.nodeId}
                </p>
              </div>
              {latestNode?.id === activeNode.id && (
                <span style={{
                  background: "#fef3c7", color: "#92400e",
                  fontSize: 9, fontWeight: 700, padding: "2px 6px",
                  borderRadius: 999, letterSpacing: "0.05em",
                  flexShrink: 0,
                }}>
                  LATEST
                </span>
              )}
            </div>

            {/* Stats */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#374151" }}>
                <span style={{
                  display: "inline-block", width: 8, height: 8, borderRadius: "50%",
                  background: getMarkerColor(activeNode), flexShrink: 0,
                }} />
                <span>Status: <strong>{getStatusLabel(activeNode)}</strong></span>
              </div>
              <div style={{ fontSize: 12, color: "#374151", paddingLeft: 14 }}>
                Water Level:{" "}
                <strong style={{ color: "#dc2626" }}>
                  {activeNode.isOffline ? "—" : WATER_M[activeNode.currentLevel]}
                </strong>
              </div>
              <div style={{ fontSize: 12, color: "#374151", paddingLeft: 14 }}>
                Node Status:{" "}
                <strong style={{ color: activeNode.isOffline ? "#dc2626" : "#16a34a" }}>
                  {activeNode.isOffline ? "Offline" : "Online"}
                </strong>
              </div>
              {activeNode.lastUpdated && (
                <div style={{ fontSize: 12, color: "#374151", paddingLeft: 14 }}>
                  Last Updated:{" "}
                  <span style={{ fontWeight: 500 }}>
                    {new Date(activeNode.lastUpdated).toLocaleString("en-MY", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
              )}
            </div>

            {/* Coordinates */}
            <p style={{
              fontSize: 10, color: "#94a3b8", margin: "0 0 10px",
              paddingTop: 6, borderTop: "1px solid #e2e8f0",
            }}>
              {activeNode.latitude.toFixed(6)}°N, {activeNode.longitude.toFixed(6)}°E
            </p>

            {/* Favourite button */}
            {onToggleFavourite && (() => {
              const isFav = favouriteIds?.has(activeNode.nodeId) ?? false;
              return (
                <button
                  type="button"
                  onClick={() => onToggleFavourite(activeNode.nodeId)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    gap: 6, width: "100%", minHeight: 44, padding: "10px 12px",
                    borderRadius: 10,
                    border: isFav ? "1.5px solid #f59e0b" : "1.5px solid #d1d5db",
                    background: isFav ? "#fffbeb" : "#f9fafb",
                    color: isFav ? "#b45309" : "#374151",
                    fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                    fill={isFav ? "#f59e0b" : "none"}
                    stroke={isFav ? "#f59e0b" : "#6b7280"}
                    strokeWidth="1.8"
                    style={{ width: 14, height: 14, flexShrink: 0 }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                  </svg>
                  {isFav ? "Remove Favourite" : "Add to Favourites"}
                </button>
              );
            })()}
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  );
}
