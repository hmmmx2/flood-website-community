"use client";

/**
 * Computes the full `style` object for a slide-out side panel /
 * bottom-sheet on the flood map page. Shared by PlaceCard and
 * DirectionsPanel so both panels behave identically.
 *
 * Positioning is **container-relative** (`position: absolute`): the
 * panels are mounted INSIDE the map's `overflow-hidden` box (see
 * `app/flood-map/page.tsx`), so they dock to the map and are hard-
 * clipped to its bounds — they can never spill above/outside the Live
 * map. The off-screen open/close translate is clipped by the same
 * `overflow-hidden`, so nothing peeks out mid-animation either.
 *
 * Why a hook and not CSS classes: both panels previously mixed Tailwind
 * utilities for the mobile bottom-sheet with inline style for the
 * desktop rail, relying on CSS specificity AND a parent-supplied offset
 * being present at open time. Hydration mismatches / lagged resize
 * effects / JIT class scanning / stale SW chunks could leave the panel
 * pinned to the wrong corner. Driving every positional property from
 * inline style here removes that whole class of bug — inline beats
 * class regardless of specificity, and there's no class to lose to.
 *
 * The caller's className must NOT contain positional utilities
 * (`fixed`, `absolute`, `inset-*`, `top/right/bottom/left-*`, `w-*`,
 * `rounded*`, `max-h-*`, `translate*`).
 */

import { useEffect, useState, type CSSProperties } from "react";

/**
 * Shared "closed" properties — opacity 0 + pointer-events none so the
 * panel is unambiguously invisible AND non-interactive while closed,
 * even mid-animation. Translate alone wasn't enough: the close
 * transition could leave the panel visually "stuck sideways" depending
 * on browser paint timing. With `opacity: 0` it's invisible regardless
 * of where the translate landed; with `pointer-events: none` the user
 * can't accidentally re-grab it mid-animation. Both join the
 * `transform` in the CSS transition so the change is smooth.
 */
const HIDDEN = { opacity: 0, pointerEvents: "none" as const };
const SHOWN = { opacity: 1, pointerEvents: "auto" as const };

function bottomSheet(open: boolean): CSSProperties {
  return {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    top: "auto",
    maxHeight: "80%",
    borderTopLeftRadius: "1rem",
    borderTopRightRadius: "1rem",
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    transform: open ? "translateY(0)" : "translateY(110%)",
    ...(open ? SHOWN : HIDDEN),
  };
}

function sideRail(open: boolean, width: number): CSSProperties {
  return {
    position: "absolute",
    top: "0.75rem",
    right: "0.75rem",
    bottom: "auto",
    left: "auto",
    // Cap to the map width so the panel never exceeds its container on
    // a narrow map; the desktop intent is 360/400 px.
    width: `min(${width}px, calc(100% - 1.5rem))`,
    maxHeight: "calc(100% - 1.5rem)",
    borderRadius: "1rem",
    // 110% (not calc(100% + 1rem)) — a numeric value is more robust
    // inside transform across older WebKit; clipped by the map's
    // overflow-hidden either way.
    transform: open ? "translateX(0)" : "translateX(110%)",
    ...(open ? SHOWN : HIDDEN),
  };
}

/**
 * Returns an inline-style object covering ALL positioning + sizing +
 * rounding + transform-for-open-close for the panel's outer element,
 * relative to the nearest positioned ancestor (the map box).
 *
 * Default during SSR / first paint is the desktop side-rail OFF-SCREEN
 * so the panel is invisible until the effect has measured the viewport
 * — no flash of bottom-sheet on desktop.
 */
export function useSlideoutLayout(open: boolean): CSSProperties {
  const [style, setStyle] = useState<CSSProperties>(() =>
    sideRail(false, 360),
  );

  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth;
      if (w < 640) {
        setStyle(bottomSheet(open));
        return;
      }
      const width = w >= 1024 ? 400 : 360;
      setStyle(sideRail(open, width));
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [open]);

  return style;
}
