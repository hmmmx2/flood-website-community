"use client";

/**
 * <KebabMenu /> — the canonical three-dot owner-action menu for the
 * community site.
 *
 * UI rule. Any row, card, or list item that exposes Edit / Delete /
 * Report style actions MUST surface them through this component instead
 * of inline links. The menu is portal-rendered to `document.body` so it
 * escapes the parent's `overflow` / `rounded` clipping, and it closes on
 * outside-click + Escape automatically.
 *
 * Already used by the post kebab and the comment kebab. Adopt it for any
 * new row-level action menus.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type KebabItem = {
  /** Visible label. */
  label: string;
  /** Click handler. The menu closes automatically before this fires. */
  onSelect: () => void;
  /** Optional leading icon, sized 14-16 px. */
  icon?: ReactNode;
  /** "danger" colours the row red — for Delete / Remove / Block. */
  variant?: "default" | "danger";
  /** Disable without removing the row. */
  disabled?: boolean;
};

type Props = {
  items: KebabItem[];
  /** Screen-reader label for the trigger button. */
  triggerLabel?: string;
  /** Extra class on the trigger button. */
  className?: string;
};

export default function KebabMenu({
  items,
  triggerLabel = "Actions",
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const recalcPos = useCallback(() => {
    const b = triggerRef.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    const W = 168;
    const margin = 8;
    let left = r.right - W;
    if (left < margin) left = margin;
    if (left + W + margin > window.innerWidth) left = window.innerWidth - W - margin;
    setPos({ top: r.bottom + 6, left });
  }, []);

  useEffect(() => {
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

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (triggerRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label={triggerLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex h-7 w-7 items-center justify-center rounded-full text-[var(--color-muted)] transition-colors hover:bg-[var(--color-pill-bg)] hover:text-[var(--color-text)] ${className}`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="h-4 w-4"
          aria-hidden
        >
          <circle cx="12" cy="5" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="12" cy="19" r="1.6" />
        </svg>
      </button>

      {open && pos && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            onClick={(e) => e.stopPropagation()}
            style={{ position: "fixed", top: pos.top, left: pos.left, width: 168 }}
            className="z-[80] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-xl ring-1 ring-black/5"
          >
            {items.map((item, i) => {
              const danger = item.variant === "danger";
              return (
                <button
                  key={i}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => {
                    setOpen(false);
                    item.onSelect();
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    danger
                      ? "text-red-500 hover:bg-red-500/10"
                      : "text-[var(--color-text)] hover:bg-[var(--color-pill-bg)]"
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
