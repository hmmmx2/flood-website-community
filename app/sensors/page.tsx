"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getUser, getToken, timeAgo } from "@/lib/auth";
import { authFetch } from "@/lib/authFetch";
import type { AuthUser } from "@/lib/auth";

// ── Types ─────────────────────────────────────────────────────────────────────
type FloodLevel = 0 | 1 | 2 | 3;
type NodeStatus = "active" | "warning" | "inactive";

type SensorNodeDto = {
  id: string;
  nodeId: string;
  name: string;
  area: string;
  location: string;
  state: string;
  latitude: number;
  longitude: number;
  currentLevel: FloodLevel;
  status: NodeStatus;
  distance: string;
  lastUpdated?: string;
};

type FavouriteNodeDto = SensorNodeDto & { favouritedAt: string };

// ── Helpers ───────────────────────────────────────────────────────────────────
const LEVEL_COLOR: Record<FloodLevel, string> = {
  0: "bg-green-100 text-green-700",
  1: "bg-blue-100  text-blue-700",
  2: "bg-orange-100 text-orange-700",
  3: "bg-red-100 text-red-700",
};
const LEVEL_LABEL: Record<FloodLevel, string> = {
  0: "Dry",
  1: "Normal",
  2: "Warning",
  3: "Critical",
};
const LEVEL_DOT: Record<FloodLevel, string> = {
  0: "bg-green-500",
  1: "bg-blue-500",
  2: "bg-orange-500",
  3: "bg-red-500",
};
const WATER_M: Record<FloodLevel, string> = {
  0: "0.0 m",
  1: "1.0 m",
  2: "2.5 m",
  3: "4.0 m",
};

function statusClass(node: SensorNodeDto): string {
  if (node.status === "inactive") return "bg-gray-100 text-gray-500";
  return LEVEL_COLOR[node.currentLevel];
}
function statusLabel(node: SensorNodeDto): string {
  if (node.status === "inactive") return "Offline";
  return LEVEL_LABEL[node.currentLevel];
}
function dotClass(node: SensorNodeDto): string {
  if (node.status === "inactive") return "bg-gray-400";
  return LEVEL_DOT[node.currentLevel];
}

type FilterKey = "all" | "0" | "1" | "2" | "3" | "offline" | "favs";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all",     label: "All" },
  { key: "favs",    label: "⭐ Favourites" },
  { key: "0",       label: "🟢 Dry" },
  { key: "1",       label: "🔵 Normal" },
  { key: "2",       label: "🟠 Warning" },
  { key: "3",       label: "🔴 Critical" },
  { key: "offline", label: "⚫ Offline" },
];

// ── Node Card ─────────────────────────────────────────────────────────────────
function NodeCard({
  node,
  isFav,
  onToggleFav,
  onViewMap,
}: {
  node: SensorNodeDto;
  isFav: boolean;
  onToggleFav: (node: SensorNodeDto) => void;
  onViewMap: (node: SensorNodeDto) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:border-[var(--color-brand)] hover:shadow-sm transition-all">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 truncate">{node.nodeId}</p>
          <p className="text-xs text-gray-500 truncate">{node.area}{node.location ? ` · ${node.location}` : ""}</p>
        </div>
        <button
          onClick={() => onToggleFav(node)}
          title={isFav ? "Remove favourite" : "Add to favourites"}
          className={`flex-shrink-0 p-1.5 rounded-lg transition-colors ${isFav ? "text-[var(--color-brand)] hover:bg-blue-50" : "text-gray-300 hover:text-[var(--color-brand)] hover:bg-blue-50"}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={isFav ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </svg>
        </button>
      </div>

      {/* Status badge + water level */}
      <div className="flex items-center gap-2 mb-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(node)}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${dotClass(node)}`} />
          {statusLabel(node)}
        </span>
        {node.status !== "inactive" && (
          <span className="text-xs text-gray-500 font-medium">{WATER_M[node.currentLevel]}</span>
        )}
      </div>

      {/* Coords + last seen */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400 font-mono">
          {node.latitude.toFixed(4)}, {node.longitude.toFixed(4)}
        </p>
        {node.lastUpdated && (
          <p className="text-xs text-gray-400">{timeAgo(node.lastUpdated)}</p>
        )}
      </div>

      {/* View on map button */}
      <button
        onClick={() => onViewMap(node)}
        className="mt-3 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-[var(--color-brand)]/30 text-xs font-semibold text-[var(--color-brand)] hover:bg-blue-50 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
          <polygon points="3 11 22 2 13 21 11 13 3 11" />
        </svg>
        View on Map
      </button>
    </div>
  );
}

// ── Mini embedded map (using iframe with Google Maps) ─────────────────────────
function NodeMapEmbed({ node, onClose }: { node: SensorNodeDto; onClose: () => void }) {
  const mapUrl = `https://maps.google.com/maps?q=${node.latitude},${node.longitude}&z=15&output=embed`;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900 text-base">{node.nodeId}</h2>
            <p className="text-sm text-gray-500">{node.area}{node.state ? ` · ${node.state}` : ""}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(node)}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${dotClass(node)}`} />
              {statusLabel(node)}
            </span>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Map embed */}
        <div className="relative h-80 bg-gray-100">
          <iframe
            src={mapUrl}
            className="w-full h-full border-0"
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title={`Map of ${node.nodeId}`}
          />
        </div>

        {/* Footer info */}
        <div className="px-5 py-3 bg-gray-50 grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Coordinates</p>
            <p className="text-xs font-mono text-gray-700 mt-0.5">{node.latitude.toFixed(5)}, {node.longitude.toFixed(5)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Water Level</p>
            <p className="text-sm font-bold text-gray-900 mt-0.5">{node.status === "inactive" ? "—" : WATER_M[node.currentLevel]}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Distance</p>
            <p className="text-sm font-bold text-gray-900 mt-0.5">
              {node.distance || '—'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SensorsPage() {
  const [user, setUser]             = useState<AuthUser | null>(null);
  const [nodes, setNodes]           = useState<SensorNodeDto[]>([]);
  const [favIds, setFavIds]         = useState<Set<string>>(new Set());
  const [loading, setLoading]       = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [search, setSearch]         = useState("");
  const [filter, setFilter]         = useState<FilterKey>("all");
  const [mapNode, setMapNode]       = useState<SensorNodeDto | null>(null);
  const [pendingFavs, setPendingFavs] = useState<Set<string>>(new Set());

  useEffect(() => { setUser(getUser()); }, []);

  // ── Fetch sensors
  const fetchSensors = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setFetchError(false);
    try {
      const res = await authFetch("/api/sensors", { signal });
      if (!res.ok) { setFetchError(true); return; }
      const data: SensorNodeDto[] = await res.json();
      setNodes(Array.isArray(data) ? data : []);
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return;
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Fetch favourites
  const fetchFavourites = useCallback(async () => {
    if (!getToken()) return;
    try {
      const res = await authFetch("/api/favourites");
      if (!res.ok) return;
      const data: FavouriteNodeDto[] = await res.json();
      setFavIds(new Set(data.map((f) => f.nodeId)));
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetchSensors(controller.signal);
    void fetchFavourites();
    return () => controller.abort();
  }, [fetchSensors, fetchFavourites]);

  // ── Toggle favourite
  const toggleFav = useCallback(async (node: SensorNodeDto) => {
    if (!getToken()) return;
    if (pendingFavs.has(node.nodeId)) return; // debounce
    setPendingFavs((prev) => new Set([...prev, node.nodeId]));

    const isFav = favIds.has(node.nodeId);
    // Optimistic update
    setFavIds((prev) => {
      const next = new Set(prev);
      if (isFav) next.delete(node.nodeId); else next.add(node.nodeId);
      return next;
    });

    try {
      if (isFav) {
        await authFetch(`/api/favourites/${node.nodeId}`, { method: "DELETE" });
      } else {
        await authFetch("/api/favourites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nodeId: node.nodeId }),
        });
      }
    } catch {
      // Revert on error
      setFavIds((prev) => {
        const next = new Set(prev);
        if (isFav) next.add(node.nodeId); else next.delete(node.nodeId);
        return next;
      });
    } finally {
      setPendingFavs((prev) => { const next = new Set(prev); next.delete(node.nodeId); return next; });
    }
  }, [favIds, pendingFavs]);

  // ── Filtered list
  const filtered = nodes.filter((node) => {
    if (filter === "favs") return favIds.has(node.nodeId);
    if (filter === "offline") return node.status === "inactive";
    if (filter !== "all") {
      const lvl = parseInt(filter, 10) as FloodLevel;
      return node.status !== "inactive" && node.currentLevel === lvl;
    }
    return true;
  }).filter((node) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      node.nodeId.toLowerCase().includes(q) ||
      node.area.toLowerCase().includes(q) ||
      node.state.toLowerCase().includes(q) ||
      (node.location && node.location.toLowerCase().includes(q))
    );
  });

  // ── Stats
  const stats = {
    total:    nodes.length,
    online:   nodes.filter((n) => n.status !== "inactive").length,
    warning:  nodes.filter((n) => n.currentLevel === 2 && n.status !== "inactive").length,
    critical: nodes.filter((n) => n.currentLevel === 3 && n.status !== "inactive").length,
    favs:     favIds.size,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-bold text-[var(--color-brand)] text-lg tracking-tight">FloodWatch</Link>
            <nav className="hidden sm:flex items-center gap-1">
              <Link href="/" className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">Community</Link>
              <Link href="/blog" className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">Blog</Link>
              <span className="px-3 py-1.5 rounded-lg text-sm font-semibold text-[var(--color-brand)] bg-blue-50">Sensors</span>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-[var(--color-brand)] font-bold text-sm">
                  {user.displayName?.charAt(0).toUpperCase() ?? "U"}
                </div>
                <span className="text-sm font-medium text-gray-700 hidden sm:block">{user.displayName}</span>
              </div>
            ) : (
              <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-[var(--color-brand)] transition-colors">Sign in</Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* ── Page header ─────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Flood Sensors</h1>
            <p className="text-sm text-gray-500 mt-1">Real-time monitoring of {stats.total} sensor nodes across Sarawak</p>
          </div>
          <button
            onClick={() => void fetchSensors()}
            className="self-start sm:self-auto flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 16h5v5" />
            </svg>
            Refresh
          </button>
        </div>

        {/* ── Stat pills ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          {[
            { label: "Total",    value: stats.total,    cls: "text-gray-900" },
            { label: "Online",   value: stats.online,   cls: "text-green-600" },
            { label: "Warning",  value: stats.warning,  cls: "text-orange-500" },
            { label: "Critical", value: stats.critical, cls: "text-red-600" },
            { label: "★ Saved",  value: stats.favs,     cls: "text-[var(--color-brand)]" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-3 text-center">
              <p className="text-xs text-gray-400 uppercase tracking-wide">{s.label}</p>
              <p className={`text-xl font-bold mt-0.5 ${s.cls}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* ── Search + filter ─────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400">
              <circle cx="11" cy="11" r="7" /><path d="M16.5 16.5L21 21" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search node ID, area, state…"
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[var(--color-brand)] transition-colors"
            />
          </div>
        </div>

        {/* ── Filter chips ────────────────────────────────────────────── */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-5 scrollbar-hide">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border transition-all ${
                filter === f.key
                  ? "bg-[var(--color-brand)] text-white border-[var(--color-brand)]"
                  : "bg-white text-gray-600 border-gray-200 hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* ── Content ─────────────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
                <div className="h-3 w-32 bg-gray-200 rounded mb-2" />
                <div className="h-3 w-48 bg-gray-100 rounded mb-3" />
                <div className="h-5 w-20 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        ) : fetchError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
            <p className="text-3xl mb-2">⚠️</p>
            <p className="font-semibold text-red-700 mb-1">Could not load sensor data</p>
            <p className="text-sm text-red-600/80 mb-4">The server may be starting up.</p>
            <button
              onClick={() => void fetchSensors()}
              className="px-5 py-2 rounded-lg bg-[var(--color-brand)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-400 mb-3">{filtered.length} nodes</p>
            {filtered.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-4xl mb-3">📡</p>
                <p className="text-gray-500 font-medium">No nodes match your filter.</p>
                <button
                  onClick={() => { setFilter("all"); setSearch(""); }}
                  className="mt-3 text-sm text-[var(--color-brand)] font-medium hover:underline"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((node) => (
                  <NodeCard
                    key={node.id}
                    node={node}
                    isFav={favIds.has(node.nodeId)}
                    onToggleFav={toggleFav}
                    onViewMap={(n) => setMapNode(n)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* ── Map modal ─────────────────────────────────────────────────── */}
      {mapNode && (
        <NodeMapEmbed node={mapNode} onClose={() => setMapNode(null)} />
      )}
    </div>
  );
}
