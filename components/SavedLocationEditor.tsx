"use client";

/**
 * <SavedLocationEditor /> — modal form for adding / editing a saved place.
 *
 * Phase 4b (privacy + UX): captures the place via Google Places
 * Autocomplete OR a right-click on the main map (parent passes the
 * coords in via `prefill`). Manual lat/lng entry is hidden behind a
 * "Set coordinates manually" toggle for the rare cases where the
 * other two flows fail.
 *
 *   • label                — required, e.g. "Home", "Workplace"
 *   • address              — auto-filled from Places / reverse geocode
 *   • latitude / longitude — set by Autocomplete, map right-click, GPS, or manual
 *   • alertRadiusKm        — slider 1–50 km
 */

import { useEffect, useRef, useState } from "react";
import { Autocomplete } from "@react-google-maps/api";

import { useGoogleMapsReady } from "@/lib/useGoogleMapsReady";

export type SavedLocationDraft = {
  label: string;
  address: string;
  latitude: number;
  longitude: number;
  alertRadiusKm: number;
};

interface Props {
  initial: SavedLocationDraft | null;
  /** When the parent has already obtained a place (e.g. via right-click +
   *  reverse geocode), pass it here so the editor opens prefilled. */
  prefill?: Partial<SavedLocationDraft> | null;
  onClose: () => void;
  onSave: (draft: SavedLocationDraft) => Promise<void> | void;
}

export default function SavedLocationEditor({ initial, prefill, onClose, onSave }: Props) {
  const seed = initial ?? prefill ?? null;
  const [label, setLabel] = useState(seed?.label ?? "");
  const [address, setAddress] = useState(seed?.address ?? "");
  const [latitude, setLatitude] = useState<string>(
    seed?.latitude != null ? String(seed.latitude) : "",
  );
  const [longitude, setLongitude] = useState<string>(
    seed?.longitude != null ? String(seed.longitude) : "",
  );
  const [radius, setRadius] = useState<number>(seed?.alertRadiusKm ?? 5);
  const [busy, setBusy] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  // Defence-in-depth: while the editor only opens after the user has
  // right-clicked on the loaded map (so `google` is always defined in
  // practice), we still gate the Autocomplete behind this hook so a
  // future code path that opens the editor eagerly can't crash with
  // `ReferenceError: google is not defined`.
  const mapsReady = useGoogleMapsReady();

  // Lock body scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Whenever the parent updates the prefill (e.g. another right-click on
  // the map while the editor is already open), refresh the coords.
  useEffect(() => {
    if (!prefill) return;
    if (prefill.latitude != null) setLatitude(String(prefill.latitude));
    if (prefill.longitude != null) setLongitude(String(prefill.longitude));
    if (prefill.address)           setAddress(prefill.address);
  }, [prefill]);

  function handlePlaceChanged() {
    const ac = autocompleteRef.current;
    if (!ac) return;
    const place = ac.getPlace();
    if (!place.geometry?.location) {
      setError("Pick a place from the suggestions.");
      return;
    }
    setError(null);
    setLatitude(place.geometry.location.lat().toFixed(6));
    setLongitude(place.geometry.location.lng().toFixed(6));
    setAddress(place.formatted_address ?? place.name ?? "");
  }

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
    if (!label.trim()) { setError("Give this place a label."); return; }
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      setError("Pick a place from the search bar, or right-click on the map.");
      return;
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      setError("Pick a place from the search bar, or right-click on the map.");
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

  const hasCoords = latitude !== "" && longitude !== "";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={initial ? "Edit saved place" : "Add saved place"}
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
              className="w-full rounded-lg px-3 py-2.5 text-sm border focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{
                background: "var(--color-input-bg, var(--color-card))",
                borderColor: "var(--color-border)",
                color: "var(--color-text)",
                minHeight: 44,
              }}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--color-text)" }}>
              Search a place <span style={{ color: "#dc2626" }}>*</span>
            </label>
            {mapsReady ? (
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
                  defaultValue={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Lintas Square, Kota Kinabalu"
                  className="w-full rounded-lg px-3 py-2.5 text-sm border focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{
                    background: "var(--color-input-bg, var(--color-card))",
                    borderColor: "var(--color-border)",
                    color: "var(--color-text)",
                    minHeight: 44,
                  }}
                />
              </Autocomplete>
            ) : (
              <input
                type="text"
                disabled
                placeholder="Loading places…"
                className="w-full rounded-lg px-3 py-2.5 text-sm border focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{
                  background: "var(--color-input-bg, var(--color-card))",
                  borderColor: "var(--color-border)",
                  color: "var(--color-muted)",
                  minHeight: 44,
                }}
              />
            )}
            <p className="mt-1.5 text-[11px]" style={{ color: "var(--color-muted)" }}>
              Or right-click on the map to drop a pin, or use your GPS below.
            </p>
          </div>

          <button
            type="button"
            onClick={handleUseGps}
            disabled={geoLoading}
            className="w-full rounded-lg px-3 py-2.5 text-xs font-semibold border transition disabled:opacity-50"
            style={{
              background: "var(--color-input-bg, var(--color-card))",
              borderColor: "var(--color-border)",
              color: "var(--color-brand-soft, var(--color-brand))",
              minHeight: 44,
            }}
          >
            {geoLoading ? (
              "Locating…"
            ) : (
              <span className="inline-flex items-center justify-center gap-1.5">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-3.5 w-3.5"
                  aria-hidden
                >
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                Use my current location
              </span>
            )}
          </button>

          {hasCoords && !showManual && (
            <div
              className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-[11px]"
              style={{
                background: "var(--color-input-bg, var(--color-card))",
                color: "var(--color-muted)",
                border: "1px dashed var(--color-border)",
              }}
            >
              <span>
                Pinned at <strong style={{ color: "var(--color-text)" }}>
                  {Number(latitude).toFixed(4)}°, {Number(longitude).toFixed(4)}°
                </strong>
              </span>
              <button
                type="button"
                onClick={() => setShowManual(true)}
                className="text-[11px] font-semibold underline"
                style={{ color: "var(--color-brand)" }}
              >
                Edit
              </button>
            </div>
          )}

          {(showManual || (!hasCoords && initial)) && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--color-text)" }}>
                  Latitude
                </label>
                <input
                  type="number"
                  step="any"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  placeholder="5.9788"
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
                  Longitude
                </label>
                <input
                  type="number"
                  step="any"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  placeholder="116.0753"
                  className="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{
                    background: "var(--color-input-bg, var(--color-card))",
                    borderColor: "var(--color-border)",
                    color: "var(--color-text)",
                  }}
                />
              </div>
            </div>
          )}

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
            <div
              role="alert"
              className="rounded-lg px-3 py-2 text-xs"
              style={{ background: "rgba(220, 38, 38, 0.1)", color: "#dc2626" }}
            >
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
              minHeight: 44,
              minWidth: 64,
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-full px-5 py-2 text-xs font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--color-brand)", minHeight: 44, minWidth: 80 }}
          >
            {busy ? "Saving…" : initial ? "Update" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
