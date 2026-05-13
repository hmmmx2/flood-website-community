"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SearchModal from "@/components/SearchModal";
import { SearchField } from "@/components/ui/search-field";
import NodeMap, { STATUS_HEX } from "@/components/NodeMap";
import SavedLocationsPanel, { type SavedLocationsPanelHandle } from "@/components/SavedLocationsPanel";
import ShortcutsModal from "@/components/flood-map/ShortcutsModal";
import PlaceCard, { type PlaceCardModel } from "@/components/flood-map/PlaceCard";
import DirectionsPanel, { type DirectionsRequest } from "@/components/flood-map/DirectionsPanel";
import SavedPlaceStatusRow, { type SavedPlaceWithStatus } from "@/components/flood-map/SavedPlaceStatusRow";
import type { ScoredRoute } from "@/lib/useFloodAwareRoute";
import toast from "react-hot-toast";
import { useSession, signOut } from "next-auth/react";
import { sessionToAuthUser } from "@/lib/auth";
import { fetchJson } from "@/lib/fetchJson";
import { useSiteSearchModal } from "@/lib/useSiteSearchModal";
import { PAGE_CONTAINER } from "@/lib/layout";
import type { FloodLevel, Zone } from "@/lib/types";

// ── Helpers ───────────────────────────────────────────────────────────────────
const LEVEL_LABEL: Record<FloodLevel, string> = { 0: "Normal", 1: "Alert", 2: "Warning", 3: "Critical" };
const OFFLINE_HEX = "#6b7280";

// Haversine distance in km — used to score which zones fall inside each
// saved-place radius. We use the (already-rounded) zone centroid, NOT
// any per-sensor coord — privacy is preserved end-to-end.
function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat), lat2 = toRad(bLat);
  const a = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

function zoneStatusLabel(z: Zone): string {
  if (z.allOffline) return "Offline";
  return LEVEL_LABEL[z.worstLevel];
}
function zoneStatusHex(z: Zone): string {
  if (z.allOffline) return OFFLINE_HEX;
  return STATUS_HEX[z.worstLevel];
}

// ── Status filter keys ────────────────────────────────────────────────────────
type StatusKey = "dry" | "normal" | "warning" | "critical" | "offline";

const STATUS_OPTIONS: { key: StatusKey; label: string; dotHex: string }[] = [
  { key: "dry",      label: "Normal",   dotHex: STATUS_HEX[0] },
  { key: "normal",   label: "Alert",    dotHex: STATUS_HEX[1] },
  { key: "warning",  label: "Warning",  dotHex: STATUS_HEX[2] },
  { key: "critical", label: "Critical", dotHex: STATUS_HEX[3] },
  { key: "offline",  label: "Offline",  dotHex: OFFLINE_HEX   },
];

function zoneStatusKey(z: Zone): StatusKey {
  if (z.allOffline) return "offline";
  if (z.worstLevel === 0) return "dry";
  if (z.worstLevel === 1) return "normal";
  if (z.worstLevel === 2) return "warning";
  return "critical";
}

// ── SVG icons ─────────────────────────────────────────────────────────────────
function RefreshIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" /><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </svg>
  );
}
function FilterIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}
function ChevronDownIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
function XIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}
function MapPinIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
function AlertTriangleIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

// How often we re-poll /api/zones. The Java service ticks roughly every
// 10 s; we sample slightly slower than that to amortise the cost of the
// BFF aggregator without lagging behind the real flood state.
const POLL_INTERVAL_MS = 15_000;

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function FloodMapPage() {
  const { data: session } = useSession();
  const user = session?.user ? sessionToAuthUser(session.user) : null;
  const { searchOpen, openSearch, closeSearch } = useSiteSearchModal();
  const [zones, setZones]             = useState<Zone[]>([]);
  const [loading, setLoading]         = useState(true);
  const [fetchError, setFetchError]   = useState(false);
  const [lastFetch, setLastFetch]     = useState<Date | null>(null);
  const isFirstFetch                  = useRef(true);

  // ── Filters ────────────────────────────────────────────────────────────────
  // Filter panel is collapsed by default on small screens (so the map
  // is what greets a mobile evacuee) and open on desktop where the
  // chrome doesn't crowd the map. We don't import a media-query hook
  // — the SSR-safe initial value is OK to "open" everywhere, then
  // closed for sub-md viewports once we know we're in the browser.
  const [searchQuery, setSearchQuery]       = useState("");
  const [filterState, setFilterState]       = useState("");
  const [filterCity, setFilterCity]         = useState("");
  const [filterStatuses, setFilterStatuses] = useState<Set<StatusKey>>(new Set());
  const [panelOpen, setPanelOpen]           = useState(true);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.innerWidth < 768) setPanelOpen(false);
  }, []);

  // ── Map focus ──────────────────────────────────────────────────────────────
  const [focusLatLng, setFocusLatLng] =
    useState<{ lat: number; lng: number; zoom?: number } | null>(null);
  const [myLocation, setMyLocation] =
    useState<{ lat: number; lng: number; accuracyM?: number } | null>(null);
  const mapCardRef = useRef<HTMLDivElement>(null);
  const savedLocationsRef = useRef<SavedLocationsPanelHandle | null>(null);

  // ── Viewport tracking (P1-12 rollup pill) ─────────────────────────────────
  // Updated on every `idle` event from the map. We use the bounds to
  // rank zones inside the current viewport for the worst-status pill.
  const [viewport, setViewport] = useState<{
    centerLat: number;
    centerLng: number;
    zoom: number;
    bounds: { north: number; south: number; east: number; west: number };
  } | null>(null);

  // ── Keyboard shortcuts (P1-13) ────────────────────────────────────────────
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // ── Reduced motion (P2-8) ─────────────────────────────────────────────────
  // Used to skip the pulse animation on the "Live" indicator for users
  // who set the OS preference to reduce motion. The map itself defers
  // to Google's animation prefs (which Google already gates on this
  // media query).
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  // ── Place Card (P1-5 + P1-8) ──────────────────────────────────────────────
  // One card serves all three entry points: zone click, right-click on
  // map, autocomplete pick. Closing returns to a bare map.
  const [placeCardOpen, setPlaceCardOpen] = useState(false);
  const [placeCardModel, setPlaceCardModel] = useState<PlaceCardModel | null>(null);
  function openPlaceCard(model: PlaceCardModel) {
    setPlaceCardModel(model);
    setPlaceCardOpen(true);
  }

  // ── Directions Panel (P1-6) ───────────────────────────────────────────────
  const [directionsOpen, setDirectionsOpen] = useState(false);
  const [directionsRequest, setDirectionsRequest] = useState<DirectionsRequest | null>(null);
  const [activeRoutes, setActiveRoutes] = useState<
    ScoredRoute<google.maps.DirectionsRoute>[] | null
  >(null);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  function openDirections(req: DirectionsRequest | null) {
    setDirectionsRequest(req);
    setDirectionsOpen(true);
  }

  // Auto-centre the map on the user's current position the first time
  // they land here. Browser auto-prompts for permission. We never poll
  // — just one read at mount; the recenter button on the map re-runs.
  const requestGeolocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracyM = pos.coords.accuracy;
        setMyLocation({ lat, lng, accuracyM });
        setFocusLatLng({ lat, lng, zoom: 13 });
      },
      () => { /* user denied — silently skip */ },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  }, []);

  useEffect(() => {
    requestGeolocation();
  }, [requestGeolocation]);

  // ── Deep-link from a shared URL (P1-10) ───────────────────────────────────
  // `?lat=…&lng=…&z=…` lets a user paste a Share-this-view link and land
  // on the exact frame the sharer saw. We read the params once at mount
  // and forward them through `focusLatLng` so the map pans on first load.
  const initialQuery = useSearchParams();
  useEffect(() => {
    const lat = Number(initialQuery?.get("lat"));
    const lng = Number(initialQuery?.get("lng"));
    const z   = Number(initialQuery?.get("z"));
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      setFocusLatLng({
        lat,
        lng,
        zoom: Number.isFinite(z) ? Math.min(20, Math.max(2, z)) : 13,
      });
    }
    // intentionally mount-only — re-running on subsequent searchParams
    // changes would fight the user's own panning
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Global keyboard shortcuts (P1-13) ─────────────────────────────────────
  // We add a small handler at the page level. Each key falls through if
  // the user is typing in an input/textarea so we never hijack typing.
  useEffect(() => {
    const isTyping = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
    };
    const onKey = (e: KeyboardEvent) => {
      // `?` (shift + /) and `/` arrive with different key values across
      // browsers; check both. Always allow Esc.
      if (e.key === "Escape") {
        setShortcutsOpen(false);
        return;
      }
      if (isTyping(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
        return;
      }
      if (e.key === "/") {
        // Focus the in-map search box. We tag it with a data attr so
        // we don't depend on a fragile className path.
        const input = document.querySelector<HTMLInputElement>('input[aria-label="Search for a place"]');
        if (input) {
          e.preventDefault();
          input.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Saved locations — sourced from SavedLocationsPanel via callback ───────
  // Raw shape (no status). The status-decorated view that goes to the
  // map is derived below from `placesWithStatus`.
  const [savedLocations, setSavedLocations] = useState<{
    id: string; label: string; latitude: number; longitude: number; alertRadiusKm: number;
  }[]>([]);

  function focusOnPoint(lat: number, lng: number, zoom = 13) {
    setFocusLatLng({ lat, lng, zoom });
    mapCardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // Deep-link: /flood-map?zone=<zoneId> pans onto that zone once loaded.
  const search = useSearchParams();
  const zoneIdParam = search?.get("zone") ?? null;
  const focusedZoneIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!zoneIdParam) return;
    if (focusedZoneIdRef.current === zoneIdParam) return;
    if (zones.length === 0) return;
    const target = zones.find((z) => z.id === zoneIdParam);
    if (!target) return;
    focusedZoneIdRef.current = zoneIdParam;
    focusOnPoint(target.centroidLat, target.centroidLng, 13);
  }, [zoneIdParam, zones]);

  // Right-click on the map → reverse-geocode, then open the Place Card.
  // The card carries a Save button that opens the existing
  // SavedLocationsPanel editor with the same prefill, so the old
  // "right-click to save" muscle memory keeps working — just with one
  // extra click for the new affordances (directions, copy coords, share).
  const handleMapRightClick = useCallback(async (lat: number, lng: number) => {
    let address = "";
    let name = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    try {
      if (typeof google !== "undefined" && google.maps?.Geocoder) {
        const geocoder = new google.maps.Geocoder();
        const res = await geocoder.geocode({ location: { lat, lng } });
        address = res.results[0]?.formatted_address ?? "";
        // Prefer a short locality name when available so the card's
        // title isn't a giant address line.
        const locality =
          res.results[0]?.address_components.find(c =>
            c.types.includes("locality") || c.types.includes("sublocality"),
          )?.long_name;
        if (locality) name = locality;
      }
    } catch { /* reverse geocode is best-effort */ }
    openPlaceCard({ kind: "place", name, address, lat, lng });
  }, []);

  // ── Data fetching ──────────────────────────────────────────────────────────
  const inFlightAbort = useRef<AbortController | null>(null);

  const fetchZones = useCallback(async () => {
    inFlightAbort.current?.abort();
    const controller = new AbortController();
    inFlightAbort.current = controller;

    if (isFirstFetch.current) setLoading(true);
    setFetchError(false);
    try {
      const data = await fetchJson<Zone[]>("/api/zones", { signal: controller.signal });
      if (inFlightAbort.current !== controller) return;
      setZones(Array.isArray(data) ? data : []);
      setLastFetch(new Date());
      isFirstFetch.current = false;
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return;
      if (inFlightAbort.current !== controller) return;
      setFetchError(true);
    } finally {
      if (inFlightAbort.current === controller) {
        inFlightAbort.current = null;
        setLoading(false);
      }
    }
  }, []);

  // Initial fetch + lightweight polling. We don't subscribe to the
  // per-sensor SSE stream on this page — that endpoint carries raw
  // coordinates which would defeat the BFF aggregation. A zone-level
  // SSE is a future improvement; until then, 15-second polls are
  // plenty for a public-facing flood map.
  useEffect(() => {
    void fetchZones();
    const id = window.setInterval(() => { void fetchZones(); }, POLL_INTERVAL_MS);

    // Refetch when the tab regains focus so a user returning after a
    // background period sees fresh data instantly.
    const onVisibility = () => {
      if (document.visibilityState === "visible") void fetchZones();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
      inFlightAbort.current?.abort();
      inFlightAbort.current = null;
    };
  }, [fetchZones]);

  // ── Derived: dropdown options ──────────────────────────────────────────────
  const availableStates = useMemo(() => {
    const s = new Set<string>();
    zones.forEach(z => { if (z.state) s.add(z.state); });
    return [...s].sort();
  }, [zones]);

  const availableCities = useMemo(() => {
    const src = filterState ? zones.filter(z => z.state === filterState) : zones;
    const c = new Set<string>();
    src.forEach(z => { if (z.area) c.add(z.area); });
    return [...c].sort();
  }, [zones, filterState]);

  useEffect(() => { setFilterCity(""); }, [filterState]);

  function toggleStatus(key: StatusKey) {
    setFilterStatuses(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function clearAllFilters() {
    setFilterState(""); setFilterCity("");
    setFilterStatuses(new Set()); setSearchQuery("");
  }

  const activeFilterCount = useMemo(() => {
    let n = filterStatuses.size;
    if (filterState)        n++;
    if (filterCity)         n++;
    if (searchQuery.trim()) n++;
    return n;
  }, [filterState, filterCity, filterStatuses, searchQuery]);

  // ── Filtered zones ─────────────────────────────────────────────────────────
  const filteredZones = useMemo(() => {
    let r = zones;
    if (filterState) r = r.filter(z => z.state === filterState);
    if (filterCity)  r = r.filter(z => z.area  === filterCity);
    if (filterStatuses.size > 0) r = r.filter(z => filterStatuses.has(zoneStatusKey(z)));
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      r = r.filter(z =>
        (z.name  ?? "").toLowerCase().includes(q) ||
        (z.area  ?? "").toLowerCase().includes(q) ||
        (z.state ?? "").toLowerCase().includes(q),
      );
    }
    return r;
  }, [zones, filterState, filterCity, filterStatuses, searchQuery]);

  // (savedLocationsForMap moved below placesWithStatus — see further down.)

  // Worst status visible inside the current viewport (P1-12). Uses the
  // bounds the map gives us on `idle`. Falls back to "all zones" when
  // we don't have a viewport yet (initial mount) so the pill still
  // shows something useful.
  const viewportRollup = useMemo(() => {
    if (!viewport) {
      return {
        critical: filteredZones.filter(z => !z.allOffline && z.worstLevel === 3).length,
        warning:  filteredZones.filter(z => !z.allOffline && z.worstLevel === 2).length,
        inView:   filteredZones.length,
      };
    }
    const { bounds } = viewport;
    const inside = filteredZones.filter(z =>
      z.centroidLat <= bounds.north &&
      z.centroidLat >= bounds.south &&
      z.centroidLng <= bounds.east &&
      z.centroidLng >= bounds.west,
    );
    return {
      critical: inside.filter(z => !z.allOffline && z.worstLevel === 3).length,
      warning:  inside.filter(z => !z.allOffline && z.worstLevel === 2).length,
      inView:   inside.length,
    };
  }, [filteredZones, viewport]);

  // Share-view handler — produces a URL with the current center + zoom
  // and writes it to the clipboard. The map calls this from its
  // floating Share button with the live viewport so we always share
  // what the user is currently looking at (not a stale react state).
  const handleShareView = useCallback((vp: { centerLat: number; centerLng: number; zoom: number }) => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("lat", vp.centerLat.toFixed(5));
    url.searchParams.set("lng", vp.centerLng.toFixed(5));
    url.searchParams.set("z", String(Math.round(vp.zoom)));
    // We never include zone/sensor ids in the share link — the URL
    // is a frame, not a node.
    url.searchParams.delete("zone");
    url.searchParams.delete("node");
    const href = url.toString();
    void (async () => {
      try {
        if (navigator.share) {
          await navigator.share({ title: "Flood Map", url: href });
          return;
        }
        await navigator.clipboard.writeText(href);
        toast.success("Link copied to clipboard");
      } catch (err) {
        // User cancelled the share sheet, or clipboard was denied.
        if ((err as { name?: string })?.name !== "AbortError") {
          toast.error("Couldn't copy the link.");
        }
      }
    })();
  }, []);

  // For each saved place, compute the zones within its radius — sorted
  // by distance to the rounded zone centroid (never to a sensor).
  // The returned shape is what the SavedPlaceStatusRow (S6-1 + S6-5)
  // and the on-map status halo (S6-2) both read.
  const placesWithStatus = useMemo<SavedPlaceWithStatus[]>(() => {
    if (savedLocations.length === 0) return [];
    return savedLocations.map(place => {
      const matched = filteredZones
        .map(z => ({
          z,
          d: haversineKm(place.latitude, place.longitude, z.centroidLat, z.centroidLng),
        }))
        .filter(({ d }) => d <= place.alertRadiusKm)
        .sort((a, b) => a.d - b.d);
      let worst: FloodLevel = 0;
      let anyOffline = false;
      let allOffline = matched.length > 0;
      let newestUpdate: string | undefined;
      for (const { z } of matched) {
        if (z.allOffline) anyOffline = true;
        else allOffline = false;
        if (!z.allOffline && z.worstLevel > worst) worst = z.worstLevel;
        if (!z.allOffline && z.anyOffline) anyOffline = true;
        if (z.lastUpdated && (!newestUpdate || z.lastUpdated > newestUpdate)) {
          newestUpdate = z.lastUpdated;
        }
      }
      return {
        place: {
          id: place.id,
          label: place.label,
          latitude: place.latitude,
          longitude: place.longitude,
          alertRadiusKm: place.alertRadiusKm,
        },
        items: matched,
        worstLevel: worst,
        anyOffline,
        allOffline,
        newestUpdate,
      };
    });
  }, [savedLocations, filteredZones]);

  // Map gets the status-decorated saved locations so the on-map pin
  // halo and radius colour can follow the worst flood status nearby
  // (S6-2 + S6-3). When zones are still loading, status defaults to
  // "clear" (blue) — gentlest fallback.
  const savedLocationsForMap = useMemo(() =>
    placesWithStatus.length === savedLocations.length
      ? placesWithStatus.map(p => ({
          id: p.place.id,
          label: p.place.label,
          latitude: p.place.latitude,
          longitude: p.place.longitude,
          alertRadiusKm: p.place.alertRadiusKm,
          worstLevel: p.worstLevel,
          allOffline: p.allOffline,
        }))
      : savedLocations,
    [placesWithStatus, savedLocations],
  );

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:    filteredZones.length,
    totalAll: zones.length,
    online:   filteredZones.filter(z => !z.allOffline).length,
    offline:  filteredZones.filter(z => z.allOffline).length,
    dry:      filteredZones.filter(z => !z.allOffline && z.worstLevel === 0).length,
    normal:   filteredZones.filter(z => !z.allOffline && z.worstLevel === 1).length,
    warning:  filteredZones.filter(z => !z.allOffline && z.worstLevel === 2).length,
    critical: filteredZones.filter(z => !z.allOffline && z.worstLevel === 3).length,
  }), [filteredZones, zones]);

  const card = "bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] shadow-sm";

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <Navbar
        user={user}
        onLogout={() => void signOut({ callbackUrl: "/login" })}
        onSearchOpen={openSearch}
        searchPlaceholder="Search posts & communities…"
        activeLink="sensors"
      />

      <main className={`${PAGE_CONTAINER} py-6 space-y-5`}>

        {/* ── Page header ──────────────────────────────────────────────────── */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text)]">Flood Map</h1>
            <p className="text-sm text-[var(--color-muted)] mt-0.5">
              Real-time flood zones across Sabah, aggregated for privacy.
              Search for a place, or <strong className="text-[var(--color-text)]">right-click anywhere on the map</strong> to save it as a place and get alerts.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {loading && !lastFetch ? (
              <div className="flex items-center gap-2" aria-live="polite">
                <span
                  className={`h-3 w-3 rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-brand)] ${reducedMotion ? "" : "animate-spin"}`}
                  aria-hidden
                />
                <span className="text-xs text-[var(--color-muted)]">Loading flood zones…</span>
              </div>
            ) : lastFetch ? (
              <div className="flex items-center gap-2" aria-live="polite">
                <span
                  className={`h-2 w-2 rounded-full bg-green-500 ${reducedMotion ? "" : "animate-pulse"}`}
                  aria-hidden
                />
                <span className="text-xs text-[var(--color-muted)]">
                  Live · Updated {lastFetch.toLocaleTimeString()}
                </span>
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => void fetchZones()}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] transition"
              title="Refresh"
            >
              <RefreshIcon className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* ── Saved-place status row (S6-1 / S6-5 / S6-6) ─────────────────────
            First thing under the page header — answers "am I safe?"
            at a glance, expands inline to the per-zone list, and falls
            back to a nudge card for users who haven't saved a place. */}
        {user && (
          <SavedPlaceStatusRow
            placesWithStatus={placesWithStatus}
            isEmpty={savedLocations.length === 0}
            hasMyLocation={!!myLocation}
            reducedMotion={reducedMotion}
            onAddCurrentLocation={() => {
              if (!myLocation) {
                requestGeolocation();
                return;
              }
              // Reuse the right-click + reverse-geocode flow that
              // already exists; the editor will reverse-geocode on its
              // own when the saved-place address field is left blank.
              void handleMapRightClick(myLocation.lat, myLocation.lng);
            }}
            onFocus={(lat, lng, zoom = 13) => focusOnPoint(lat, lng, zoom)}
            onFocusZone={(z) => {
              focusOnPoint(z.centroidLat, z.centroidLng, 14);
              openPlaceCard({ kind: "zone", zone: z });
            }}
          />
        )}

        {/* ── Filter panel ─────────────────────────────────────────────────── */}
        <div className={card}>
          <div className="flex items-center justify-between px-5 py-4">
            <button
              type="button"
              onClick={() => setPanelOpen(o => !o)}
              className="flex items-center gap-2.5 focus:outline-none"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--color-input-bg)]">
                <FilterIcon className="h-3.5 w-3.5 text-[var(--color-muted)]" />
              </span>
              <span className="text-sm font-semibold text-[var(--color-text)]">Filters</span>
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-[var(--color-brand)] px-2 py-0.5 text-[10px] font-bold text-white">
                  {activeFilterCount} active
                </span>
              )}
              <ChevronDownIcon className={`h-4 w-4 text-[var(--color-muted)] transition-transform duration-200 ${panelOpen ? "rotate-180" : ""}`} />
            </button>

            <div className="flex items-center gap-3">
              <span className="text-xs text-[var(--color-muted)]">
                Showing{" "}
                <span className="font-bold text-[var(--color-text)]">{stats.total}</span>
                {" "}of{" "}
                <span className="font-bold text-[var(--color-text)]">{stats.totalAll}</span>
                {" "}zones
              </span>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="flex items-center gap-1.5 rounded-lg bg-[var(--color-brand-light)] px-3 py-1.5 text-xs font-semibold text-[var(--color-brand)] hover:bg-blue-100 transition"
                >
                  <XIcon className="h-3 w-3" />
                  Clear all
                </button>
              )}
            </div>
          </div>

          {panelOpen && (
            <div className="border-t border-[var(--color-border)] px-5 pb-5 pt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <SearchField
                    label="Search"
                    showLabel
                    value={searchQuery}
                    onValueChange={setSearchQuery}
                    placeholder="Search by area or state…"
                    size="sm"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                    State
                  </label>
                  <div className="relative">
                    <select
                      value={filterState}
                      onChange={e => setFilterState(e.target.value)}
                      className="w-full appearance-none rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] py-2.5 pl-3 pr-9 text-sm text-[var(--color-text)] focus:border-[var(--color-brand)] focus:outline-none transition"
                    >
                      <option value="">All States ({availableStates.length})</option>
                      {availableStates.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-muted)]" />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                    City / Area
                  </label>
                  <div className="relative">
                    <select
                      value={filterCity}
                      onChange={e => setFilterCity(e.target.value)}
                      disabled={availableCities.length === 0}
                      className="w-full appearance-none rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] py-2.5 pl-3 pr-9 text-sm text-[var(--color-text)] focus:border-[var(--color-brand)] focus:outline-none transition disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">All Cities ({availableCities.length})</option>
                      {availableCities.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-muted)]" />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                    Status
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {STATUS_OPTIONS.map(opt => {
                      const on = filterStatuses.has(opt.key);
                      return (
                        <button key={opt.key} type="button" onClick={() => toggleStatus(opt.key)}
                          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${
                            on
                              ? "bg-[var(--color-brand)] text-white shadow-sm scale-[1.02]"
                              : "bg-[var(--color-input-bg)] text-[var(--color-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
                          }`}>
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: on ? "rgba(255,255,255,0.8)" : opt.dotHex }}
                          />
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {activeFilterCount > 0 && (
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--color-border)] pt-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                    Active filters:
                  </span>
                  {filterState && (
                    <FilterChip label="State" value={filterState} onRemove={() => setFilterState("")} />
                  )}
                  {filterCity && (
                    <FilterChip label="City" value={filterCity} onRemove={() => setFilterCity("")} />
                  )}
                  {[...filterStatuses].map(s => (
                    <FilterChip key={s} label="Status"
                      value={STATUS_OPTIONS.find(o => o.key === s)?.label ?? s}
                      onRemove={() => toggleStatus(s)} />
                  ))}
                  {searchQuery.trim() && (
                    <FilterChip label="Search" value={`"${searchQuery.trim()}"`}
                      onRemove={() => setSearchQuery("")} />
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Loading / error ───────────────────────────────────────────────── */}
        {/* While loading we used to replace the whole content with a
            spinner — that meant the user saw "nothing happening". Now
            the map mounts immediately with a skeleton (S6-7) and the
            spinner becomes a small overlay chip so the page already
            looks alive. */}
        {fetchError ? (
          <div className="flex min-h-[400px] items-center justify-center">
            <div className={`${card} p-8 text-center max-w-sm w-full`}>
              <AlertTriangleIcon className="h-10 w-10 text-red-400 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">Connection Error</h2>
              <p className="text-sm text-[var(--color-muted)] mb-4">
                Could not load flood data. The server may be starting up.
              </p>
              <button
                type="button" onClick={() => void fetchZones()}
                className="rounded-xl bg-[var(--color-brand)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-brand-dark)] transition"
              >
                Retry Connection
              </button>
            </div>
          </div>
        ) : (

          <div className="flex flex-col gap-5">

            {/* Map card */}
            <article ref={mapCardRef} className={card + " p-5"}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-[var(--color-muted)]">Live View</p>
                    <h2 className="text-lg font-semibold text-[var(--color-text)]">Live map</h2>
                  </div>
                  {/* Viewport rollup pill (P1-12) — summarises the worst
                      status currently in frame so a user can scan
                      whether the area they're looking at is safe. */}
                  {(viewportRollup.critical > 0 || viewportRollup.warning > 0) && (
                    <span
                      className={`hidden sm:inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold ${
                        viewportRollup.critical > 0
                          ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                          : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                      }`}
                      title="Flood status in the area currently on screen"
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: viewportRollup.critical > 0 ? STATUS_HEX[3] : STATUS_HEX[2] }}
                      />
                      In view:
                      {viewportRollup.critical > 0 && (
                        <span><span className="font-bold">{viewportRollup.critical}</span> Critical</span>
                      )}
                      {viewportRollup.critical > 0 && viewportRollup.warning > 0 && (
                        <span aria-hidden>·</span>
                      )}
                      {viewportRollup.warning > 0 && (
                        <span><span className="font-bold">{viewportRollup.warning}</span> Warning</span>
                      )}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm font-semibold text-[var(--color-text)]">
                  <span>Online: <span className="text-green-600">{stats.online}</span></span>
                  <span>Offline: <span className="text-[var(--color-brand)]">{stats.offline}</span></span>
                  {activeFilterCount > 0 && (
                    <span className="text-xs font-medium text-[var(--color-muted)]">
                      ({stats.total} / {stats.totalAll} shown)
                    </span>
                  )}
                  {/* Cheat-sheet shortcut — also bound to `?` */}
                  <button
                    type="button"
                    onClick={() => setShortcutsOpen(true)}
                    title="Keyboard shortcuts (?)"
                    aria-label="Keyboard shortcuts"
                    className="hidden md:inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--color-border)] text-[10px] font-bold text-[var(--color-muted)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] transition"
                  >
                    ?
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--color-border)] overflow-hidden">
                <NodeMap
                  zones={filteredZones}
                  height={620}
                  defaultZoom={11}
                  focusLatLng={focusLatLng}
                  onMapRightClick={(lat, lng) => void handleMapRightClick(lat, lng)}
                  onPlaceSelect={(lat, lng, name) => {
                    focusOnPoint(lat, lng, 14);
                    openPlaceCard({ kind: "place", name, lat, lng });
                  }}
                  onZoneClick={(z) => {
                    focusOnPoint(z.centroidLat, z.centroidLng, 13);
                    openPlaceCard({ kind: "zone", zone: z });
                  }}
                  savedLocations={savedLocationsForMap}
                  myLocation={myLocation}
                  onRecenterRequest={requestGeolocation}
                  onViewportChanged={setViewport}
                  onShareView={handleShareView}
                  onOpenDirections={() => openDirections(null)}
                  routes={activeRoutes}
                  selectedRouteIndex={selectedRouteIndex}
                  isFirstLoad={loading}
                />
              </div>

              {/* Click-to-filter legend (P1-11). Each chip toggles the
                  matching status filter — the same set the Filters panel
                  uses, so the two stay in sync. An active chip is
                  highlighted; tapping again clears it. */}
              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-[var(--color-muted)]">
                <span className="font-semibold text-[var(--color-text)] mr-1">Water Level:</span>
                {STATUS_OPTIONS.filter(o => o.key !== "offline").map(opt => {
                  const count =
                    opt.key === "dry"      ? stats.dry      :
                    opt.key === "normal"   ? stats.normal   :
                    opt.key === "warning"  ? stats.warning  :
                    /* critical */           stats.critical;
                  const on = filterStatuses.has(opt.key);
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => toggleStatus(opt.key)}
                      aria-pressed={on}
                      title={on ? `Click to clear "${opt.label}" filter` : `Filter to ${opt.label} only`}
                      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                        on
                          ? "bg-[var(--color-brand)] text-white"
                          : "bg-[var(--color-input-bg)] text-[var(--color-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
                      }`}
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: on ? "rgba(255,255,255,0.9)" : opt.dotHex }}
                      />
                      {opt.label} ({count})
                    </button>
                  );
                })}
                {filterStatuses.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilterStatuses(new Set())}
                    className="ml-auto rounded-full bg-[var(--color-input-bg)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-brand)] hover:bg-[var(--color-hover)]"
                  >
                    Clear status filter
                  </button>
                )}
              </div>
            </article>

            {/* SavedLocationsPanel — full CRUD list for managing
                saved places (edit radius, delete, etc.). The legacy
                "Zones in Radius" card that lived here has been folded
                into <SavedPlaceStatusRow> above the filters (S6-5);
                this section keeps just the editor list. */}
            {user && (
              <SavedLocationsPanel
                ref={savedLocationsRef}
                onFocusLocation={(lat, lng) => focusOnPoint(lat, lng, 14)}
                onLocationsChange={(locs) => setSavedLocations(locs.map(l => ({
                  id: l.id, label: l.label,
                  latitude: l.latitude, longitude: l.longitude,
                  alertRadiusKm: l.alertRadiusKm,
                })))}
              />
            )}
          </div>
        )}
      </main>

      <Footer />

      {searchOpen && (
        <SearchModal onClose={closeSearch} placeholder="Search posts & communities…" />
      )}

      {/* Keyboard cheat-sheet (P1-13) — opened via the `?` key or the
          floating header button. */}
      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      {/* Place Card (P1-5 + P1-8) — single surface for zone clicks,
          right-click pins, and autocomplete picks. */}
      <PlaceCard
        open={placeCardOpen}
        model={placeCardModel}
        onClose={() => setPlaceCardOpen(false)}
        onDirections={(dest) => {
          setPlaceCardOpen(false);
          openDirections({ destination: dest });
        }}
        onSave={
          placeCardModel?.kind === "place"
            ? () => {
                if (!session) {
                  toast("Sign in to save a place.");
                  return;
                }
                if (placeCardModel?.kind !== "place") return;
                setPlaceCardOpen(false);
                savedLocationsRef.current?.openWithPrefill({
                  latitude: placeCardModel.lat,
                  longitude: placeCardModel.lng,
                  address: placeCardModel.address ?? placeCardModel.name,
                });
              }
            : undefined
        }
        onShare={() => {
          if (!placeCardModel) return;
          const lat = placeCardModel.kind === "place" ? placeCardModel.lat : placeCardModel.zone.centroidLat;
          const lng = placeCardModel.kind === "place" ? placeCardModel.lng : placeCardModel.zone.centroidLng;
          handleShareView({ centerLat: lat, centerLng: lng, zoom: 14 });
        }}
      />

      {/* Directions panel (P1-6) — flood-aware in-app routing. */}
      <DirectionsPanel
        open={directionsOpen}
        request={directionsRequest}
        zones={zones}
        myLocation={myLocation}
        onRoutesChange={(routes, idx) => {
          setActiveRoutes(routes);
          setSelectedRouteIndex(idx);
        }}
        onClose={() => {
          setDirectionsOpen(false);
          setActiveRoutes(null);
        }}
      />
    </div>
  );
}

function FilterChip({ label, value, onRemove }: { label: string; value: string; onRemove: () => void }) {
  return (
    <span className="flex items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] px-2.5 py-1 text-xs font-medium text-[var(--color-text)]">
      <span className="text-[10px] text-[var(--color-muted)]">{label}:</span>
      {value}
      <button type="button" onClick={onRemove}
        className="ml-0.5 text-[var(--color-brand)] hover:opacity-70 transition-opacity">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </span>
  );
}
