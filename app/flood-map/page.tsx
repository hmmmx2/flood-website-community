"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Navbar from "@/components/Navbar";
import SearchModal from "@/components/SearchModal";
import { SearchField } from "@/components/ui/search-field";
import NodeMap, { type MapNode, type FloodLevel, getMarkerColor, STATUS_HEX } from "@/components/NodeMap";
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

type FavouriteNodeDto = SensorNodeDto & { favouritedAt: string };

// ── Helpers ───────────────────────────────────────────────────────────────────
const LEVEL_LABEL: Record<FloodLevel, string> = { 0: "Dry", 1: "Normal", 2: "Warning", 3: "Critical" };
const WATER_M: Record<FloodLevel, string>     = { 0: "0.0 m", 1: "1.0 m", 2: "2.5 m", 3: "4.0 m" };
const OFFLINE_HEX = "#6b7280";

function toMapNode(n: SensorNodeDto): MapNode {
  return {
    id:           n.id,
    nodeId:       n.nodeId,
    name:         n.name,
    area:         n.area,
    location:     n.location,
    state:        n.state,
    latitude:     n.latitude,
    longitude:    n.longitude,
    currentLevel: n.currentLevel,
    isOffline:    n.status === "inactive",
    lastUpdated:  n.lastUpdated,
  };
}

function statusDotHex(node: SensorNodeDto): string {
  if (node.status === "inactive") return OFFLINE_HEX;
  return STATUS_HEX[node.currentLevel];
}
function statusText(node: SensorNodeDto) {
  if (node.status === "inactive") return "Offline";
  return LEVEL_LABEL[node.currentLevel];
}
function markerHex(node: SensorNodeDto): string {
  return getMarkerColor(toMapNode(node));
}

function formatTimeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
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
function ActivityIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}
function StarIcon({ filled, ...p }: { filled?: boolean } & React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" {...p}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
    </svg>
  );
}
function MapPinIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
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

  // ── Map focus ──────────────────────────────────────────────────────────────
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const mapCardRef = useRef<HTMLDivElement>(null);

  function focusNode(nodeId: string) {
    setFocusNodeId(null);
    requestAnimationFrame(() => {
      setFocusNodeId(nodeId);
      mapCardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

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

  // Favourites effect — depends on auth state. Use a stable boolean derived
  // from session.user.id (NOT the session object reference itself, which
  // NextAuth replaces on every keepalive poll) to avoid spurious refetches.
  const sessionUserId = session?.user?.id ?? null;
  useEffect(() => {
    if (!sessionUserId) {
      setFavIds(new Set());
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const data = await authFetchJson<FavouriteNodeDto[]>("/api/favourites");
        if (cancelled) return;
        setFavIds(
          new Set(
            data
              .map((f) => f.nodeId)
              .filter((id): id is string => typeof id === "string" && id.length > 0),
          ),
        );
      } catch {
        /* non-critical */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionUserId]);

  // ── Favourite toggle ───────────────────────────────────────────────────────
  const toggleFav = useCallback(
    async (sensorNodeId: string) => {
      if (!session) {
        toast("Please sign in to continue.");
        void signIn(undefined, { callbackUrl: typeof window !== "undefined" ? window.location.href : "/" });
        return;
      }
      if (pendingFavs.has(sensorNodeId)) return;
      setPendingFavs((prev) => new Set([...prev, sensorNodeId]));

      const isFav = favIds.has(sensorNodeId);
      setFavIds((prev) => {
        const next = new Set(prev);
        if (isFav) next.delete(sensorNodeId);
        else next.add(sensorNodeId);
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
          toast.success("Added to favourites");
        }
      } catch (e) {
        setFavIds((prev) => {
          const next = new Set(prev);
          if (isFav) next.add(sensorNodeId);
          else next.delete(sensorNodeId);
          return next;
        });
        toast.error(e instanceof Error ? e.message : "Failed to update favourites.");
      } finally {
        setPendingFavs((prev) => {
          const next = new Set(prev);
          next.delete(sensorNodeId);
          return next;
        });
      }
    },
    [session, favIds, pendingFavs],
  );

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

  // ── Recently updated (top 5) ───────────────────────────────────────────────
  const recentlyUpdated = useMemo(() =>
    [...nodes]
      .filter(n => n.lastUpdated)
      .sort((a, b) => new Date(b.lastUpdated!).getTime() - new Date(a.lastUpdated!).getTime())
      .slice(0, 5),
    [nodes],
  );

  const recentlyUpdatedIds = useMemo(
    () => new Set(recentlyUpdated.map(n => n.id)),
    [recentlyUpdated],
  );

  // ── Map nodes — always include favourite nodes so clicking a fav always works
  const mapNodes = useMemo(() => {
    const filteredIds = new Set(filteredNodes.map(n => n.id));
    const favExtras = nodes.filter(n => favIds.has(n.nodeId) && !filteredIds.has(n.id));
    return [...filteredNodes, ...favExtras].map(toMapNode);
  }, [filteredNodes, nodes, favIds]);

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
    favs:     favIds.size,
  }), [filteredNodes, nodes, favIds]);

  // Show ALL favourites in sidebar regardless of active filters
  const favouriteNodes = useMemo(
    () => nodes.filter(n => favIds.has(n.nodeId)),
    [nodes, favIds],
  );

  // Track which favourites are currently hidden by filters (to show a badge)
  const filteredNodeIds = useMemo(
    () => new Set(filteredNodes.map(n => n.id)),
    [filteredNodes],
  );

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

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-5">

        {/* ── Page header ──────────────────────────────────────────────────── */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text)]">Flood Map</h1>
            <p className="text-sm text-[var(--color-muted)] mt-0.5">
              Real-time IoT water levels across Sabah. Click any marker for details, or filter by district, area, or severity.
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

          /* ── Main content grid ──────────────────────────────────────────── */
          <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,1.1fr)]">

            {/* ── Left column ──────────────────────────────────────────────── */}
            <div className="flex flex-col gap-5">

              {/* Map card */}
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

                {/* Recently updated chips */}
                {recentlyUpdated.length > 0 && (
                  <div className="mb-4">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                      Recently Updated
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {recentlyUpdated.map((node, i) => {
                        // Render the human-readable location (area falls back to
                        // location, then to "Sensor"), NOT the technical nodeId.
                        // Residents shouldn't have to interact with hardware IDs.
                        const placeLabel = node.area || node.location || "Sensor";
                        return (
                        <button key={node.id} type="button" onClick={() => focusNode(node.id)}
                          title={`Jump to ${placeLabel}${node.location && node.location !== placeLabel ? ` · ${node.location}` : ""}`}
                          className="group flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-1.5 text-xs font-medium text-[var(--color-text)] transition-all hover:border-amber-400 hover:bg-amber-50"
                        >
                          <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold ${
                            i === 0 ? "bg-amber-400 text-white" : "bg-[var(--color-border)] text-[var(--color-muted)]"
                          }`}>
                            {i + 1}
                          </span>
                          <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ backgroundColor: statusDotHex(node) }} />
                          <span>{placeLabel}</span>
                          {node.lastUpdated && (
                            <span className="text-[10px] text-[var(--color-muted)]">
                              {formatTimeAgo(node.lastUpdated)}
                            </span>
                          )}
                        </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Google Map */}
                <div className="rounded-2xl border border-[var(--color-border)] overflow-hidden">
                  <NodeMap
                    nodes={mapNodes}
                    height={460}
                    zoom={10}
                    focusNodeId={focusNodeId}
                    highlightedIds={recentlyUpdatedIds}
                    favouriteIds={favIds}
                    onToggleFavourite={toggleFav}
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

              {/* The full "All Sensor Nodes" grid that sat under the map
                  has been removed. The map is now the single interface
                  for sensor lookup; users click markers directly to read
                  individual nodes, and "Recently updated" + Favourites
                  cover the at-a-glance use cases. Any node we still want
                  to surface (recently updated, favourited) is visible
                  above the map or in the right-hand panel. */}
            </div>

            {/* ── Right sidebar ─────────────────────────────────────────────── */}
            <aside className="flex flex-col gap-5">

              {/* Live monitoring */}
              <div
                className="rounded-2xl p-4 text-white shadow-lg ring-1 ring-white/10"
                style={{
                  background: "var(--gradient-hero)",
                  boxShadow: "0 10px 30px -12px var(--color-brand-glow), 0 0 0 1px rgba(255,255,255,0.06) inset",
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <ActivityIcon className="h-5 w-5" />
                  <h3 className="font-bold text-sm">Live Monitoring</h3>
                </div>
                <p className="text-sm text-white/85 mb-4">
                  Tracking {stats.totalAll} sensor nodes across Sabah in real-time.
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-white/80">Online</span>
                    <span className="font-bold">{stats.online}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/80">Warning</span>
                    <span className="font-bold text-amber-300">{stats.warning}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/80">Critical</span>
                    <span className="font-bold text-red-300">{stats.critical}</span>
                  </div>
                  {user && (
                    <div className="flex items-center justify-between">
                      <span className="text-white/80">Saved</span>
                      <span className="font-bold">{stats.favs}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Favourites */}
              <div className={card + " p-4"}>
                <div className="mb-3 flex items-center gap-2">
                  <StarIcon filled className="h-4 w-4 text-amber-400" />
                  <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--color-text)]">
                    Favourites
                  </h3>
                  {favouriteNodes.length > 0 && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-600">
                      {favouriteNodes.length}
                    </span>
                  )}
                </div>
                {favouriteNodes.length > 0 && (
                  <p className="mb-3 text-[10px] text-[var(--color-muted)]">
                    Click any saved node to navigate the map to its location.
                  </p>
                )}

                {favouriteNodes.length === 0 ? (
                  <div className="flex flex-col items-center gap-1.5 rounded-2xl bg-[var(--color-input-bg)] py-6">
                    <StarIcon className="h-7 w-7 text-[var(--color-border)]" />
                    <p className="px-4 text-center text-xs leading-relaxed text-[var(--color-muted)]">
                      Click the star on any node to pin it here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {favouriteNodes.map(node => {
                      const isFiltered = !filteredNodeIds.has(node.id);
                      return (
                        <div
                          key={node.id}
                          className="group flex cursor-pointer items-center gap-2 rounded-xl bg-[var(--color-input-bg)] px-3 py-2.5 transition-colors hover:bg-amber-50 hover:border-amber-200 border border-transparent"
                          onClick={() => focusNode(node.id)}
                          title="Click to navigate to this node on the map"
                        >
                          <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                            style={{ backgroundColor: markerHex(node) }} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              {/* Show the human-readable place name (area / location)
                                  instead of the technical nodeId so residents see
                                  "Petra Jaya" not "102503180". toggleFav() still
                                  uses node.nodeId under the hood. */}
                              <p className="truncate text-xs font-semibold text-[var(--color-text)] group-hover:text-[var(--color-brand)] transition-colors">
                                {node.area || node.location || "Saved sensor"}
                              </p>
                              {isFiltered && (
                                <span className="flex-shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-400 border border-slate-200">
                                  filtered
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-[var(--color-muted)]">
                              {statusText(node)} · {node.status === "inactive" ? "—" : WATER_M[node.currentLevel]}
                            </p>
                            {node.location && node.area && node.location !== node.area && (
                              <p className="mt-0.5 truncate text-[9px] text-[var(--color-muted)]/70">
                                {node.location}
                              </p>
                            )}
                          </div>
                          <MapPinIcon className="h-3.5 w-3.5 flex-shrink-0 text-[var(--color-brand)] opacity-0 group-hover:opacity-70 transition-opacity" />
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); void toggleFav(node.nodeId); }}
                            className="flex-shrink-0 text-amber-400 hover:text-amber-500 transition-colors"
                            title="Remove from favourites"
                          >
                            <StarIcon filled className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Status legend */}
              <div className={card + " p-4"}>
                <h3 className="text-base font-semibold text-[var(--color-text)]">Status Legend</h3>
                <p className="text-xs text-[var(--color-muted)] mt-0.5 mb-4">
                  Sabah flood SOP water levels.
                </p>
                <ul className="space-y-3">
                  {[
                    { hex: STATUS_HEX[0],  label: "Dry",      desc: "No flood risk",          lvl: 0 },
                    { hex: STATUS_HEX[1],  label: "Normal",   desc: "Safe water level",        lvl: 1 },
                    { hex: STATUS_HEX[2],  label: "Warning",  desc: "Monitor closely",         lvl: 2 },
                    { hex: STATUS_HEX[3],  label: "Critical", desc: "Severe flood risk",       lvl: 3 },
                    { hex: OFFLINE_HEX,    label: "Offline",  desc: "Sensor not reporting",    lvl: null },
                  ].map(({ hex, label, desc, lvl }) => (
                    <li
                      key={label}
                      className="flex items-center justify-between rounded-2xl border border-[var(--color-border)] px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="flex h-9 w-9 items-center justify-center rounded-full text-white text-sm font-semibold"
                          style={{ backgroundColor: hex }}
                        >
                          {lvl ?? "—"}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-[var(--color-text)]">{label}</p>
                          <p className="text-xs text-[var(--color-muted)]">{desc}</p>
                        </div>
                      </div>
                      {lvl !== null && (
                        <span className="text-sm font-semibold text-[var(--color-brand)]">
                          LVL {lvl}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                <div className="mt-4 rounded-2xl bg-[var(--color-input-bg)] px-4 py-3 text-xs text-[var(--color-muted)]">
                  <p className="font-semibold uppercase tracking-wide text-[var(--color-text)]">Map Info</p>
                  <p>Total: {stats.totalAll} · Visible: {stats.total} · Online: {stats.online} · Offline: {stats.offline}</p>
                  <p className="mt-0.5">Live · Server-Sent Events (SSE).</p>
                </div>
              </div>
            </aside>
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
