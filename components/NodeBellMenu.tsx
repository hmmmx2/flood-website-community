"use client";

/**
 * <NodeBellMenu /> — per-sensor notification channel picker.
 *
 * Click the bell on a sensor card to mute / unmute it and pick exactly
 * which channels deliver alerts for THAT sensor: in-app, email, SMS,
 * WhatsApp. Toggling any switch issues a PATCH to the BFF which updates
 * the user_favourite_nodes row server-side. The dispatcher (Java)
 * applies these per-favourite toggles as a mask on top of the user's
 * global notification preferences — a channel must be enabled in BOTH
 * places for an alert to fire.
 *
 * Bell visual states:
 *   • all 4 channels off → hollow bell with diagonal slash (muted)
 *   • any channel on     → solid amber bell (alerts will fire)
 *
 * The button itself is keyboard-accessible (Enter / Space toggles open).
 * Click outside the popover or press Escape to close.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { authFetchJson } from "@/lib/fetchJson";

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
  const [busy, setBusy] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Anchor the popover under the bell button using viewport-fixed coords
  // so the menu can escape any parent with `overflow-y-auto` (the scroll
  // container around Nodes-in-Radius would otherwise clip it).
  const recalcPos = useCallback(() => {
    const b = buttonRef.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
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
    const onScroll = () => recalcPos();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, recalcPos]);

  const anyOn =
    prefs.emailEnabled || prefs.smsEnabled || prefs.whatsappEnabled || prefs.pushEnabled;
  // "Muted" means: subscribed but every channel turned off OR not subscribed at all.
  const muted = !isFavourited || !anyOn;

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

  const setChannel = useCallback(async (key: keyof NodeChannelPrefs, value: boolean) => {
    if (busy) return;
    const previous = prefs;
    const next = { ...prefs, [key]: value };
    onPrefsChange(next); // optimistic
    setBusy(true);
    try {
      // Auto-subscribe (create favourite row) the first time the user
      // touches a toggle — otherwise PATCH would 404 with no row to update.
      if (!isFavourited) {
        await onSubscribe();
      }
      await authFetchJson(`/api/favourites/${nodeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
    } catch (e) {
      onPrefsChange(previous); // roll back
      toast.error(e instanceof Error ? e.message : "Could not update notifications.");
    } finally {
      setBusy(false);
    }
  }, [nodeId, prefs, isFavourited, onSubscribe, onPrefsChange, busy]);

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
              Turn off all to mute alerts for this sensor.
            </p>
          </div>
          <ChannelRow
            label="Website (in-app bell)"
            checked={prefs.pushEnabled}
            disabled={busy}
            onChange={(v) => void setChannel("pushEnabled", v)}
          />
          <ChannelRow
            label="Email"
            checked={prefs.emailEnabled}
            disabled={busy}
            onChange={(v) => void setChannel("emailEnabled", v)}
          />
          <ChannelRow
            label="SMS"
            checked={prefs.smsEnabled}
            disabled={busy}
            onChange={(v) => void setChannel("smsEnabled", v)}
          />
          <ChannelRow
            label="WhatsApp"
            checked={prefs.whatsappEnabled}
            disabled={busy}
            onChange={(v) => void setChannel("whatsappEnabled", v)}
          />
        </div>,
        document.body,
      )}
    </>
  );
}

function ChannelRow({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label
      className={`flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-xs transition ${
        disabled ? "opacity-60" : "hover:bg-[var(--color-hover)] cursor-pointer"
      }`}
    >
      <span className="text-[var(--color-text)]">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 cursor-pointer rounded accent-[var(--color-brand)]"
        aria-label={label}
      />
    </label>
  );
}
