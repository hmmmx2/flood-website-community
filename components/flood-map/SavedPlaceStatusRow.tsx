"use client";

/**
 * <SavedPlaceStatusRow /> — Sprint 6 visibility win.
 *
 * Mounts above the filter panel as the FIRST thing under the page
 * header. Answers two questions a flood-map user has in their first
 * 0.5 s of looking at the page:
 *   "Am I safe right now?"        → S6-1
 *   "What are the zones near me?" → S6-5 (expand-in-place)
 *
 * One mini-card per saved place. Tap the card to expand the per-zone
 * list inline (replaces the old, easy-to-miss "Zones in Radius" panel
 * that lived below the map). When the user has no saved places, the
 * row collapses to a single nudge card (S6-6).
 *
 * Privacy contract: every datum on this card comes from a `Zone`
 * served by /api/zones — i.e. an aggregated centroid + radius + label.
 * No `sensorId`, no per-node lat/lng, no raw `sensorCount`. The
 * "n zones within 5 km" subline reflects the count of zones the BFF
 * already chose to publish; it is not a sensor count.
 */

import { useState } from "react";

import type { FloodLevel, Zone } from "@/lib/types";

// ── Public types ────────────────────────────────────────────────────────────

export type SavedPlaceWithStatus = {
  place: {
    id: string;
    label: string;
    latitude: number;
    longitude: number;
    alertRadiusKm: number;
  };
  /** Zones whose centroid falls inside the saved-place radius, sorted by km. */
  items: { z: Zone; d: number }[];
  /** Worst flood level across in-radius zones (0 if none or all clear). */
  worstLevel: FloodLevel;
  /** True when at least one in-radius zone is offline. */
  anyOffline: boolean;
  /** True when ALL in-radius zones are offline (so we render "Offline"). */
  allOffline: boolean;
  /** Newest `lastUpdated` across in-radius zones — for the "updated 12 s ago" subline. */
  newestUpdate?: string;
};

type Props = {
  /** Joined view: each saved place + the zones in its radius. */
  placesWithStatus: SavedPlaceWithStatus[];
  /** True when the user has not yet saved any places (drives the nudge card). */
  isEmpty: boolean;
  /** Pan + zoom the map onto a coordinate (used by "Save my current location"). */
  onFocus: (lat: number, lng: number, zoom?: number) => void;
  /** Open the saved-place editor with prefilled coordinates (S6-6 CTA). */
  onAddCurrentLocation: () => void;
  /** Reused by the per-zone "focus" button so the user can tap a row and jump to the zone. */
  onFocusZone: (z: Zone) => void;
  /** When true, the page knows the user's geolocation — used to enable the empty-state CTA. */
  hasMyLocation: boolean;
  /** Honour OS preference: skip pulse on Critical. */
  reducedMotion: boolean;
};

// ── Status helpers (kept local — they reference Tailwind classes) ───────────

type Tone = "clear" | "alert" | "warning" | "critical" | "offline";

function toneFor(p: SavedPlaceWithStatus): Tone {
  if (p.items.length === 0) return "clear";
  if (p.allOffline) return "offline";
  if (p.worstLevel === 3) return "critical";
  if (p.worstLevel === 2) return "warning";
  if (p.worstLevel === 1) return "alert";
  return "clear";
}

const TONE_LABEL: Record<Tone, string> = {
  clear:    "All clear",
  alert:    "Alert nearby",
  warning:  "Warning nearby",
  critical: "Critical nearby",
  offline:  "Sensors offline",
};

// Card chrome (subtle border + bg). Tone is the loud part.
const CARD_TONE: Record<Tone, string> = {
  clear:    "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200/60 dark:border-emerald-900/50",
  alert:    "bg-amber-50 dark:bg-amber-950/30 border-amber-200/60 dark:border-amber-900/50",
  warning:  "bg-orange-50 dark:bg-orange-950/30 border-orange-200/60 dark:border-orange-900/50",
  critical: "bg-red-50 dark:bg-red-950/30 border-red-200/60 dark:border-red-900/50",
  offline:  "bg-slate-50 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-700/50",
};

// The pill that names the status.
const PILL_TONE: Record<Tone, string> = {
  clear:    "bg-emerald-600 text-white",
  alert:    "bg-amber-500 text-white",
  warning:  "bg-orange-500 text-white",
  critical: "bg-red-600 text-white",
  offline:  "bg-slate-500 text-white",
};

const DOT_HEX: Record<FloodLevel, string> = {
  0: "#16a34a",
  1: "#facc15",
  2: "#f97316",
  3: "#dc2626",
};
const OFFLINE_HEX = "#6b7280";

function relativeTime(iso?: string): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diffMs = Date.now() - t;
  const s = Math.round(diffMs / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function SavedPlaceStatusRow({
  placesWithStatus,
  isEmpty,
  onAddCurrentLocation,
  onFocusZone,
  hasMyLocation,
  reducedMotion,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ── Empty-state nudge (S6-6) ────────────────────────────────────────────
  if (isEmpty) {
    return (
      <section
        aria-label="No saved places yet"
        className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-4 sm:p-5"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-[var(--color-text)] flex items-center gap-2">
              <span aria-hidden>🏠</span> Save your Home or Workplace
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted)] max-w-prose">
              Save a place to get flood alerts inside its radius. Right-click anywhere on the map (or long-press on mobile) to start. We&apos;ll watch the zones around it and send a push notification when status changes.
            </p>
          </div>
          <button
            type="button"
            onClick={onAddCurrentLocation}
            disabled={!hasMyLocation}
            className="self-start rounded-full bg-[var(--color-brand)] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[var(--color-brand-dark)] disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto"
          >
            {hasMyLocation ? "Save my current location" : "Allow location to start"}
          </button>
        </div>
      </section>
    );
  }

  // ── Status cards row (S6-1 + S6-5) ──────────────────────────────────────
  return (
    <section aria-label="My saved places — flood status" className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {placesWithStatus.map(p => {
          const tone = toneFor(p);
          const isExpanded = expanded.has(p.place.id);
          const isCritical = tone === "critical";
          const pulse = isCritical && !reducedMotion;
          return (
            <article
              key={p.place.id}
              className={`rounded-2xl border ${CARD_TONE[tone]} transition-colors`}
            >
              <button
                type="button"
                onClick={() => toggle(p.place.id)}
                aria-expanded={isExpanded}
                aria-controls={`zones-in-${p.place.id}`}
                className="flex w-full items-start gap-3 p-3 text-left"
              >
                {/* House badge with status ring */}
                <span
                  aria-hidden
                  className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-2 ${
                    pulse ? "ring-red-500 animate-pulse" : "ring-[var(--color-border)]"
                  }`}
                  style={{
                    boxShadow:
                      tone === "clear"    ? "0 0 0 3px rgba(22,163,74,0.20)" :
                      tone === "alert"    ? "0 0 0 3px rgba(250,204,21,0.30)" :
                      tone === "warning"  ? "0 0 0 3px rgba(249,115,22,0.30)" :
                      tone === "critical" ? "0 0 0 3px rgba(220,38,38,0.40)" :
                      "0 0 0 3px rgba(100,116,139,0.30)",
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#2563eb"
                       className="h-5 w-5">
                    <path d="M3 12L12 3L21 12V21H14V14H10V21H3V12Z" />
                  </svg>
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-bold text-[var(--color-text)]">{p.place.label}</h3>
                    <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${PILL_TONE[tone]}`}>
                      {TONE_LABEL[tone]}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">
                    {p.items.length === 0
                      ? `No flood zones within ${p.place.alertRadiusKm} km`
                      : `${p.items.length} ${p.items.length === 1 ? "zone" : "zones"} within ${p.place.alertRadiusKm} km`}
                    {p.newestUpdate ? ` · updated ${relativeTime(p.newestUpdate)}` : ""}
                  </p>
                </div>

                <svg
                  xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className={`mt-1 h-4 w-4 flex-shrink-0 text-[var(--color-muted)] transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  aria-hidden
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {/* Expanded per-zone list */}
              {isExpanded && (
                <div
                  id={`zones-in-${p.place.id}`}
                  className="border-t border-[var(--color-border)]/60 p-3"
                >
                  {p.items.length === 0 ? (
                    <p className="text-[11px] text-[var(--color-muted)]">
                      Great — nothing to report inside your alert radius.
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {p.items.map(({ z, d }) => (
                        <li key={z.id}>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onFocusZone(z); }}
                            className="flex w-full items-center gap-2 rounded-xl bg-white/70 dark:bg-slate-900/40 px-2.5 py-1.5 text-left transition hover:bg-white hover:shadow-sm dark:hover:bg-slate-900/70"
                          >
                            <span
                              className="h-2 w-2 flex-shrink-0 rounded-full"
                              style={{ backgroundColor: z.allOffline ? OFFLINE_HEX : DOT_HEX[z.worstLevel] }}
                              aria-hidden
                            />
                            <span className="truncate text-xs font-semibold text-[var(--color-text)]">
                              {z.name}
                            </span>
                            <span className="ml-auto flex-shrink-0 text-[10px] text-[var(--color-muted)] tabular-nums">
                              {d.toFixed(1)} km
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
