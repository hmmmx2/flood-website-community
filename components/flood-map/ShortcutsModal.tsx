"use client";

/**
 * Keyboard-shortcuts overlay for the Flood Map (P1-13).
 *
 * Mirrors the cheat-sheet most map / IDE power-users instinctively look
 * for. Listed shortcuts are the ones we actually wire — no surprises.
 * The list is intentionally short.
 *
 * Toggle keys:
 *   - `?`     opens / closes this modal
 *   - `Esc`   closes (handled here)
 */

import { useEffect } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  onClose: () => void;
};

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["/"],         label: "Focus the search box" },
  { keys: ["+", "="],    label: "Zoom in" },
  { keys: ["-"],         label: "Zoom out" },
  { keys: ["f"],         label: "Toggle fullscreen" },
  { keys: ["m"],         label: "Open the map-type menu" },
  { keys: ["t"],         label: "Toggle the traffic layer" },
  { keys: ["g"],         label: "Recenter on my location" },
  { keys: ["?"],         label: "Show this cheat-sheet" },
  { keys: ["Esc"],       label: "Close any open panel" },
];

export default function ShortcutsModal({ open, onClose }: Props) {
  // Close on Esc — duplicated from the global handler so the modal
  // works correctly even in a context where no global handler is
  // mounted.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal
      aria-label="Keyboard shortcuts"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-[var(--color-card)] shadow-2xl ring-1 ring-black/10"
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <h2 className="text-base font-bold text-[var(--color-text)]">Keyboard shortcuts</h2>
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
        </div>
        <ul className="divide-y divide-[var(--color-border)]">
          {SHORTCUTS.map((s) => (
            <li key={s.label} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
              <span className="text-[var(--color-text)]">{s.label}</span>
              <span className="flex flex-wrap items-center gap-1">
                {s.keys.map((k, i) => (
                  <kbd
                    key={`${s.label}-${k}-${i}`}
                    className="inline-flex min-w-[1.75rem] items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-input-bg)] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[var(--color-text)] shadow-[inset_0_-1px_0_var(--color-border)]"
                  >
                    {k}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
        <p className="border-t border-[var(--color-border)] px-5 py-3 text-[11px] text-[var(--color-muted)]">
          Tip: shortcuts ignore typing inside text inputs.
        </p>
      </div>
    </div>,
    document.body,
  );
}
