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
}

const SavedLocationsPanel = forwardRef<SavedLocationsPanelHandle, SavedLocationsPanelProps>(function SavedLocationsPanel({
  onFocusLocation,
  onLocationsChange,
}, ref) {
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
                <div className="flex flex-col gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => { setEditing(loc); setPrefill(null); setEditorOpen(true); }}
                    aria-label={`Edit ${loc.label}`}
                    className="text-[11px] underline-offset-2 hover:underline"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(loc.id)}
                    aria-label={`Delete ${loc.label}`}
                    className="text-[11px] underline-offset-2 hover:underline"
                    style={{ color: "#dc2626" }}
                  >
                    Delete
                  </button>
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
