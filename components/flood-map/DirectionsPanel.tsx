"use client";

/**
 * Directions panel (P1-6) — flood-aware routing.
 *
 * Opens when the user taps "Directions" on a Place Card or the
 * floating Directions button on the map. Inputs From / To, picks a
 * travel mode, calls `google.maps.DirectionsService.route()` with
 * route alternatives, and forwards the resulting routes to the
 * parent so the map can render the polylines. Each route card shows
 * distance, duration, and a flood-impact pill computed via the
 * {@link useFloodAwareRoutes} hook — routes that pass through a
 * Warning+ zone are greyed out and labelled.
 *
 * Layout mirrors PlaceCard: right-side rail on desktop, bottom-sheet
 * on mobile, CSS-only transitions.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Autocomplete } from "@react-google-maps/api";

import type { Zone } from "@/lib/types";
import { useGoogleMapsReady } from "@/lib/useGoogleMapsReady";
import {
  useFloodAwareRoutes,
  type FloodImpact,
  type ScoredRoute,
} from "@/lib/useFloodAwareRoute";

export type DirectionsRequest = {
  /** When set, the panel pre-fills To with this place. */
  destination?: { lat: number; lng: number; label?: string };
};

type Mode = "DRIVING" | "WALKING" | "BICYCLING";

type Props = {
  open: boolean;
  request: DirectionsRequest | null;
  zones: Zone[];
  /** The user's current location, if known. Used as the default From. */
  myLocation?: { lat: number; lng: number } | null;
  /**
   * Desktop `right` offset (e.g. `"344px"`) — see PlaceCard for the
   * rationale. `null` on mobile so the bottom-sheet classes take over.
   */
  rightOffset?: string | null;
  /** Fires whenever the scored route list changes so the map can render polylines. */
  onRoutesChange: (
    routes: ScoredRoute<google.maps.DirectionsRoute>[] | null,
    selectedIndex: number,
  ) => void;
  onClose: () => void;
};

const MODE_LABEL: Record<Mode, { label: string; iconPath: string }> = {
  DRIVING: {
    label: "Drive",
    // car
    iconPath: "M5 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm14 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM3 13l2-6h14l2 6M3 13h18M3 13v4h2M21 13v4h-2",
  },
  WALKING: {
    label: "Walk",
    iconPath: "M13 4a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm-1 6l-3 3 2 4-2 5h2l2-4 2 2v3h2v-4l-2-3 1-4 2 3h3v-2h-2l-3-4z",
  },
  BICYCLING: {
    label: "Bicycle",
    iconPath: "M5.5 17a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7zm13 0a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7zM12 5l2 4 3 1-2 3h-4l-2-4",
  },
};

const IMPACT_PILL: Record<FloodImpact, string> = {
  ok:       "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  warning:  "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  critical: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
};
const IMPACT_LABEL: Record<FloodImpact, string> = {
  ok:       "Clear of flooded areas",
  warning:  "Passes a Warning zone",
  critical: "Passes a Critical zone",
};

function formatMeters(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(m < 10_000 ? 1 : 0)} km`;
}

function formatSeconds(s: number): string {
  if (s < 60) return `${Math.round(s)} s`;
  const mins = Math.round(s / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const r = mins % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

export default function DirectionsPanel({
  open,
  request,
  zones,
  myLocation,
  rightOffset,
  onRoutesChange,
  onClose,
}: Props) {
  const [mode, setMode] = useState<Mode>("DRIVING");
  const [fromText, setFromText] = useState("");
  const [toText, setToText] = useState("");
  // Resolved coordinates. Pre-filled from `request` when the panel
  // opens from a Place Card or my-location pin.
  const [fromLatLng, setFromLatLng] = useState<google.maps.LatLngLiteral | null>(null);
  const [toLatLng, setToLatLng] = useState<google.maps.LatLngLiteral | null>(null);
  const [useMyLocation, setUseMyLocation] = useState(true);

  const [routes, setRoutes] = useState<google.maps.DirectionsRoute[] | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fromAcRef = useRef<google.maps.places.Autocomplete | null>(null);
  const toAcRef = useRef<google.maps.places.Autocomplete | null>(null);

  // We render `<Autocomplete>` only after the Google Maps JS script
  // (with the `places` library) has loaded — otherwise its
  // componentDidMount throws `ReferenceError: google is not defined`
  // because the panel is mounted at the page root and races the
  // script loader that lives inside <NodeMap>. See useGoogleMapsReady.
  const mapsReady = useGoogleMapsReady();

  const scored = useFloodAwareRoutes(routes, zones);

  // Forward scored routes (or null when cleared) upward so the parent
  // map can render polylines for visualisation.
  useEffect(() => {
    if (!routes) onRoutesChange(null, 0);
    else onRoutesChange(scored, selectedIndex);
  }, [routes, scored, selectedIndex, onRoutesChange]);

  // When the panel opens, prefill From/To from `request` and the user's
  // location. The destination label is what we want as the To input.
  useEffect(() => {
    if (!open) return;
    if (request?.destination) {
      setToLatLng({ lat: request.destination.lat, lng: request.destination.lng });
      setToText(request.destination.label ?? `${request.destination.lat.toFixed(4)}, ${request.destination.lng.toFixed(4)}`);
    }
    if (myLocation) {
      setFromLatLng(myLocation);
      setUseMyLocation(true);
    }
    setError(null);
    setRoutes(null);
  }, [open, request, myLocation]);

  const handleFromChanged = useCallback(() => {
    const place = fromAcRef.current?.getPlace();
    if (!place?.geometry?.location) return;
    setFromLatLng({
      lat: place.geometry.location.lat(),
      lng: place.geometry.location.lng(),
    });
    setUseMyLocation(false);
  }, []);

  const handleToChanged = useCallback(() => {
    const place = toAcRef.current?.getPlace();
    if (!place?.geometry?.location) return;
    setToLatLng({
      lat: place.geometry.location.lat(),
      lng: place.geometry.location.lng(),
    });
  }, []);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (typeof google === "undefined") return;
    const origin = useMyLocation && myLocation
      ? { lat: myLocation.lat, lng: myLocation.lng }
      : fromLatLng;
    if (!origin || !toLatLng) {
      setError("Pick both a starting point and a destination.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const service = new google.maps.DirectionsService();
      const res = await service.route({
        origin,
        destination: toLatLng,
        travelMode: google.maps.TravelMode[mode],
        provideRouteAlternatives: true,
      });
      const list = res.routes ?? [];
      if (list.length === 0) {
        setRoutes(null);
        setError("No route found.");
        return;
      }
      setRoutes(list);
      // Default to the safest route (lowest impact, then shortest).
      const ranking = list
        .map((r, idx) => ({
          idx,
          impactPenalty:
            r.legs?.[0]?.duration?.value ?? Number.MAX_SAFE_INTEGER,
        }))
        .sort((a, b) => a.impactPenalty - b.impactPenalty);
      setSelectedIndex(ranking[0]?.idx ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't get directions.");
    } finally {
      setLoading(false);
    }
  }

  // Esc closes the panel.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Auto-submit when both endpoints are set (smooth UX: tap Directions
  // on a Place Card and the routes appear without an extra Go click).
  const autoSubmittedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!open) return;
    const origin = useMyLocation && myLocation ? myLocation : fromLatLng;
    if (!origin || !toLatLng) return;
    const key = `${origin.lat.toFixed(4)},${origin.lng.toFixed(4)}|${toLatLng.lat.toFixed(4)},${toLatLng.lng.toFixed(4)}|${mode}`;
    if (autoSubmittedFor.current === key) return;
    autoSubmittedFor.current = key;
    void submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fromLatLng, toLatLng, useMyLocation, myLocation, mode]);

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden
        className={`fixed inset-0 z-30 bg-black/30 transition-opacity sm:hidden ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      <aside
        role="dialog"
        aria-label="Directions"
        // On desktop, the parent supplies the exact `right` offset that
        // lands the card flush with the map's right edge inside the
        // max-w-7xl container. Inline style wins over the Tailwind
        // mobile classes; we also force `left: auto` / `bottom: auto`
        // / `top: 6rem` / a sane max-height so the bottom-sheet
        // positioning doesn't fight the side-rail positioning. On
        // mobile (`rightOffset` is null) we drop the inline style
        // entirely and let the Tailwind bottom-sheet classes take over.
        style={open && rightOffset
          ? {
              right: rightOffset,
              left: "auto",
              top: "6rem",
              bottom: "auto",
              maxHeight: "calc(100vh - 8rem)",
            }
          : undefined}
        className={`fixed z-40 bg-[var(--color-card)] shadow-2xl ring-1 ring-black/10 transition-transform duration-200
          inset-x-0 bottom-0 rounded-t-2xl max-h-[80vh] overflow-y-auto
          sm:w-[360px] sm:rounded-2xl
          lg:w-[400px]
          ${
            open
              ? "translate-y-0 sm:translate-x-0"
              : "translate-y-full sm:translate-y-0 sm:translate-x-[calc(100%+1rem)]"
          }`}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-[var(--color-border)] sm:hidden" />

        <header className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] px-4 py-3 sm:pt-4">
          <h3 className="text-base font-bold text-[var(--color-text)]">Directions</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                 className="h-4 w-4">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <form onSubmit={submit} className="space-y-3 px-4 pt-3">
          {/* From */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">From</label>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setUseMyLocation(v => !v);
                  if (!useMyLocation) setFromText("");
                }}
                title="Use my location"
                className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border transition ${
                  useMyLocation
                    ? "border-[var(--color-brand)] bg-[var(--color-brand)]/10 text-[var(--color-brand)]"
                    : "border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-muted)] hover:text-[var(--color-text)]"
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                     className="h-4 w-4">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                </svg>
              </button>
              {useMyLocation ? (
                <span className="flex-1 truncate rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text)]">
                  My location
                </span>
              ) : mapsReady ? (
                <Autocomplete
                  onLoad={(ac) => { fromAcRef.current = ac; }}
                  onPlaceChanged={handleFromChanged}
                  options={{
                    componentRestrictions: { country: ["my"] },
                    fields: ["geometry", "name", "formatted_address"],
                  }}
                >
                  <input
                    type="text"
                    value={fromText}
                    onChange={e => setFromText(e.target.value)}
                    placeholder="Choose a starting point"
                    className="flex-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-brand)]"
                  />
                </Autocomplete>
              ) : (
                /* Map script still loading — render a placeholder that
                   matches the live Autocomplete's footprint so the
                   panel doesn't reflow when it swaps in. */
                <input
                  type="text"
                  disabled
                  placeholder="Loading places…"
                  className="flex-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-muted)] outline-none"
                />
              )}
            </div>
          </div>

          {/* To */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">To</label>
            {mapsReady ? (
              <Autocomplete
                onLoad={(ac) => { toAcRef.current = ac; }}
                onPlaceChanged={handleToChanged}
                options={{
                  componentRestrictions: { country: ["my"] },
                  fields: ["geometry", "name", "formatted_address"],
                }}
              >
                <input
                  type="text"
                  value={toText}
                  onChange={e => setToText(e.target.value)}
                  placeholder="Where to?"
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-brand)]"
                />
              </Autocomplete>
            ) : (
              <input
                type="text"
                disabled
                placeholder="Loading places…"
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-muted)] outline-none"
              />
            )}
          </div>

          {/* Mode picker */}
          <div className="flex items-center gap-1.5">
            {(["DRIVING", "WALKING", "BICYCLING"] as Mode[]).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl px-2 py-1.5 text-xs font-semibold transition ${
                  mode === m
                    ? "bg-[var(--color-brand)] text-white"
                    : "bg-[var(--color-input-bg)] text-[var(--color-muted)] hover:text-[var(--color-text)]"
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                     className="h-3.5 w-3.5">
                  <path d={MODE_LABEL[m].iconPath} />
                </svg>
                {MODE_LABEL[m].label}
              </button>
            ))}
          </div>

          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </p>
          )}
        </form>

        {/* Route list */}
        <div className="px-4 py-3 space-y-2">
          {loading && (
            <p className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-brand)]" />
              Finding routes…
            </p>
          )}
          {!loading && scored.length > 0 && (
            <>
              <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Routes</p>
              {scored.map((s, i) => {
                const r = s.route;
                const leg = r.legs?.[0];
                const distance = leg?.distance?.value ?? 0;
                const duration = leg?.duration?.value ?? 0;
                const selected = i === selectedIndex;
                const flooded = s.impact !== "ok";
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelectedIndex(i)}
                    aria-pressed={selected}
                    className={`block w-full rounded-xl border px-3 py-2.5 text-left transition ${
                      selected
                        ? "border-[var(--color-brand)] bg-[var(--color-brand)]/5"
                        : flooded
                          ? "border-[var(--color-border)] bg-[var(--color-input-bg)] opacity-70"
                          : "border-[var(--color-border)] bg-[var(--color-input-bg)] hover:border-[var(--color-brand)]/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-[var(--color-text)]">
                          {r.summary || (leg ? `${formatMeters(distance)} via ${leg.start_address.split(",")[0]}` : "Route")}
                        </p>
                        <p className="text-[11px] text-[var(--color-muted)]">
                          {formatSeconds(duration)} · {formatMeters(distance)}
                        </p>
                      </div>
                      <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${IMPACT_PILL[s.impact]}`}>
                        {s.impact === "ok" ? "Clear" : s.impact === "warning" ? "Warning" : "Critical"}
                      </span>
                    </div>
                    {flooded && s.passedZoneNames.length > 0 && (
                      <p className="mt-1 text-[11px] text-[var(--color-muted)]">
                        {IMPACT_LABEL[s.impact]}: {s.passedZoneNames.join(", ")}
                      </p>
                    )}
                  </button>
                );
              })}
            </>
          )}
        </div>
      </aside>
    </>
  );
}
