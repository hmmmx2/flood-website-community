"use client";

import { useEffect } from "react";

/**
 * Forces a full reload when a page is restored from the browser's
 * back-forward cache (bfcache).
 *
 * Without this, navigating to a recently-visited page (e.g. typing the
 * URL after logging out, or pressing Back) can restore the ENTIRE page
 * from bfcache — including the in-memory NextAuth `useSession()` cache —
 * without re-fetching /api/auth/session. The result: a user who just
 * logged out still sees the logged-in UI until they manually refresh.
 *
 * `pageshow` fires on every navigation; `event.persisted === true` means
 * the page came from bfcache. Reloading then re-runs the SessionProvider
 * fetch so the auth state is always correct. A reloaded page is a fresh
 * (non-persisted) load, so there is no reload loop.
 */
export default function BfcacheGuard() {
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        window.location.reload();
      }
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  return null;
}
