"use client";

/**
 * <SavedLocationsPanel /> — list + add + edit + delete the current
 * user's pinned places (Home, Workplace, Parent's House, etc.).
 * Renders inside the right-hand sidebar of the Flood Map page.
 *
 * Each pin has its own alert radius (1–50 km). When any sensor inside
 * a pin's radius hits Alert / Warning / Critical, the user gets an
 * email — that filtering happens server-side in
 * UserRepository.findEmailSubscribersForFloodAt(...).
 */

import { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import toast from "react-hot-toast";
import SavedLocationEditor, { type SavedLocationDraft } from "./SavedLocationEditor";
import KebabMenu from "./ui/KebabMenu";
import type { FloodLevel } from "@/lib/types";
import type { SavedPlaceWithStatus } from "./flood-map/SavedPlaceStatusRow";

// ── Per-place / per-sensor status presentation ──────────────────────────────
// Everything rendered here is the SAME aggregated, privacy-safe data the map
// already shows publicly (zone label = area, rounded centroid, flood level,
// online state) — just filtered to a saved place's radius. No raw sensor id
// or precise coordinates are displayed, and rows only re-centre the map (they
// never open a detail card).
const LEVEL_LABEL: Record<FloodLevel, string> = { 0: "Normal", 1: "Alert", 2: "Warning", 3: "Critical" };
const LEVEL_HEX: Record<FloodLevel, string> = { 0: "#16a34a", 1: "#facc15", 2: "#f97316", 3: "#dc2626" };
const OFFLINE_HEX = "#6b7280";

type PlaceTone = "clear" | "alert" | "warning" | "critical" | "offline" | "empty";

function placeTone(s: SavedPlaceWithStatus | undefined): PlaceTone {
  if (!s || s.items.length === 0) return "empty";
  if (s.allOffline) return "offline";
  if (s.worstLevel === 3) return "critical";
  if (s.worstLevel === 2) return "warning";
  if (s.worstLevel === 1) return "alert";
  return "clear";
}

const TONE_LABEL: Record<PlaceTone, string> = {
  clear: "All clear", alert: "Alert nearby", warning: "Warning nearby",
  critical: "Critical nearby", offline: "Sensors offline", empty: "No sensors",
};

const TONE_PILL: Record<PlaceTone, string> = {
  clear: "bg-emerald-600 text-white", alert: "bg-amber-500 text-white",
  warning: "bg-orange-500 text-white", critical: "bg-red-600 text-white",
  offline: "bg-slate-500 text-white", empty: "bg-slate-400 text-white",
};

/** Imperative handle exposed to the parent flood-map page so a
 *  right-click on the map can prefill + open the editor without going
 *  through prop-drilled state. */
export interface SavedLocationsPanelHandle {
  openWithPrefill: (prefill: Partial<SavedLocationDraft>) => void;
}

export interface SavedLocation {
  id: string;
  label: string;
  address: string | null;
  latitude: number;
  longitude: number;
  alertRadiusKm: number;
  createdAt: string;
  updatedAt: string | null;
}

interface SavedLocationsPanelProps {
  /** When the user clicks an existing pin we focus the map on it. */
  onFocusLocation?: (lat: number, lng: number) => void;
  /** Notifies the parent flood-map so it can render radius circles. */
  onLocationsChange?: (locations: SavedLocation[]) => void;
  /**
   * Per-place live status (sensors within each radius + flood/online state),
   * computed by the parent from the live zone feed. Keyed back to a place by
   * `place.id`. When omitted, only the CRUD list renders.
   */
  placesStatus?: SavedPlaceWithStatus[];
  /** Re-centre the map on a sensor's (rounded) centroid when its row is tapped. */
  onFocusZone?: (lat: number, lng: number) => void;
}

const SavedLocationsPanel = forwardRef<SavedLocationsPanelHandle, SavedLocationsPanelProps>(function SavedLocationsPanel({
  onFocusLocation,
  onLocationsChange,
  placesStatus,
  onFocusZone,
}, ref) {
  // Index the per-place status by place id for O(1) lookup while rendering.
  const statusByPlace = new Map<string, SavedPlaceWithStatus>(
    (placesStatus ?? []).map((s) => [s.place.id, s]),
  );
  // Which place cards have their sensor list expanded.
  const [expandedPlaces, setExpandedPlaces] = useState<Set<string>>(new Set());
  const togglePlace = (id: string) =>
    setExpandedPlaces((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const [locations, setLocations] = useState<SavedLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<SavedLocation | null>(null);
  const [prefill, setPrefill] = useState<Partial<SavedLocationDraft> | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({
    openWithPrefill: (p: Partial<SavedLocationDraft>) => {
      setEditing(null);
      setPrefill(p);
      setEditorOpen(true);
    },
  }), []);

  // Capture the parent's onLocationsChange via a ref so reload() doesn't
  // depend on it. Without this, an inline arrow in the parent caused a
  // new function reference each render → reload() rebuilt → useEffect
  // fired → setSavedLocations re-rendered the parent → loop. (Saved
  // Places "load is not working properly" reported in QA.)
  const onLocationsChangeRef = useRef(onLocationsChange);
  useEffect(() => { onLocationsChangeRef.current = onLocationsChange; }, [onLocationsChange]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/saved-locations", { credentials: "include" });
      if (!res.ok) {
        if (res.status === 401) { setLocations([]); return; }
        throw new Error(`Load failed (${res.status})`);
      }
      const data = (await res.json()) as SavedLocation[];
      setLocations(data);
      onLocationsChangeRef.current?.(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load saved locations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  async function handleSave(draft: SavedLocationDraft) {
    const url = editing ? `/api/saved-locations/${editing.id}` : "/api/saved-locations";
    const method = editing ? "PATCH" : "POST";
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Save failed (${res.status})`);
      }
      toast.success(editing ? "Pin updated" : "Pin saved");
      setEditorOpen(false);
      setEditing(null);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/saved-locations/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok && res.status !== 204) {
        throw new Error(`Delete failed (${res.status})`);
      }
      toast.success("Pin removed");
      setPendingDelete(null);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <article
      className="rounded-3xl border p-4"
      style={{ background: "var(--color-card)", borderColor: "var(--color-border)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-bold" style={{ color: "var(--color-text)" }}>
            My Saved Places
          </h2>
          <p className="text-[11px]" style={{ color: "var(--color-muted)" }}>
            Get alerted for floods within your radius.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setEditing(null); setPrefill(null); setEditorOpen(true); }}
          className="rounded-full px-3 py-1.5 text-xs font-semibold text-white"
          style={{ background: "var(--color-brand)" }}
        >
          + Add
        </button>
      </div>

      {loading ? (
        <p className="text-xs py-4 text-center" style={{ color: "var(--color-muted)" }}>Loading…</p>
      ) : locations.length === 0 ? (
        <div className="rounded-2xl border-dashed border px-4 py-6 text-center"
             style={{ borderColor: "var(--color-border)" }}>
          <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
            No saved places yet.
          </p>
          <p className="text-[11px] mt-1" style={{ color: "var(--color-muted)" }}>
            Pin your home, workplace, or family member&apos;s place — we&apos;ll alert you for floods inside your radius.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {locations.map((loc) => (
            <li
              key={loc.id}
              className="rounded-xl border p-3"
              style={{ background: "var(--color-input-bg, var(--color-card))", borderColor: "var(--color-border)" }}
            >
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onFocusLocation?.(loc.latitude, loc.longitude)}
                  className="flex-1 min-w-0 text-left"
                >
                  <p className="text-sm font-semibold truncate" style={{ color: "var(--color-text)" }}>
                    {loc.label}
                  </p>
                  {loc.address && (
                    <p className="text-[11px] truncate" style={{ color: "var(--color-muted)" }}>
                      {loc.address}
                    </p>
                  )}
                  <span
                    className="inline-block mt-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{
                      background: "rgba(56, 139, 253, 0.12)",
                      color: "var(--color-brand-soft, var(--color-brand))",
                    }}
                  >
                    {loc.alertRadiusKm} km radius
                  </span>
                </button>
                <div className="flex-shrink-0">
                  <KebabMenu
                    triggerLabel={`Actions for ${loc.label}`}
                    items={[
                      {
                        label: "Edit",
                        icon: (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-4 w-4"
                            aria-hidden
                          >
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        ),
                        onSelect: () => {
                          setEditing(loc);
                          setPrefill(null);
                          setEditorOpen(true);
                        },
                      },
                      {
                        label: "Delete",
                        variant: "danger",
                        icon: (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-4 w-4"
                            aria-hidden
                          >
                            <path d="M3 6h18" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        ),
                        onSelect: () => setPendingDelete(loc.id),
                      },
                    ]}
                  />
                </div>
              </div>
              {pendingDelete === loc.id && (
                <div className="mt-2 flex items-center justify-between rounded-lg px-2 py-1.5"
                     style={{ background: "rgba(220, 38, 38, 0.1)" }}>
                  <span className="text-[11px]" style={{ color: "#dc2626" }}>Remove this pin?</span>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setPendingDelete(null)}
                            className="text-[11px]" style={{ color: "var(--color-muted)" }}>
                      Cancel
                    </button>
                    <button type="button" onClick={() => handleDelete(loc.id)}
                            className="text-[11px] font-semibold" style={{ color: "#dc2626" }}>
                      Remove
                    </button>
                  </div>
                </div>
              )}

              {/* Live sensor status within this place's radius — status pill +
                  expandable list of in-range sensors (flood level + online state). */}
              {(() => {
                const s = statusByPlace.get(loc.id);
                const tone = placeTone(s);
                const items = s?.items ?? [];
                const isOpen = expandedPlaces.has(loc.id);
                return (
                  <div className="mt-2 border-t pt-2" style={{ borderColor: "var(--color-border)" }}>
                    <button
                      type="button"
                      onClick={() => { if (items.length > 0) togglePlace(loc.id); }}
                      aria-expanded={isOpen}
                      className="flex w-full items-center justify-between gap-2 text-left"
                      style={{ cursor: items.length > 0 ? "pointer" : "default" }}
                    >
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${TONE_PILL[tone]}`}>
                        {TONE_LABEL[tone]}
                      </span>
                      <span className="flex items-center gap-1 text-[11px]" style={{ color: "var(--color-muted)" }}>
                        {items.length === 0
                          ? `No sensors within ${loc.alertRadiusKm} km`
                          : `${items.length} sensor${items.length === 1 ? "" : "s"} in range`}
                        {items.length > 0 && (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                               stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                               className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden>
                            <path d="M6 9l6 6 6-6" />
                          </svg>
                        )}
                      </span>
                    </button>

                    {isOpen && items.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {items.map(({ z, d }) => {
                          const offline = z.allOffline;
                          return (
                            <li key={z.id}>
                              <button
                                type="button"
                                onClick={() => onFocusZone?.(z.centroidLat, z.centroidLng)}
                                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:opacity-90"
                                style={{ background: "var(--color-input-bg, var(--color-card))" }}
                              >
                                <span className="h-2 w-2 flex-shrink-0 rounded-full"
                                      style={{ backgroundColor: offline ? OFFLINE_HEX : LEVEL_HEX[z.worstLevel] }} aria-hidden />
                                <span className="truncate text-xs font-semibold" style={{ color: "var(--color-text)" }}>
                                  {z.name}
                                </span>
                                <span className="ml-auto flex flex-shrink-0 items-center gap-1.5">
                                  <span className="rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                                        style={offline
                                          ? { background: "rgba(107,114,128,0.18)", color: OFFLINE_HEX }
                                          : { background: `${LEVEL_HEX[z.worstLevel]}26`, color: LEVEL_HEX[z.worstLevel] }}>
                                    {offline ? "—" : LEVEL_LABEL[z.worstLevel]}
                                  </span>
                                  <span className="rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                                        style={offline
                                          ? { background: "rgba(107,114,128,0.18)", color: OFFLINE_HEX }
                                          : { background: "rgba(22,163,74,0.15)", color: "#16a34a" }}>
                                    {offline ? "Offline" : "Online"}
                                  </span>
                                  <span className="text-[10px] tabular-nums" style={{ color: "var(--color-muted)" }}>
                                    {d.toFixed(1)} km
                                  </span>
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })()}
            </li>
          ))}
        </ul>
      )}

      {editorOpen && (
        <SavedLocationEditor
          initial={editing ? {
            label: editing.label,
            address: editing.address ?? "",
            latitude: editing.latitude,
            longitude: editing.longitude,
            alertRadiusKm: editing.alertRadiusKm,
          } : null}
          prefill={prefill}
          onClose={() => { setEditorOpen(false); setEditing(null); setPrefill(null); }}
          onSave={handleSave}
        />
      )}
    </article>
  );
});

export default SavedLocationsPanel;
