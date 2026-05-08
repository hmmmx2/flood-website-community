"use client";

/**
 * <SavedLocationEditor /> — modal form for adding / editing a saved
 * location pin. Captures:
 *
 *   • label                 (required, e.g. "Home", "Workplace")
 *   • address               (free-text — display label, no geocoding here)
 *   • latitude / longitude  (from the device's geolocation, or typed)
 *   • alert radius (km)     (slider 1–50, default 5)
 *
 * Geolocation: uses the browser's navigator.geolocation API. If the
 * user denies permission, falls back to manual lat/lng entry. A future
 * enhancement (Phase 4 polish) will swap the manual coordinate fields
 * for a Google Places Autocomplete + draggable map pin.
 */

import { useEffect, useState } from "react";

export type SavedLocationDraft = {
  label: string;
  address: string;
  latitude: number;
  longitude: number;
  alertRadiusKm: number;
};

interface Props {
  initial: SavedLocationDraft | null;
  onClose: () => void;
  onSave: (draft: SavedLocationDraft) => Promise<void> | void;
}

export default function SavedLocationEditor({ initial, onClose, onSave }: Props) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [latitude, setLatitude] = useState<string>(initial?.latitude?.toString() ?? "");
  const [longitude, setLongitude] = useState<string>(initial?.longitude?.toString() ?? "");
  const [radius, setRadius] = useState<number>(initial?.alertRadiusKm ?? 5);
  const [busy, setBusy] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lock body scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  function handleUseGps() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Geolocation isn't available in this browser.");
      return;
    }
    setGeoLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(6));
        setLongitude(pos.coords.longitude.toFixed(6));
        setGeoLoading(false);
      },
      (err) => {
        setError(err.message || "Could not get your location.");
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!label.trim()) { setError("Label is required."); return; }
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      setError("Latitude must be between -90 and 90.");
      return;
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      setError("Longitude must be between -180 and 180.");
      return;
    }
    if (radius < 1 || radius > 50) {
      setError("Alert radius must be between 1 and 50 km.");
      return;
    }
    setBusy(true);
    try {
      await onSave({
        label: label.trim(),
        address: address.trim(),
        latitude: lat,
        longitude: lng,
        alertRadiusKm: radius,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={initial ? "Edit saved location" : "Add saved location"}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl shadow-xl"
        style={{
          background: "var(--color-card)",
          border: "1px solid var(--color-border)",
        }}
      >
        <div className="px-6 py-4 border-b" style={{ borderColor: "var(--color-border)" }}>
          <h2 className="text-base font-bold" style={{ color: "var(--color-text)" }}>
            {initial ? "Edit saved place" : "Add a saved place"}
          </h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>
            We&apos;ll email you when any sensor inside the radius hits Alert / Warning / Critical.
          </p>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--color-text)" }}>
              Label <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Home / Workplace / Mum's place"
              maxLength={80}
              required
              className="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{
                background: "var(--color-input-bg, var(--color-card))",
                borderColor: "var(--color-border)",
                color: "var(--color-text)",
              }}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--color-text)" }}>
              Address (optional)
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Jalan Pantai, Kota Kinabalu"
              maxLength={1024}
              className="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{
                background: "var(--color-input-bg, var(--color-card))",
                borderColor: "var(--color-border)",
                color: "var(--color-text)",
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "var(--color-text)" }}>
                Latitude <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <input
                type="number"
                step="any"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="5.9788"
                required
                className="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{
                  background: "var(--color-input-bg, var(--color-card))",
                  borderColor: "var(--color-border)",
                  color: "var(--color-text)",
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "var(--color-text)" }}>
                Longitude <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <input
                type="number"
                step="any"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="116.0753"
                required
                className="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{
                  background: "var(--color-input-bg, var(--color-card))",
                  borderColor: "var(--color-border)",
                  color: "var(--color-text)",
                }}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleUseGps}
            disabled={geoLoading}
            className="w-full rounded-lg px-3 py-2 text-xs font-semibold border transition disabled:opacity-50"
            style={{
              background: "var(--color-input-bg, var(--color-card))",
              borderColor: "var(--color-border)",
              color: "var(--color-brand-soft, var(--color-brand))",
            }}
          >
            {geoLoading ? "Locating…" : "📍 Use my current location"}
          </button>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>
                Alert radius
              </label>
              <span
                className="text-xs font-semibold tabular-nums px-2 py-0.5 rounded"
                style={{
                  background: "rgba(56, 139, 253, 0.12)",
                  color: "var(--color-brand-soft, var(--color-brand))",
                }}
              >
                {radius} km
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={50}
              step={1}
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="w-full"
              aria-label="Alert radius in kilometres"
            />
            <div className="flex justify-between text-[10px] mt-0.5" style={{ color: "var(--color-muted)" }}>
              <span>1 km</span>
              <span>50 km</span>
            </div>
          </div>

          {error && (
            <div className="rounded-lg px-3 py-2 text-xs"
                 style={{ background: "rgba(220, 38, 38, 0.1)", color: "#dc2626" }}>
              {error}
            </div>
          )}
        </div>

        <div
          className="px-6 py-4 border-t flex items-center justify-end gap-2"
          style={{ borderColor: "var(--color-border)" }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-full px-4 py-2 text-xs font-semibold border"
            style={{
              borderColor: "var(--color-border)",
              color: "var(--color-text-secondary)",
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-full px-5 py-2 text-xs font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--color-brand)" }}
          >
            {busy ? "Saving…" : initial ? "Update" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
