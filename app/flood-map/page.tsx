"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Navbar from "@/components/Navbar";
import SearchModal from "@/components/SearchModal";
import { SearchField } from "@/components/ui/search-field";
import NodeMap, { type MapNode, type FloodLevel, STATUS_HEX } from "@/components/NodeMap";
import SavedLocationsPanel, { type SavedLocationsPanelHandle } from "@/components/SavedLocationsPanel";
import toast from "react-hot-toast";
import { useSession, signOut, signIn } from "next-auth/react";
import { sessionToAuthUser } from "@/lib/auth";
import { fetchJson, authFetchJson } from "@/lib/fetchJson";
import { useSiteSearchModal } from "@/lib/useSiteSearchModal";
import { useSensorStream } from "@/components/providers/SensorStreamProvider";

// ── Types ─────────────────────────────────────────────────────────────────────
type NodeStatus = "active" | "warning" | "critical" | "inactive";

type SensorNodeDto = {
  id: string;
  nodeId: string;
  name?: string;
  area: string;
  location: string;
  state: string;
  /** Reverse-geocoded full address line. Populated by Phase 2's
   *  GeocodeBackfillRunner; null on pre-backfill rows. */
  address?: string | null;
  latitude: number;
  longitude: number;
  currentLevel: FloodLevel;
  status: NodeStatus;
  distance: string;
  lastUpdated?: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const LEVEL_LABEL: Record<FloodLevel, string> = { 0: "Dry", 1: "Normal", 2: "Warning", 3: "Critical" };
const OFFLINE_HEX = "#6b7280";

type FavouriteNodeDto = SensorNodeDto & { favouritedAt?: string };

function toMapNode(n: SensorNodeDto): MapNode {
  return {
    id:           n.id,
    nodeId:       n.nodeId,
    name:         n.name,
    area:         n.area,
    location:     n.location,
    state:        n.state,
    address:      n.address,
    latitude:     n.latitude,
    longitude:    n.longitude,
    currentLevel: n.currentLevel,
    isOffline:    n.status === "inactive",
    lastUpdated:  n.lastUpdated,
  };
}

// Haversine distance in km — used to determine which sensors fall
// inside each saved-place radius for the "Nodes in Radius" panel.
function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat), lat2 = toRad(bLat);
  const a = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

function nodeStatusLabel(n: SensorNodeDto): string {
  if (n.status === "inactive") return "Offline";
  return LEVEL_LABEL[n.currentLevel];
}
function nodeStatusHex(n: SensorNodeDto): string {
  if (n.status === "inactive") return "#6b7280";
  return STATUS_HEX[n.currentLevel];
}

// ── Status filter keys ────────────────────────────────────────────────────────
type StatusKey = "dry" | "normal" | "warning" | "critical" | "offline";

const STATUS_OPTIONS: { key: StatusKey; label: string; dotHex: string }[] = [
  { key: "dry",      label: "Dry",      dotHex: STATUS_HEX[0] },
  { key: "normal",   label: "Normal",   dotHex: STATUS_HEX[1] },
  { key: "warning",  label: "Warning",  dotHex: STATUS_HEX[2] },
  { key: "critical", label: "Critical", dotHex: STATUS_HEX[3] },
  { key: "offline",  label: "Offline",  dotHex: OFFLINE_HEX   },
];

function nodeStatusKey(node: SensorNodeDto): StatusKey {
  if (node.status === "inactive") return "offline";
  if (node.currentLevel === 0)    return "dry";
  if (node.currentLevel === 1)    return "normal";
  if (node.currentLevel === 2)    return "warning";
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
function StarIcon({ filled, ...p }: { filled?: boolean } & React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
         fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" {...p}>
      <path strokeLinecap="round" strokeLinejoin="round"
            d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
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

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function FloodMapPage() {
  const { subscribeSensorUpdates } = useSensorStream();
  const { data: session } = useSession();
  const user = session?.user ? sessionToAuthUser(session.user) : null;
  const { searchOpen, openSearch, closeSearch } = useSiteSearchModal();
  const [nodes, setNodes]             = useState<SensorNodeDto[]>([]);
  const [favIds, setFavIds]           = useState<Set<string>>(new Set());
  const [pendingFavs, setPendingFavs] = useState<Set<string>>(new Set());
  const [loading, setLoading]         = useState(true);
  const [fetchError, setFetchError]   = useState(false);
  const [lastFetch, setLastFetch]     = useState<Date | null>(null);
  const isFirstFetch                  = useRef(true);

  // ── Filters ────────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery]     = useState("");
  const [filterState, setFilterState]     = useState("");
  const [filterCity, setFilterCity]       = useState("");
  const [filterStatuses, setFilterStatuses] = useState<Set<StatusKey>>(new Set());
  const [panelOpen, setPanelOpen]         = useState(true);

  // ── Map focus (zone-level only — never per-sensor) ────────────────────────
  const [focusLatLng, setFocusLatLng] =
    useState<{ lat: number; lng: number; zoom?: number } | null>(null);
  const [myLocation, setMyLocation] =
    useState<{ lat: number; lng: number; accuracyM?: number } | null>(null);
  const mapCardRef = useRef<HTMLDivElement>(null);
  const savedLocationsRef = useRef<SavedLocationsPanelHandle | null>(null);

  // Auto-centre the map on the user's current position the first time
  // they land here (login / register / refresh — by virtue of being a
  // mount-only effect). Browser auto-prompts for permission. We never
  // poll — just one read at mount. If the user denies or the browser
  // doesn't expose the API, we silently skip; the map stays centred on
  // the default Sabah viewport.
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracyM = pos.coords.accuracy;
        setMyLocation({ lat, lng, accuracyM });
        setFocusLatLng({ lat, lng, zoom: 13 });
      },
      () => { /* user denied or geolocation failed — silently skip */ },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
    return () => { cancelled = true; };
  }, []);

  // ── Saved locations (Phase 4) — sourced from SavedLocationsPanel via its
  //    onLocationsChange callback so the map can render the radius circles.
  const [savedLocations, setSavedLocations] = useState<{
    id: string; label: string; latitude: number; longitude: number; alertRadiusKm: number;
  }[]>([]);

  function focusOnPoint(lat: number, lng: number, zoom = 13) {
    setFocusLatLng({ lat, lng, zoom });
    mapCardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // Right-click on the map: reverse-geocode for a friendly label, then
  // open the saved-place editor with the coords + address prefilled.
  // The Geocoder lives in the same google.maps namespace as the Autocomplete
  // (loaded by the ZoneMap), so it's available client-side once the map mounts.
  const handleMapRightClick = useCallback(async (lat: number, lng: number) => {
    if (!session) {
      toast("Sign in to save a place.");
      return;
    }
    let address = "";
    try {
      if (typeof google !== "undefined" && google.maps?.Geocoder) {
        const geocoder = new google.maps.Geocoder();
        const res = await geocoder.geocode({ location: { lat, lng } });
        address = res.results[0]?.formatted_address ?? "";
      }
    } catch { /* reverse geocode is best-effort */ }
    savedLocationsRef.current?.openWithPrefill({
      latitude: lat,
      longitude: lng,
      address,
    });
  }, [session]);

  // ── Data fetching ──────────────────────────────────────────────────────────
  // Track an in-flight sensor fetch so concurrent triggers (manual refresh
  // while initial load is still pending, etc.) cancel the older one cleanly
  // and leave only the latest result in state.
  const inFlightSensorAbort = useRef<AbortController | null>(null);

  const fetchSensors = useCallback(async () => {
    // Abort any earlier sensor request — only the newest call wins
    inFlightSensorAbort.current?.abort();
    const controller = new AbortController();
    inFlightSensorAbort.current = controller;

    if (isFirstFetch.current) setLoading(true);
    setFetchError(false);
    try {
      const data = await fetchJson<SensorNodeDto[]>("/api/sensors", { signal: controller.signal });
      // Guard: if a newer fetch superseded us, don't write stale data
      if (inFlightSensorAbort.current !== controller) return;
      setNodes(Array.isArray(data) ? data : []);
      setLastFetch(new Date());
      isFirstFetch.current = false;
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return;
      if (inFlightSensorAbort.current !== controller) return;
      setFetchError(true);
    } finally {
      if (inFlightSensorAbort.current === controller) {
        inFlightSensorAbort.current = null;
        setLoading(false);
      }
    }
  }, []);

  // Sensor effect — runs ONCE on mount. Doesn't depend on session, so the
  // NextAuth poll (every 5 min + on window-focus) can no longer retrigger
  // a full /api/sensors refetch and stomp on in-flight data.
  useEffect(() => {
    void fetchSensors();

    const unsub = subscribeSensorUpdates((raw) => {
      try {
        const updated = raw as unknown as SensorNodeDto;
        setNodes(prev => {
          const idx = prev.findIndex(n => n.id === updated.id);
          if (idx === -1) return [...prev, updated];
          const next = [...prev];
          next[idx] = updated;
          return next;
        });
        setLastFetch(new Date());
        isFirstFetch.current = false;
      } catch {
        /* malformed payload — ignore */
      }
    });

    return () => {
      inFlightSensorAbort.current?.abort();
      inFlightSensorAbort.current = null;
      unsub();
    };
    // fetchSensors / subscribeSensorUpdates are both stable (empty-dep useCallback)
  }, [fetchSensors, subscribeSensorUpdates]);

  // ── Favourites — per-node "notify me about this sensor" ───────────────────
  // The Nodes-in-Radius card has a star button on each row; starring a node
  // also makes the multichannel dispatcher pick this user up regardless of
  // saved-location radius (see UserRepository.findNotificationSubscribersForFloodAt).
  const sessionUserId = session?.user?.id ?? null;
  useEffect(() => {
    if (!sessionUserId) { setFavIds(new Set()); return; }
    let cancelled = false;
    void (async () => {
      try {
        const data = await authFetchJson<FavouriteNodeDto[]>("/api/favourites");
        if (cancelled) return;
        setFavIds(new Set(
          data.map((f) => f.nodeId).filter((id): id is string => typeof id === "string" && id.length > 0)
        ));
      } catch { /* non-critical */ }
    })();
    return () => { cancelled = true; };
  }, [sessionUserId]);

  const toggleFav = useCallback(async (sensorNodeId: string) => {
    if (!session) {
      toast("Please sign in to continue.");
      void signIn(undefined, { callbackUrl: typeof window !== "undefined" ? window.location.href : "/" });
      return;
    }
    if (pendingFavs.has(sensorNodeId)) return;
    setPendingFavs(prev => new Set([...prev, sensorNodeId]));

    const isFav = favIds.has(sensorNodeId);
    setFavIds(prev => {
      const next = new Set(prev);
      if (isFav) next.delete(sensorNodeId); else next.add(sensorNodeId);
      return next;
    });
    try {
      if (isFav) {
        await authFetchJson(`/api/favourites/${sensorNodeId}`, { method: "DELETE" });
        toast.success("Removed from favourites");
      } else {
        await authFetchJson("/api/favourites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nodeId: sensorNodeId }),
        });
        toast.success("You'll be notified when this sensor reports an alert");
      }
    } catch (e) {
      // Roll the optimistic update back on failure.
      setFavIds(prev => {
        const next = new Set(prev);
        if (isFav) next.add(sensorNodeId); else next.delete(sensorNodeId);
        return next;
      });
      toast.error(e instanceof Error ? e.message : "Could not update favourites.");
    } finally {
      setPendingFavs(prev => {
        const next = new Set(prev);
        next.delete(sensorNodeId);
        return next;
      });
    }
  }, [session, favIds, pendingFavs]);

  // ── Derived: dropdown options ──────────────────────────────────────────────
  const availableStates = useMemo(() => {
    const s = new Set<string>();
    nodes.forEach(n => { if (n.state) s.add(n.state); });
    return [...s].sort();
  }, [nodes]);

  const availableCities = useMemo(() => {
    const src = filterState ? nodes.filter(n => n.state === filterState) : nodes;
    const c = new Set<string>();
    src.forEach(n => { if (n.area) c.add(n.area); });
    return [...c].sort();
  }, [nodes, filterState]);

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

  // ── Filtered nodes ─────────────────────────────────────────────────────────
  const filteredNodes = useMemo(() => {
    let r = nodes;
    if (filterState) r = r.filter(n => n.state === filterState);
    if (filterCity)  r = r.filter(n => n.area  === filterCity);
    if (filterStatuses.size > 0) r = r.filter(n => filterStatuses.has(nodeStatusKey(n)));
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      // Search excludes nodeId — residents shouldn't have to interact with
      // technical hardware IDs. Match against location, area, state, and
      // (when geocoding lands) the resolved address.
      r = r.filter(n =>
        (n.name     ?? "").toLowerCase().includes(q) ||
        (n.location ?? "").toLowerCase().includes(q) ||
        (n.area     ?? "").toLowerCase().includes(q) ||
        (n.state    ?? "").toLowerCase().includes(q),
      );
    }
    return r;
  }, [nodes, filterState, filterCity, filterStatuses, searchQuery]);

  // ── Per-node mapping ──────────────────────────────────────────────────────
  const mapNodes: MapNode[] = useMemo(
    () => filteredNodes.map(toMapNode),
    [filteredNodes],
  );

  // For each saved place, compute the list of sensors inside its radius —
  // sorted by distance. Respects all active filters (state, area, status,
  // search) so the panel stays in sync with the rest of the map.
  const nodesByPlace = useMemo(() => {
    if (savedLocations.length === 0) return [];
    return savedLocations.map(place => {
      const matched = filteredNodes
        .map(n => ({ n, d: haversineKm(place.latitude, place.longitude, n.latitude, n.longitude) }))
        .filter(({ d }) => d <= place.alertRadiusKm)
        .sort((a, b) => a.d - b.d);
      return { place, items: matched };
    });
  }, [savedLocations, filteredNodes]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:    filteredNodes.length,
    totalAll: nodes.length,
    online:   filteredNodes.filter(n => n.status !== "inactive").length,
    offline:  filteredNodes.filter(n => n.status === "inactive").length,
    dry:      filteredNodes.filter(n => n.status !== "inactive" && n.currentLevel === 0).length,
    normal:   filteredNodes.filter(n => n.status !== "inactive" && n.currentLevel === 1).length,
    warning:  filteredNodes.filter(n => n.status !== "inactive" && n.currentLevel === 2).length,
    critical: filteredNodes.filter(n => n.status !== "inactive" && n.currentLevel === 3).length,
  }), [filteredNodes, nodes]);

  // ── Shared card class ──────────────────────────────────────────────────────
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

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-5">

        {/* ── Page header ──────────────────────────────────────────────────── */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text)]">Flood Map</h1>
            <p className="text-sm text-[var(--color-muted)] mt-0.5">
              Real-time water-level sensors across Sabah, coloured by status.
              Search for a place, or <strong className="text-[var(--color-text)]">right-click anywhere on the map</strong> to save it as a place and get email alerts.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lastFetch && (
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs text-[var(--color-muted)]">
                  Live · Updated {lastFetch.toLocaleTimeString()}
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={() => void fetchSensors()}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] transition"
              title="Refresh"
            >
              <RefreshIcon className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* The four KPI summary cards (Total / Online / Warning / Critical)
            previously lived here. They were redundant with the right-side
            "Live Monitoring" card on the same page, so they've been removed
            to declutter the UI. The map is the single source of truth now. */}

        {/* ── Filter panel ─────────────────────────────────────────────────── */}
        <div className={card}>
          {/* Panel header */}
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
                {" "}nodes
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

          {/* Collapsible body */}
          {panelOpen && (
            <div className="border-t border-[var(--color-border)] px-5 pb-5 pt-4">
              <div className="grid gap-4 sm:grid-cols-2">

                {/* Search */}
                <div>
                  <SearchField
                    label="Search"
                    showLabel
                    value={searchQuery}
                    onValueChange={setSearchQuery}
                    placeholder="Search by area, district, or river…"
                    size="sm"
                  />
                </div>

                {/* State */}
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

                {/* City / Area */}
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

                {/* Status chips */}
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

              {/* Active filter chips */}
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
        {loading ? (
          <div className="flex min-h-[400px] items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-[var(--color-border)] border-t-[var(--color-brand)]" />
              <p className="text-sm font-medium text-[var(--color-muted)]">Loading sensor data…</p>
            </div>
          </div>
        ) : fetchError ? (
          <div className="flex min-h-[400px] items-center justify-center">
            <div className={`${card} p-8 text-center max-w-sm w-full`}>
              <AlertTriangleIcon className="h-10 w-10 text-red-400 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">Connection Error</h2>
              <p className="text-sm text-[var(--color-muted)] mb-4">
                Could not load sensor data. The server may be starting up.
              </p>
              <button
                type="button" onClick={() => void fetchSensors()}
                className="rounded-xl bg-[var(--color-brand)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-brand-dark)] transition"
              >
                Retry Connection
              </button>
            </div>
          </div>
        ) : (

          /* ── Main content stack ─────────────────────────────────────────── */
          <div className="flex flex-col gap-5">

            {/* Map card — now full width */}
            <article ref={mapCardRef} className={card + " p-5"}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-[var(--color-muted)]">Live View</p>
                  <h2 className="text-lg font-semibold text-[var(--color-text)]">Live map</h2>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm font-semibold text-[var(--color-text)]">
                  <span>Online: <span className="text-green-600">{stats.online}</span></span>
                  <span>Offline: <span className="text-[var(--color-brand)]">{stats.offline}</span></span>
                  {activeFilterCount > 0 && (
                    <span className="text-xs font-medium text-[var(--color-muted)]">
                      ({stats.total} / {stats.totalAll} shown)
                    </span>
                  )}
                </div>
              </div>

              {/* Per-node circle map */}
              <div className="rounded-2xl border border-[var(--color-border)] overflow-hidden">
                <NodeMap
                  nodes={mapNodes}
                  height={620}
                  defaultZoom={11}
                  focusLatLng={focusLatLng}
                  onMapRightClick={(lat, lng) => void handleMapRightClick(lat, lng)}
                  onPlaceSelect={(lat, lng) => focusOnPoint(lat, lng, 14)}
                  savedLocations={savedLocations}
                  myLocation={myLocation}
                />
              </div>

              {/* Water level legend */}
              <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-[var(--color-muted)]">
                <span className="font-semibold text-[var(--color-text)]">Water Level:</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_HEX[0] }} /> Dry ({stats.dry})</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_HEX[1] }} /> Normal ({stats.normal})</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_HEX[2] }} /> Warning ({stats.warning})</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_HEX[3] }} /> Critical ({stats.critical})</span>
              </div>
            </article>

            {/* ── Below-map stack: My Saved Places on top, Nodes in Radius below ── */}
            {user && (
              <div className="flex flex-col gap-5">

                {/* My Saved Places — sits at the top so users see what they
                    have saved before scanning the per-place sensor lists. */}
                <SavedLocationsPanel
                  ref={savedLocationsRef}
                  onFocusLocation={(lat, lng) => focusOnPoint(lat, lng, 14)}
                  onLocationsChange={(locs) => setSavedLocations(locs.map(l => ({
                    id: l.id, label: l.label,
                    latitude: l.latitude, longitude: l.longitude,
                    alertRadiusKm: l.alertRadiusKm,
                  })))}
                />

                {/* Nodes in Radius — for each saved place, lists sensors
                    inside its alert radius, sorted by distance. */}
                {nodesByPlace.length > 0 && (
                  <div className={card + " p-4"}>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--color-text)]">
                          Nodes in Radius
                        </h3>
                        <p className="text-[11px] text-[var(--color-muted)] mt-0.5">
                          Sensors inside each of your saved places{activeFilterCount > 0 ? " (filtered)" : ""}.
                        </p>
                      </div>
                      {activeFilterCount > 0 && (
                        <button
                          type="button"
                          onClick={clearAllFilters}
                          className="rounded-full bg-[var(--color-input-bg)] px-3 py-1 text-[11px] font-semibold text-[var(--color-brand)] hover:bg-[var(--color-hover)]"
                        >
                          Clear filters
                        </button>
                      )}
                    </div>

                    <div className="space-y-4">
                      {nodesByPlace.map(({ place, items }) => (
                        <div
                          key={place.id}
                          className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-input-bg)] p-3"
                        >
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text)] truncate min-w-0">
                              <MapPinIcon className="h-3.5 w-3.5 flex-shrink-0 text-[var(--color-brand)]" />
                              <span className="truncate">{place.label}</span>
                            </p>
                            <span className="rounded-full bg-[var(--color-card)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-muted)] border border-[var(--color-border)]">
                              {items.length} · {place.alertRadiusKm} km
                            </span>
                          </div>
                          {items.length === 0 ? (
                            <p className="rounded-lg bg-[var(--color-card)] px-3 py-2 text-[11px] text-[var(--color-muted)]">
                              No sensors within the radius{activeFilterCount > 0 ? " match the active filters" : ""}.
                            </p>
                          ) : (
                            <ul
                              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-2 max-h-[280px] overflow-y-auto pr-1"
                              style={{ scrollbarWidth: "thin" }}
                            >
                              {items.map(({ n, d }) => {
                                const isFav = favIds.has(n.nodeId);
                                const isPending = pendingFavs.has(n.nodeId);
                                return (
                                  <li
                                    key={n.id}
                                    className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-2.5 transition-colors hover:border-[var(--color-brand)]"
                                  >
                                    <div className="flex items-start justify-between gap-1.5 mb-1.5">
                                      <span
                                        className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full"
                                        style={{ backgroundColor: nodeStatusHex(n) }}
                                        aria-hidden
                                      />
                                      <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); void toggleFav(n.nodeId); }}
                                        disabled={isPending}
                                        title={isFav
                                          ? "Stop notifications for this sensor"
                                          : "Notify me when this sensor reports an alert"}
                                        aria-label={isFav ? "Unstar sensor" : "Star sensor for notifications"}
                                        aria-pressed={isFav}
                                        className="flex-shrink-0 -mt-0.5 -mr-1 p-1 rounded transition disabled:opacity-50"
                                      >
                                        <StarIcon
                                          filled={isFav}
                                          className={`h-4 w-4 transition-colors ${
                                            isFav
                                              ? "text-amber-400"
                                              : "text-[var(--color-muted)] hover:text-amber-400"
                                          }`}
                                        />
                                      </button>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => focusOnPoint(n.latitude, n.longitude, 14)}
                                      className="block w-full text-left"
                                    >
                                      <p className="truncate text-xs font-semibold text-[var(--color-text)]">
                                        {n.area || n.location || "Sensor"}
                                      </p>
                                      <p className="truncate text-[10px] text-[var(--color-muted)] mt-0.5">
                                        {nodeStatusLabel(n)} · {d.toFixed(1)} km
                                      </p>
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {searchOpen && (
        <SearchModal onClose={closeSearch} placeholder="Search posts & communities…" />
      )}
    </div>
  );
}

// ── FilterChip sub-component ──────────────────────────────────────────────────
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
