"use client";

/**
 * `useGoogleMapsReady` — returns `true` once the Google Maps JS script
 * (with the `places` library) has finished loading and exposed the
 * `window.google.maps.places` namespace.
 *
 * Why this exists: every class component exported by
 * `@react-google-maps/api` (Autocomplete, Marker, Circle, HeatmapLayer
 * …) references the global `google` symbol directly inside
 * `componentDidMount`. If a consumer renders one of those components
 * BEFORE `useJsApiLoader` (called elsewhere in the tree) has finished
 * loading the script, the component throws
 * `ReferenceError: google is not defined` and unmounts the entire
 * React subtree.
 *
 * The fix: callers that render `Autocomplete` outside the
 * `<GoogleMap>`'s `isLoaded` branch — e.g. `DirectionsPanel`, which
 * lives at the page root for animation reasons — gate the
 * `<Autocomplete>` render on this hook. While `ready` is `false` they
 * render plain disabled `<input>` placeholders; the swap happens
 * automatically as soon as the script finishes loading.
 *
 * Polling rather than listening to the loader's promise because there's
 * no public observable — but the poll runs for at most a few seconds
 * during cold load and clears itself the instant the global appears.
 */

import { useEffect, useState } from "react";

type WindowWithGoogle = typeof window & {
  google?: {
    maps?: {
      places?: unknown;
    };
  };
};

function hasGoogleMapsPlaces(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as WindowWithGoogle;
  return !!w.google?.maps?.places;
}

export function useGoogleMapsReady(): boolean {
  // Synchronous initial value — if a parent already loaded the script
  // (e.g. on a soft client-side nav back to the map page) we skip the
  // poll entirely.
  const [ready, setReady] = useState<boolean>(hasGoogleMapsPlaces);

  useEffect(() => {
    if (ready) return;
    if (hasGoogleMapsPlaces()) {
      setReady(true);
      return;
    }
    const intervalId = window.setInterval(() => {
      if (hasGoogleMapsPlaces()) {
        setReady(true);
        window.clearInterval(intervalId);
      }
    }, 200);
    return () => window.clearInterval(intervalId);
  }, [ready]);

  return ready;
}
