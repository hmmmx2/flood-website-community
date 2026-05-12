"use client";

/**
 * <NodeBellMenu /> — per-sensor notification channel picker.
 *
 * Click the bell on a sensor card to mute / unmute it and pick which
 * external channels deliver alerts for THAT sensor (Email, SMS,
 * WhatsApp). The in-app website bell is always on as long as the user
 * has favourited the sensor — it is the baseline channel and is not
 * exposed as a toggle, mirroring how Twitter / Facebook treat their
 * own in-app notifications.
 *
 * Toggling any switch issues a PATCH to the BFF which updates the
 * user_favourite_nodes row server-side. The dispatcher (Java) applies
 * these per-favourite toggles as a mask on top of the user's global
 * notification preferences — a channel must be enabled in BOTH places
 * for an alert to fire.
 *
 * Bell visual states:
 *   • favourited and at least one external channel on → solid amber bell
 *   • favourited but every external channel off       → hollow muted bell
 *   • not favourited yet                               → hollow muted bell
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { authFetchJson } from "@/lib/fetchJson";

/** External (toggleable) channels — push / in-app is intentionally excluded. */
type ChannelKey = "emailEnabled" | "smsEnabled" | "whatsappEnabled";
const EXTERNAL_CHANNELS: { key: ChannelKey; label: string }[] = [
  { key: "emailEnabled",    label: "Email" },
  { key: "smsEnabled",      label: "SMS" },
  { key: "whatsappEnabled", label: "WhatsApp" },
];

export type NodeChannelPrefs = {
  emailEnabled: boolean;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  pushEnabled: boolean;
};

interface Props {
  nodeId: string;
  /** Whether the user has favourited this node (i.e. row exists). */
  isFavourited: boolean;
  /** Initial channel prefs — comes from the favourites list. */
  prefs: NodeChannelPrefs;
  /** Called optimistically when the user changes any channel toggle. */
  onPrefsChange: (next: NodeChannelPrefs) => void;
  /** Called when the user wants to start watching this node (POST favourite). */
  onSubscribe: () => Promise<void>;
}

export default function NodeBellMenu({
  nodeId,
  isFavourited,
  prefs,
  onPrefsChange,
  onSubscribe,
}: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Anchor the popover under the bell button using viewport-fixed coords
  // so the menu can escape any parent with `overflow-y-auto` (the scroll
  // container around Nodes-in-Radius would otherwise clip it).
  //
  // Two behaviours we get right here:
  //   1. recalcPos is rAF-batched so a fast scroll does not queue dozens
  //      of state updates per frame.
  //   2. If the trigger button leaves the viewport (the user scrolls past
  //      the card), the menu closes itself — otherwise it would float at
  //      the top of the page far away from its anchor, which is what the
  //      "menu sticks during scroll" report describes.
  const recalcPos = useCallback(() => {
    const b = buttonRef.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    const inViewport =
      r.bottom > 0 && r.top < window.innerHeight &&
      r.right  > 0 && r.left < window.innerWidth;
    if (!inViewport) {
      setOpen(false);
      return;
    }
    const POPOVER_W = 224; // matches w-56
    const margin = 8;
    let left = r.right - POPOVER_W;
    if (left < margin) left = margin;
    if (left + POPOVER_W + margin > window.innerWidth) {
      left = window.innerWidth - POPOVER_W - margin;
    }
    setPos({ top: r.bottom + 6, left });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    recalcPos();
    let frame: number | null = null;
    const schedule = () => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        recalcPos();
      });
    };
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [open, recalcPos]);

  // Push (in-app bell) is always on as long as the favourite exists, so
  // it does not factor into the muted calculation. The bell is "muted"
  // when the user has not subscribed yet, OR when every external channel
  // is off (Email + SMS + WhatsApp all unchecked).
  const externalOnCount =
    (prefs.emailEnabled ? 1 : 0) +
    (prefs.smsEnabled ? 1 : 0) +
    (prefs.whatsappEnabled ? 1 : 0);
  const allExternalOn = externalOnCount === EXTERNAL_CHANNELS.length;
  const someExternalOn = externalOnCount > 0 && !allExternalOn;
  const muted = !isFavourited || externalOnCount === 0;

  // Close on outside-click + ESC. Both the trigger button AND the popover
  // (rendered in a portal) count as "inside".
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (buttonRef.current?.contains(t)) return;
      if (popoverRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  /**
   * Persist a partial channel-prefs patch. Push is always implicitly on
   * when the favourite row exists, so the body never carries pushEnabled.
   * The Java DTO treats missing fields as "no change", so a partial PATCH
   * only flips the keys we send.
   *
   * We deliberately do NOT gate this behind the local `busy` flag — the
   * Java service handles concurrent PATCHes against the same row safely
   * (each is its own short transaction), and dropping rapid clicks made
   * the toggles feel laggy. The optimistic update has already moved the
   * UI; this just persists the intent in the background.
   */
  const persist = useCallback(async (patch: Partial<NodeChannelPrefs>, previous: NodeChannelPrefs) => {
    try {
      if (!isFavourited) {
        await onSubscribe();
      }
      await authFetchJson(`/api/favourites/${nodeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    } catch (e) {
      onPrefsChange(previous); // roll back
      toast.error(e instanceof Error ? e.message : "Could not update notifications.");
    }
  }, [nodeId, isFavourited, onSubscribe, onPrefsChange]);

  const setChannel = useCallback((key: ChannelKey, value: boolean) => {
    const previous = prefs;
    const next = { ...prefs, [key]: value, pushEnabled: true };
    onPrefsChange(next); // optimistic — flips the UI instantly
    void persist({ [key]: value, pushEnabled: true }, previous);
  }, [prefs, onPrefsChange, persist]);

  const setAllExternal = useCallback((value: boolean) => {
    const previous = prefs;
    const next: NodeChannelPrefs = {
      emailEnabled: value,
      smsEnabled: value,
      whatsappEnabled: value,
      pushEnabled: true,
    };
    onPrefsChange(next);
    void persist(next, previous);
  }, [prefs, onPrefsChange, persist]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        title={muted
          ? "Notifications muted for this sensor — click to set up"
          : "Notifications on — click to change channels"}
        aria-label={muted ? "Set up notifications for this sensor" : "Change notification channels"}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex-shrink-0 -mt-0.5 -mr-1 p-1 rounded transition disabled:opacity-50"
      >
        {muted ? (
          // hollow bell with slash (muted)
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
               className="h-4 w-4 text-[var(--color-muted)] hover:text-amber-400 transition-colors">
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            <path d="M18.63 13A17.89 17.89 0 0 1 18 8" />
            <path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14" />
            <path d="M18 8a6 6 0 0 0-9.33-5" />
            <line x1="2" y1="2" x2="22" y2="22" />
          </svg>
        ) : (
          // solid bell (active)
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
               fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
               className="h-4 w-4 text-amber-400 transition-colors">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="#0f172a" fill="none" />
          </svg>
        )}
      </button>

      {open && pos && typeof document !== "undefined" && createPortal(
        <div
          ref={popoverRef}
          role="menu"
          onClick={(e) => e.stopPropagation()}
          style={{ position: "fixed", top: pos.top, left: pos.left, width: 224 }}
          className="z-[80] rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-2 shadow-xl ring-1 ring-black/5"
        >
          <div className="px-2 pt-1 pb-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              Notify me via
            </p>
            <p className="text-[10px] text-[var(--color-muted)] mt-0.5">
              The website bell is always on. Turn off all three to mute external alerts.
            </p>
          </div>
          <ChannelRow
            label="Select all"
            checked={allExternalOn}
            indeterminate={someExternalOn}
            emphasised
            onChange={(v) => setAllExternal(v)}
          />
          <div className="my-1 h-px bg-[var(--color-border)]" aria-hidden />
          {EXTERNAL_CHANNELS.map((ch) => (
            <ChannelRow
              key={ch.key}
              label={ch.label}
              checked={prefs[ch.key]}
              onChange={(v) => setChannel(ch.key, v)}
            />
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}

function ChannelRow({
  label,
  checked,
  indeterminate,
  emphasised,
  onChange,
}: {
  label: string;
  checked: boolean;
  indeterminate?: boolean;
  /** Bold the row label — used for the master "Select all" row. */
  emphasised?: boolean;
  onChange: (next: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  // The browser exposes indeterminate as a property, not an HTML attribute,
  // so it has to be set imperatively after render.
  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = Boolean(indeterminate);
  }, [indeterminate]);

  return (
    <label className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-xs transition hover:bg-[var(--color-hover)] cursor-pointer">
      <span className={`${emphasised ? "font-semibold" : ""} text-[var(--color-text)]`}>
        {label}
      </span>
      <input
        ref={inputRef}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 cursor-pointer rounded accent-[var(--color-brand)]"
        aria-label={label}
        aria-checked={indeterminate ? "mixed" : checked}
      />
    </label>
  );
}
