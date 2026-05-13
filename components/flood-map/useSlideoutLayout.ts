"use client";

/**
 * Computes the full `style` object for a slide-out side panel /
 * bottom-sheet on the flood map page. Shared by PlaceCard and
 * DirectionsPanel so both panels behave identically.
 *
 * Why this is a hook and not a CSS class:
 *
 * Both panels previously used a mix of Tailwind utilities for the
 * mobile bottom-sheet (`inset-x-0 bottom-0`) and inline style or
 * arbitrary `right-[…]` classes for the desktop side rail. That mix
 * relied on inline style WINNING over the mobile classes via CSS
 * specificity, AND on a parent-supplied `rightOffset` prop being
 * non-null at the exact moment the panel was opened. Any of:
 *   - hydration mismatch
 *   - a React render where the resize effect hadn't fired yet
 *   - JIT class scanning skipping a complex arbitrary value
 *   - service-worker caching of an older chunk
 * left the panel pinned to bottom-left because the mobile classes
 * were the only ones taking effect.
 *
 * The fix is to remove every positional Tailwind class and make
 * positioning purely inline-style-driven from this hook. There's no
 * way for a class to fight the inline `right: 344px; left: auto;
 * top: 6rem; bottom: auto` block — inline beats class regardless of
 * specificity, and there's no class declaration to lose to anyway.
 *
 * The page's `max-w-7xl` container width (1280 px) and `px-6`
 * padding (24 px) are hard-coded constants here to match
 * `lib/layout.ts` — keeps the panel flush with the map card's right
 * edge on wide screens without any prop drilling.
 */

import { useEffect, useState, type CSSProperties } from "react";

/** Matches `max-w-7xl` from `lib/layout.ts`. */
const PAGE_MAX_PX = 1280;
/** Matches `sm:px-6` from `lib/layout.ts`. */
const PAGE_PAD_PX = 24;
/** Minimum gap from the viewport's right edge on narrow screens. */
const FALLBACK_PX = 16;

/**
 * Shared "closed" properties — opacity 0 + pointer-events none so the
 * panel is unambiguously invisible AND non-interactive while closed,
 * even mid-animation. Translate alone wasn't enough: on the friend's
 * 1148-px viewport, the close transition could leave the panel
 * visually "stuck side way" depending on browser paint timing. With
 * `opacity: 0` the panel is invisible regardless of where the
 * translate has landed; with `pointer-events: none` the user can't
 * accidentally re-grab it mid-animation. Both properties join the
 * `transform` in the CSS transition so the change is smooth, not
 * abrupt.
 */
const HIDDEN = { opacity: 0, pointerEvents: "none" as const };
const SHOWN = { opacity: 1, pointerEvents: "auto" as const };

function bottomSheet(open: boolean): CSSProperties {
  return {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    top: "auto",
    maxHeight: "80vh",
    borderTopLeftRadius: "1rem",
    borderTopRightRadius: "1rem",
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    transform: open ? "translateY(0)" : "translateY(100%)",
    ...(open ? SHOWN : HIDDEN),
  };
}

function sideRail(open: boolean, width: number, rightPx: number): CSSProperties {
  return {
    position: "fixed",
    top: "6rem",
    right: `${rightPx}px`,
    bottom: "auto",
    left: "auto",
    width: `${width}px`,
    maxHeight: "calc(100vh - 8rem)",
    borderRadius: "1rem",
    // 110% instead of `calc(100% + 1rem)` — a numeric value is more
    // robust than calc() inside transform across older WebKit builds,
    // and 10% beyond the panel's own width guarantees it clears the
    // viewport edge.
    transform: open ? "translateX(0)" : "translateX(110%)",
    ...(open ? SHOWN : HIDDEN),
  };
}

/**
 * Returns an inline-style object covering ALL positioning + sizing +
 * rounding + transform-for-open-close for the panel's outer element.
 * The caller's className should NOT contain any positional utilities
 * (`fixed`, `inset-*`, `top-*`, `right-*`, `bottom-*`, `left-*`,
 * `w-*`, `rounded*`, `max-h-*`, `translate*`).
 *
 * Default returned style during SSR / first paint is the desktop
 * side-rail OFF-SCREEN (translateX(100%+1rem)) at the fallback right
 * offset. That choice keeps the panel invisible until the effect
 * has measured the viewport — no flash of bottom-sheet on desktop.
 */
export function useSlideoutLayout(open: boolean): CSSProperties {
  const [style, setStyle] = useState<CSSProperties>(() =>
    sideRail(false, 360, FALLBACK_PX),
  );

  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth;
      if (w < 640) {
        setStyle(bottomSheet(open));
        return;
      }
      const width = w >= 1024 ? 400 : 360;
      const rightPx =
        w <= PAGE_MAX_PX
          ? FALLBACK_PX
          : Math.floor((w - PAGE_MAX_PX) / 2 + PAGE_PAD_PX);
      setStyle(sideRail(open, width, rightPx));
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [open]);

  return style;
}
