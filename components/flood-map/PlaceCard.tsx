"use client";

/**
 * Place Card (P1-5 + P1-8) — the sliding card that opens when the
 * user clicks an autocomplete suggestion, right-clicks the map, or
 * taps an aggregated flood zone.
 *
 * One component, two shapes:
 *   - `kind: "place"` — for a POI / searched place / right-click pin.
 *     Shows name, address, and "Save Place / Copy coords /
 *     Directions / Share" actions.
 *   - `kind: "zone"` — for an aggregated flood zone (centroid only,
 *     never a sensor). Shows the zone name, worst status pill,
 *     coarse cluster size, and "Subscribe / Directions away / Share"
 *     actions. The Directions button opens Google Maps in a new tab
 *     until P1-6 in-app routing lands.
 *
 * Layout:
 *   - Desktop: right-side floating column, anchored to the map card.
 *   - Mobile (<640 px): full-width bottom-sheet.
 * Both use plain CSS transitions so we don't pull in framer-motion.
 */

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import { useSlideoutLayout } from "./useSlideoutLayout";

/** Public input shapes. The page builds these from its three open paths.
 *
 *  NOTE (2026-05-21): the `kind: "zone"` variant was removed in the
 *  privacy hardening pass. Showing a "Flood point / Copy coords /
 *  Directions away" card for a sensor effectively published the
 *  sensor's exact install position to anyone with a map click. The
 *  type is now place-only; if a future feature needs to surface a
 *  zone, design it without exposing per-sensor coordinates. */
export type PlaceCardModel = {
  kind: "place";
  name: string;
  address?: string;
  lat: number;
  lng: number;
};

type Props = {
  open: boolean;
  model: PlaceCardModel | null;
  /** Saves the current location to "My Saved Places" — page wires it. */
  onSave?: () => void;
  /** Copies a share-link of the current view + pin to the clipboard. */
  onShare?: () => void;
  /**
   * Opens the in-app flood-aware Directions panel with this place as
   * the destination. When provided, the Directions button calls this
   * instead of opening the Google Maps deep-link.
   */
  onDirections?: (dest: { lat: number; lng: number; label: string }) => void;
  onClose: () => void;
};

// Level/status pill constants removed along with the zone variant —
// PlaceCard now renders only place pins, never flood points.

/**
 * Builds a Google Maps deep link for driving directions to a lat/lng.
 * Uses the documented universal search URL — works on web, Android,
 * and iOS without paying for the Directions API. The flood-aware
 * in-app router (P1-6) replaces this later.
 */
function googleDirectionsHref(lat: number, lng: number, label?: string): string {
  const dest = encodeURIComponent(`${lat.toFixed(5)},${lng.toFixed(5)}`);
  const q = label ? `&destination_place_id=${encodeURIComponent(label)}` : "";
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}${q}`;
}

export default function PlaceCard({ open, model, onSave, onShare, onDirections, onClose }: Props) {
  const layoutStyle = useSlideoutLayout(open);
  // Latch the last model so the card animates out gracefully on close.
  const [latched, setLatched] = useState<PlaceCardModel | null>(model);
  useEffect(() => {
    if (model) setLatched(model);
  }, [model]);

  // Close on Esc.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const m = latched;
  if (!m) return null;

  // Card is place-only after the privacy hardening pass — no zone variant.
  const lat = m.lat;
  const lng = m.lng;
  const title = m.name;
  const subtitle = m.address ?? "";

  async function copyCoords() {
    const text = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Coordinates copied");
    } catch {
      toast.error("Couldn't copy");
    }
  }

  return (
    <>
      {/* Backdrop — only on mobile (sm:hidden) so desktop stays usable.
          `absolute` (not `fixed`) so it dims only the map box it now
          lives inside, never the whole viewport. */}
      <div
        onClick={onClose}
        aria-hidden
        className={`absolute inset-0 z-30 bg-black/30 transition-opacity sm:hidden ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      <aside
        role="dialog"
        aria-modal="false"
        aria-label="Place details"
        // ALL positioning + sizing + rounding + transform come from the
        // shared layout hook. The className intentionally carries no
        // positional utilities so Tailwind can't fight the inline style.
        style={layoutStyle}
        // `transition-[transform,opacity]` so opacity fade and slide
        // animate together when the panel opens / closes — see
        // useSlideoutLayout for why opacity is part of the close state.
        className="z-40 bg-[var(--color-card)] shadow-2xl ring-1 ring-black/10 overflow-y-auto transition-[transform,opacity] duration-200"
      >
        {/* Mobile drag handle */}
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-[var(--color-border)] sm:hidden" />

        <header className="flex items-start justify-between gap-3 px-4 pt-3 sm:pt-4">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
              Place
            </p>
            <h3 className="truncate text-base font-bold text-[var(--color-text)]">{title}</h3>
            <p className="mt-0.5 line-clamp-2 text-xs text-[var(--color-muted)]">{subtitle}</p>
          </div>
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

        <div className="grid grid-cols-2 gap-2 px-4 py-3 sm:grid-cols-2">
          {/* Directions button removed (privacy hardening 2026-05-21):
              the paper-plane CTA both leaked the sensor's exact coords
              into Google's deep-link URL and pulled users out of the
              app on every tap. PlaceCard now offers Save + Share only. */}

          {onSave && (
            <button
              type="button"
              onClick={onSave}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-xs font-semibold text-[var(--color-text)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] transition"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                   className="h-3.5 w-3.5">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
              Save place
            </button>
          )}

          <button
            type="button"
            onClick={copyCoords}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-xs font-semibold text-[var(--color-text)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                 className="h-3.5 w-3.5">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            Copy coords
          </button>

          {onShare && (
            <button
              type="button"
              onClick={onShare}
              className="col-span-2 inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-xs font-semibold text-[var(--color-text)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] transition"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                   className="h-3.5 w-3.5">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              Share this view
            </button>
          )}
        </div>

      </aside>
    </>
  );
}
